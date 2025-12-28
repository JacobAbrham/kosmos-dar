/**
 * GitHub MCP Server
 *
 * GitHub repository management for KOSMOS agents including:
 * - Repository operations
 * - Issue and PR management
 * - Code search
 * - Commit and branch operations
 * - File operations
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Octokit } from "@octokit/rest";

// Environment configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "";

// Initialize GitHub client
const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

// Tool schemas
const ListReposSchema = z.object({
  owner: z.string().optional().describe("Owner (defaults to configured owner)"),
  type: z.enum(["all", "public", "private", "forks", "sources", "member"]).default("all"),
  sort: z.enum(["created", "updated", "pushed", "full_name"]).default("updated"),
  perPage: z.number().default(30),
});

const GetRepoSchema = z.object({
  owner: z.string().optional(),
  repo: z.string(),
});

const ListIssuesSchema = z.object({
  owner: z.string().optional(),
  repo: z.string(),
  state: z.enum(["open", "closed", "all"]).default("open"),
  labels: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  perPage: z.number().default(30),
});

const CreateIssueSchema = z.object({
  owner: z.string().optional(),
  repo: z.string(),
  title: z.string(),
  body: z.string().optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  milestone: z.number().optional(),
});

const ListPullRequestsSchema = z.object({
  owner: z.string().optional(),
  repo: z.string(),
  state: z.enum(["open", "closed", "all"]).default("open"),
  head: z.string().optional(),
  base: z.string().optional(),
  sort: z.enum(["created", "updated", "popularity", "long-running"]).default("created"),
  perPage: z.number().default(30),
});

const CreatePullRequestSchema = z.object({
  owner: z.string().optional(),
  repo: z.string(),
  title: z.string(),
  body: z.string().optional(),
  head: z.string().describe("Branch to merge from"),
  base: z.string().describe("Branch to merge into"),
  draft: z.boolean().default(false),
});

const SearchCodeSchema = z.object({
  query: z.string().describe("Search query"),
  owner: z.string().optional(),
  repo: z.string().optional(),
  language: z.string().optional(),
  perPage: z.number().default(30),
});

const GetFileContentSchema = z.object({
  owner: z.string().optional(),
  repo: z.string(),
  path: z.string(),
  ref: z.string().optional().describe("Branch, tag, or commit SHA"),
});

const CreateOrUpdateFileSchema = z.object({
  owner: z.string().optional(),
  repo: z.string(),
  path: z.string(),
  message: z.string().describe("Commit message"),
  content: z.string().describe("File content (will be base64 encoded)"),
  branch: z.string().optional(),
  sha: z.string().optional().describe("Required for updates"),
});

const ListBranchesSchema = z.object({
  owner: z.string().optional(),
  repo: z.string(),
  protected: z.boolean().optional(),
  perPage: z.number().default(30),
});

const ListCommitsSchema = z.object({
  owner: z.string().optional(),
  repo: z.string(),
  sha: z.string().optional().describe("Branch or SHA"),
  path: z.string().optional().describe("Only commits affecting this path"),
  author: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  perPage: z.number().default(30),
});

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "list_repos",
    description: "List repositories for a user or organization",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        type: { type: "string", enum: ["all", "public", "private", "forks", "sources", "member"], default: "all" },
        sort: { type: "string", enum: ["created", "updated", "pushed", "full_name"], default: "updated" },
        perPage: { type: "number", default: 30 },
      },
    },
  },
  {
    name: "get_repo",
    description: "Get details about a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
      },
      required: ["repo"],
    },
  },
  {
    name: "list_issues",
    description: "List issues in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        state: { type: "string", enum: ["open", "closed", "all"], default: "open" },
        labels: { type: "array", items: { type: "string" } },
        assignee: { type: "string" },
        perPage: { type: "number", default: 30 },
      },
      required: ["repo"],
    },
  },
  {
    name: "create_issue",
    description: "Create a new issue",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        title: { type: "string" },
        body: { type: "string" },
        labels: { type: "array", items: { type: "string" } },
        assignees: { type: "array", items: { type: "string" } },
        milestone: { type: "number" },
      },
      required: ["repo", "title"],
    },
  },
  {
    name: "list_pull_requests",
    description: "List pull requests in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        state: { type: "string", enum: ["open", "closed", "all"], default: "open" },
        head: { type: "string" },
        base: { type: "string" },
        sort: { type: "string", enum: ["created", "updated", "popularity", "long-running"], default: "created" },
        perPage: { type: "number", default: 30 },
      },
      required: ["repo"],
    },
  },
  {
    name: "create_pull_request",
    description: "Create a new pull request",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        title: { type: "string" },
        body: { type: "string" },
        head: { type: "string" },
        base: { type: "string" },
        draft: { type: "boolean", default: false },
      },
      required: ["repo", "title", "head", "base"],
    },
  },
  {
    name: "search_code",
    description: "Search for code across repositories",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        owner: { type: "string" },
        repo: { type: "string" },
        language: { type: "string" },
        perPage: { type: "number", default: 30 },
      },
      required: ["query"],
    },
  },
  {
    name: "get_file_content",
    description: "Get the content of a file from a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        path: { type: "string" },
        ref: { type: "string" },
      },
      required: ["repo", "path"],
    },
  },
  {
    name: "create_or_update_file",
    description: "Create or update a file in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        path: { type: "string" },
        message: { type: "string" },
        content: { type: "string" },
        branch: { type: "string" },
        sha: { type: "string" },
      },
      required: ["repo", "path", "message", "content"],
    },
  },
  {
    name: "list_branches",
    description: "List branches in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        protected: { type: "boolean" },
        perPage: { type: "number", default: 30 },
      },
      required: ["repo"],
    },
  },
  {
    name: "list_commits",
    description: "List commits in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        sha: { type: "string" },
        path: { type: "string" },
        author: { type: "string" },
        since: { type: "string" },
        until: { type: "string" },
        perPage: { type: "number", default: 30 },
      },
      required: ["repo"],
    },
  },
];

// Helper to get owner
function getOwner(params: { owner?: string }): string {
  return params.owner || GITHUB_OWNER;
}

// Tool implementations
async function listRepos(params: z.infer<typeof ListReposSchema>): Promise<any> {
  const owner = getOwner(params);

  const result = await octokit.repos.listForUser({
    username: owner,
    type: params.type,
    sort: params.sort,
    per_page: params.perPage,
  });

  return {
    count: result.data.length,
    repos: result.data.map((r) => ({
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      private: r.private,
      fork: r.fork,
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      openIssues: r.open_issues_count,
      defaultBranch: r.default_branch,
      updatedAt: r.updated_at,
      url: r.html_url,
    })),
  };
}

async function getRepo(params: z.infer<typeof GetRepoSchema>): Promise<any> {
  const result = await octokit.repos.get({
    owner: getOwner(params),
    repo: params.repo,
  });

  const r = result.data;
  return {
    name: r.name,
    fullName: r.full_name,
    description: r.description,
    private: r.private,
    fork: r.fork,
    language: r.language,
    stars: r.stargazers_count,
    forks: r.forks_count,
    openIssues: r.open_issues_count,
    watchers: r.watchers_count,
    defaultBranch: r.default_branch,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    pushedAt: r.pushed_at,
    size: r.size,
    license: r.license?.name,
    topics: r.topics,
    url: r.html_url,
    cloneUrl: r.clone_url,
  };
}

async function listIssues(params: z.infer<typeof ListIssuesSchema>): Promise<any> {
  const result = await octokit.issues.listForRepo({
    owner: getOwner(params),
    repo: params.repo,
    state: params.state,
    labels: params.labels?.join(","),
    assignee: params.assignee,
    per_page: params.perPage,
  });

  return {
    count: result.data.length,
    issues: result.data
      .filter((i) => !i.pull_request) // Exclude PRs
      .map((i) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        author: i.user?.login,
        labels: i.labels.map((l) => (typeof l === "string" ? l : l.name)),
        assignees: i.assignees?.map((a) => a.login),
        comments: i.comments,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
        url: i.html_url,
      })),
  };
}

async function createIssue(params: z.infer<typeof CreateIssueSchema>): Promise<any> {
  const result = await octokit.issues.create({
    owner: getOwner(params),
    repo: params.repo,
    title: params.title,
    body: params.body,
    labels: params.labels,
    assignees: params.assignees,
    milestone: params.milestone,
  });

  return {
    number: result.data.number,
    title: result.data.title,
    url: result.data.html_url,
    state: result.data.state,
  };
}

async function listPullRequests(params: z.infer<typeof ListPullRequestsSchema>): Promise<any> {
  const result = await octokit.pulls.list({
    owner: getOwner(params),
    repo: params.repo,
    state: params.state,
    head: params.head,
    base: params.base,
    sort: params.sort,
    per_page: params.perPage,
  });

  return {
    count: result.data.length,
    pullRequests: result.data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      author: pr.user?.login,
      head: pr.head.ref,
      base: pr.base.ref,
      draft: pr.draft,
      mergeable: pr.mergeable,
      merged: pr.merged,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      url: pr.html_url,
    })),
  };
}

async function createPullRequest(params: z.infer<typeof CreatePullRequestSchema>): Promise<any> {
  const result = await octokit.pulls.create({
    owner: getOwner(params),
    repo: params.repo,
    title: params.title,
    body: params.body,
    head: params.head,
    base: params.base,
    draft: params.draft,
  });

  return {
    number: result.data.number,
    title: result.data.title,
    url: result.data.html_url,
    state: result.data.state,
    head: result.data.head.ref,
    base: result.data.base.ref,
  };
}

async function searchCode(params: z.infer<typeof SearchCodeSchema>): Promise<any> {
  let q = params.query;
  if (params.owner && params.repo) {
    q += ` repo:${params.owner}/${params.repo}`;
  } else if (params.owner) {
    q += ` user:${params.owner}`;
  }
  if (params.language) {
    q += ` language:${params.language}`;
  }

  const result = await octokit.search.code({
    q,
    per_page: params.perPage,
  });

  return {
    totalCount: result.data.total_count,
    items: result.data.items.map((item) => ({
      name: item.name,
      path: item.path,
      repository: item.repository.full_name,
      url: item.html_url,
      score: item.score,
    })),
  };
}

async function getFileContent(params: z.infer<typeof GetFileContentSchema>): Promise<any> {
  const result = await octokit.repos.getContent({
    owner: getOwner(params),
    repo: params.repo,
    path: params.path,
    ref: params.ref,
  });

  const data = result.data as any;
  if (Array.isArray(data)) {
    // It's a directory
    return {
      type: "directory",
      entries: data.map((entry: any) => ({
        name: entry.name,
        path: entry.path,
        type: entry.type,
        size: entry.size,
      })),
    };
  }

  // It's a file
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return {
    type: "file",
    name: data.name,
    path: data.path,
    size: data.size,
    sha: data.sha,
    content,
    encoding: "utf-8",
    url: data.html_url,
  };
}

async function createOrUpdateFile(params: z.infer<typeof CreateOrUpdateFileSchema>): Promise<any> {
  const result = await octokit.repos.createOrUpdateFileContents({
    owner: getOwner(params),
    repo: params.repo,
    path: params.path,
    message: params.message,
    content: Buffer.from(params.content).toString("base64"),
    branch: params.branch,
    sha: params.sha,
  });

  return {
    commit: {
      sha: result.data.commit.sha,
      message: result.data.commit.message,
      url: result.data.commit.html_url,
    },
    content: {
      name: result.data.content?.name,
      path: result.data.content?.path,
      sha: result.data.content?.sha,
    },
  };
}

async function listBranches(params: z.infer<typeof ListBranchesSchema>): Promise<any> {
  const result = await octokit.repos.listBranches({
    owner: getOwner(params),
    repo: params.repo,
    protected: params.protected,
    per_page: params.perPage,
  });

  return {
    count: result.data.length,
    branches: result.data.map((b) => ({
      name: b.name,
      sha: b.commit.sha,
      protected: b.protected,
    })),
  };
}

async function listCommits(params: z.infer<typeof ListCommitsSchema>): Promise<any> {
  const result = await octokit.repos.listCommits({
    owner: getOwner(params),
    repo: params.repo,
    sha: params.sha,
    path: params.path,
    author: params.author,
    since: params.since,
    until: params.until,
    per_page: params.perPage,
  });

  return {
    count: result.data.length,
    commits: result.data.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author?.name,
      authorEmail: c.commit.author?.email,
      date: c.commit.author?.date,
      url: c.html_url,
    })),
  };
}

// Create server
const server = new Server(
  {
    name: "github-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Call tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "list_repos":
        result = await listRepos(ListReposSchema.parse(args));
        break;
      case "get_repo":
        result = await getRepo(GetRepoSchema.parse(args));
        break;
      case "list_issues":
        result = await listIssues(ListIssuesSchema.parse(args));
        break;
      case "create_issue":
        result = await createIssue(CreateIssueSchema.parse(args));
        break;
      case "list_pull_requests":
        result = await listPullRequests(ListPullRequestsSchema.parse(args));
        break;
      case "create_pull_request":
        result = await createPullRequest(CreatePullRequestSchema.parse(args));
        break;
      case "search_code":
        result = await searchCode(SearchCodeSchema.parse(args));
        break;
      case "get_file_content":
        result = await getFileContent(GetFileContentSchema.parse(args));
        break;
      case "create_or_update_file":
        result = await createOrUpdateFile(CreateOrUpdateFileSchema.parse(args));
        break;
      case "list_branches":
        result = await listBranches(ListBranchesSchema.parse(args));
        break;
      case "list_commits":
        result = await listCommits(ListCommitsSchema.parse(args));
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GitHub MCP Server started");
}

main().catch(console.error);
