/**
 * Jira MCP Server - Issue tracking and project management for KOSMOS agents
 *
 * Provides comprehensive Jira integration including:
 * - Issue CRUD operations with JQL search
 * - Comment management
 * - Status transitions
 * - Sprint and board management (Agile API)
 * - User management
 * - Attachments
 * - Issue linking
 *
 * Authentication: Basic Auth with email + API token
 * Environment Variables: JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  baseUrl: process.env.JIRA_URL || "",
  email: process.env.JIRA_EMAIL || "",
  apiToken: process.env.JIRA_API_TOKEN || "",
};

function getAuthHeader(): string {
  return `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString("base64")}`;
}

// =============================================================================
// API Request Helpers
// =============================================================================

async function jiraRequest(
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const url = `${config.baseUrl}/rest/api/3${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ errorMessages: [res.statusText] }));
    throw new Error(error.errorMessages?.join(", ") || error.message || res.statusText);
  }

  return res.status === 204 ? {} : res.json();
}

async function agileRequest(
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const url = `${config.baseUrl}/rest/agile/1.0${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ errorMessages: [res.statusText] }));
    throw new Error(error.errorMessages?.join(", ") || error.message || res.statusText);
  }

  return res.status === 204 ? {} : res.json();
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Issue Operations
  {
    name: "search_issues",
    description: "Search for issues using JQL (Jira Query Language).",
    inputSchema: {
      type: "object",
      properties: {
        jql: {
          type: "string",
          description: "JQL query string (e.g., 'project = PROJ AND status = Open')",
        },
        fields: {
          type: "array",
          items: { type: "string" },
          description: "Fields to return (default: summary, status, assignee, priority)",
        },
        maxResults: {
          type: "number",
          description: "Maximum results to return (default: 50)",
        },
        startAt: {
          type: "number",
          description: "Index of first result (for pagination)",
        },
      },
      required: ["jql"],
    },
  },
  {
    name: "get_issue",
    description: "Get detailed information about a specific issue.",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key (e.g., 'PROJ-123')",
        },
        fields: {
          type: "array",
          items: { type: "string" },
          description: "Specific fields to return",
        },
        expand: {
          type: "array",
          items: { type: "string" },
          description: "Fields to expand (e.g., 'changelog', 'renderedFields')",
        },
      },
      required: ["issueKey"],
    },
  },
  {
    name: "create_issue",
    description: "Create a new Jira issue.",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: {
          type: "string",
          description: "Project key (e.g., 'PROJ')",
        },
        issueType: {
          type: "string",
          description: "Issue type name (e.g., 'Bug', 'Story', 'Task')",
        },
        summary: {
          type: "string",
          description: "Issue summary/title",
        },
        description: {
          type: "string",
          description: "Issue description",
        },
        priority: {
          type: "string",
          description: "Priority name (e.g., 'High', 'Medium', 'Low')",
        },
        assignee: {
          type: "string",
          description: "Assignee account ID",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Labels to add",
        },
        components: {
          type: "array",
          items: { type: "string" },
          description: "Component names",
        },
        customFields: {
          type: "object",
          description: "Custom field values (key: field ID, value: field value)",
        },
      },
      required: ["projectKey", "issueType", "summary"],
    },
  },
  {
    name: "update_issue",
    description: "Update an existing issue's fields.",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key to update",
        },
        summary: {
          type: "string",
          description: "New summary",
        },
        description: {
          type: "string",
          description: "New description",
        },
        priority: {
          type: "string",
          description: "New priority name",
        },
        assignee: {
          type: "string",
          description: "New assignee account ID",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "New labels (replaces existing)",
        },
        customFields: {
          type: "object",
          description: "Custom field updates",
        },
      },
      required: ["issueKey"],
    },
  },
  {
    name: "delete_issue",
    description: "Delete an issue.",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key to delete",
        },
        deleteSubtasks: {
          type: "boolean",
          description: "Also delete subtasks (default: false)",
        },
      },
      required: ["issueKey"],
    },
  },

  // Comment Operations
  {
    name: "add_comment",
    description: "Add a comment to an issue.",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key",
        },
        body: {
          type: "string",
          description: "Comment text",
        },
      },
      required: ["issueKey", "body"],
    },
  },
  {
    name: "list_comments",
    description: "List all comments on an issue.",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key",
        },
        maxResults: {
          type: "number",
          description: "Maximum comments to return (default: 50)",
        },
      },
      required: ["issueKey"],
    },
  },

  // Transition Operations
  {
    name: "transition_issue",
    description: "Transition an issue to a new status.",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key",
        },
        transitionId: {
          type: "string",
          description: "Transition ID (use get_issue with expand=['transitions'] to see available)",
        },
        comment: {
          type: "string",
          description: "Optional comment to add with transition",
        },
        fields: {
          type: "object",
          description: "Fields required by the transition",
        },
      },
      required: ["issueKey", "transitionId"],
    },
  },

  // Assignment
  {
    name: "assign_issue",
    description: "Assign an issue to a user.",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key",
        },
        accountId: {
          type: "string",
          description: "User account ID (null to unassign)",
        },
      },
      required: ["issueKey"],
    },
  },

  // Project Operations
  {
    name: "list_projects",
    description: "List all accessible projects.",
    inputSchema: {
      type: "object",
      properties: {
        maxResults: {
          type: "number",
          description: "Maximum projects to return (default: 50)",
        },
        startAt: {
          type: "number",
          description: "Index of first result",
        },
      },
    },
  },
  {
    name: "get_project",
    description: "Get project details.",
    inputSchema: {
      type: "object",
      properties: {
        projectKey: {
          type: "string",
          description: "Project key or ID",
        },
      },
      required: ["projectKey"],
    },
  },

  // Sprint Operations
  {
    name: "list_sprints",
    description: "List sprints for a board.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: {
          type: "number",
          description: "Board ID",
        },
        state: {
          type: "string",
          description: "Filter by state: 'active', 'future', 'closed'",
        },
        maxResults: {
          type: "number",
          description: "Maximum sprints to return (default: 50)",
        },
      },
      required: ["boardId"],
    },
  },
  {
    name: "get_sprint",
    description: "Get sprint details.",
    inputSchema: {
      type: "object",
      properties: {
        sprintId: {
          type: "number",
          description: "Sprint ID",
        },
      },
      required: ["sprintId"],
    },
  },
  {
    name: "add_to_sprint",
    description: "Add issues to a sprint.",
    inputSchema: {
      type: "object",
      properties: {
        sprintId: {
          type: "number",
          description: "Sprint ID",
        },
        issueKeys: {
          type: "array",
          items: { type: "string" },
          description: "Issue keys to add to the sprint",
        },
      },
      required: ["sprintId", "issueKeys"],
    },
  },

  // Board Operations
  {
    name: "list_boards",
    description: "List Kanban/Scrum boards.",
    inputSchema: {
      type: "object",
      properties: {
        projectKeyOrId: {
          type: "string",
          description: "Filter by project",
        },
        type: {
          type: "string",
          description: "Board type: 'scrum' or 'kanban'",
        },
        maxResults: {
          type: "number",
          description: "Maximum boards to return (default: 50)",
        },
      },
    },
  },
  {
    name: "get_board",
    description: "Get board details.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: {
          type: "number",
          description: "Board ID",
        },
      },
      required: ["boardId"],
    },
  },

  // User Operations
  {
    name: "list_users",
    description: "Search for users.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (name or email)",
        },
        maxResults: {
          type: "number",
          description: "Maximum users to return (default: 50)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_user",
    description: "Get user details by account ID.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: {
          type: "string",
          description: "User account ID",
        },
      },
      required: ["accountId"],
    },
  },

  // Attachment Operations
  {
    name: "add_attachment",
    description: "Add an attachment to an issue (base64 encoded content).",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: {
          type: "string",
          description: "Issue key",
        },
        filename: {
          type: "string",
          description: "Filename for the attachment",
        },
        content: {
          type: "string",
          description: "Base64 encoded file content",
        },
      },
      required: ["issueKey", "filename", "content"],
    },
  },

  // Issue Link Operations
  {
    name: "link_issues",
    description: "Link two issues together.",
    inputSchema: {
      type: "object",
      properties: {
        inwardIssue: {
          type: "string",
          description: "Inward issue key (e.g., the issue being blocked)",
        },
        outwardIssue: {
          type: "string",
          description: "Outward issue key (e.g., the blocking issue)",
        },
        linkType: {
          type: "string",
          description: "Link type name (e.g., 'Blocks', 'Relates', 'Duplicates')",
        },
      },
      required: ["inwardIssue", "outwardIssue", "linkType"],
    },
  },
];

// =============================================================================
// Tool Implementations
// =============================================================================

// --- Issue Operations ---

async function searchIssues(params: {
  jql: string;
  fields?: string[];
  maxResults?: number;
  startAt?: number;
}): Promise<any> {
  const res = await jiraRequest("POST", "/search", {
    jql: params.jql,
    fields: params.fields || ["summary", "status", "assignee", "priority", "issuetype"],
    maxResults: params.maxResults || 50,
    startAt: params.startAt || 0,
  });

  return {
    total: res.total,
    startAt: res.startAt,
    maxResults: res.maxResults,
    issues: res.issues.map((i: any) => ({
      key: i.key,
      id: i.id,
      summary: i.fields?.summary,
      status: i.fields?.status?.name,
      assignee: i.fields?.assignee?.displayName,
      assigneeId: i.fields?.assignee?.accountId,
      priority: i.fields?.priority?.name,
      issueType: i.fields?.issuetype?.name,
    })),
  };
}

async function getIssue(params: {
  issueKey: string;
  fields?: string[];
  expand?: string[];
}): Promise<any> {
  const query: string[] = [];
  if (params.fields) query.push(`fields=${params.fields.join(",")}`);
  if (params.expand) query.push(`expand=${params.expand.join(",")}`);
  const queryStr = query.length ? `?${query.join("&")}` : "";

  const issue = await jiraRequest("GET", `/issue/${params.issueKey}${queryStr}`);

  return {
    key: issue.key,
    id: issue.id,
    self: issue.self,
    fields: issue.fields,
    transitions: issue.transitions,
    changelog: issue.changelog,
  };
}

async function createIssue(params: {
  projectKey: string;
  issueType: string;
  summary: string;
  description?: string;
  priority?: string;
  assignee?: string;
  labels?: string[];
  components?: string[];
  customFields?: any;
}): Promise<any> {
  const fields: any = {
    project: { key: params.projectKey },
    issuetype: { name: params.issueType },
    summary: params.summary,
  };

  if (params.description) {
    fields.description = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: params.description }],
        },
      ],
    };
  }

  if (params.priority) fields.priority = { name: params.priority };
  if (params.assignee) fields.assignee = { accountId: params.assignee };
  if (params.labels) fields.labels = params.labels;
  if (params.components) fields.components = params.components.map((name) => ({ name }));
  if (params.customFields) Object.assign(fields, params.customFields);

  const res = await jiraRequest("POST", "/issue", { fields });

  return {
    key: res.key,
    id: res.id,
    self: res.self,
  };
}

async function updateIssue(params: {
  issueKey: string;
  summary?: string;
  description?: string;
  priority?: string;
  assignee?: string;
  labels?: string[];
  customFields?: any;
}): Promise<any> {
  const fields: any = {};

  if (params.summary) fields.summary = params.summary;
  if (params.description) {
    fields.description = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: params.description }],
        },
      ],
    };
  }
  if (params.priority) fields.priority = { name: params.priority };
  if (params.assignee) fields.assignee = { accountId: params.assignee };
  if (params.labels) fields.labels = params.labels;
  if (params.customFields) Object.assign(fields, params.customFields);

  await jiraRequest("PUT", `/issue/${params.issueKey}`, { fields });

  return {
    key: params.issueKey,
    updated: true,
  };
}

async function deleteIssue(params: {
  issueKey: string;
  deleteSubtasks?: boolean;
}): Promise<any> {
  const query = params.deleteSubtasks ? "?deleteSubtasks=true" : "";
  await jiraRequest("DELETE", `/issue/${params.issueKey}${query}`);

  return {
    key: params.issueKey,
    deleted: true,
  };
}

// --- Comment Operations ---

async function addComment(params: { issueKey: string; body: string }): Promise<any> {
  const res = await jiraRequest("POST", `/issue/${params.issueKey}/comment`, {
    body: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: params.body }],
        },
      ],
    },
  });

  return {
    id: res.id,
    author: res.author?.displayName,
    created: res.created,
  };
}

async function listComments(params: {
  issueKey: string;
  maxResults?: number;
}): Promise<any> {
  const res = await jiraRequest(
    "GET",
    `/issue/${params.issueKey}/comment?maxResults=${params.maxResults || 50}`
  );

  return {
    total: res.total,
    comments: res.comments.map((c: any) => ({
      id: c.id,
      author: c.author?.displayName,
      authorId: c.author?.accountId,
      created: c.created,
      updated: c.updated,
      body: c.body,
    })),
  };
}

// --- Transition Operations ---

async function transitionIssue(params: {
  issueKey: string;
  transitionId: string;
  comment?: string;
  fields?: any;
}): Promise<any> {
  const body: any = {
    transition: { id: params.transitionId },
  };

  if (params.fields) body.fields = params.fields;
  if (params.comment) {
    body.update = {
      comment: [
        {
          add: {
            body: {
              type: "doc",
              version: 1,
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: params.comment }],
                },
              ],
            },
          },
        },
      ],
    };
  }

  await jiraRequest("POST", `/issue/${params.issueKey}/transitions`, body);

  return {
    key: params.issueKey,
    transitioned: true,
  };
}

// --- Assignment ---

async function assignIssue(params: {
  issueKey: string;
  accountId?: string;
}): Promise<any> {
  await jiraRequest("PUT", `/issue/${params.issueKey}/assignee`, {
    accountId: params.accountId || null,
  });

  return {
    key: params.issueKey,
    assigned: params.accountId ? true : false,
    accountId: params.accountId || null,
  };
}

// --- Project Operations ---

async function listProjects(params: {
  maxResults?: number;
  startAt?: number;
}): Promise<any> {
  const res = await jiraRequest(
    "GET",
    `/project/search?maxResults=${params.maxResults || 50}&startAt=${params.startAt || 0}`
  );

  return {
    total: res.total,
    projects: res.values.map((p: any) => ({
      key: p.key,
      id: p.id,
      name: p.name,
      projectTypeKey: p.projectTypeKey,
      lead: p.lead?.displayName,
    })),
  };
}

async function getProject(params: { projectKey: string }): Promise<any> {
  const project = await jiraRequest("GET", `/project/${params.projectKey}`);

  return {
    key: project.key,
    id: project.id,
    name: project.name,
    description: project.description,
    projectTypeKey: project.projectTypeKey,
    lead: project.lead?.displayName,
    leadId: project.lead?.accountId,
    issueTypes: project.issueTypes?.map((it: any) => ({
      id: it.id,
      name: it.name,
      subtask: it.subtask,
    })),
  };
}

// --- Sprint Operations ---

async function listSprints(params: {
  boardId: number;
  state?: string;
  maxResults?: number;
}): Promise<any> {
  const query: string[] = [];
  if (params.state) query.push(`state=${params.state}`);
  if (params.maxResults) query.push(`maxResults=${params.maxResults}`);
  const queryStr = query.length ? `?${query.join("&")}` : "";

  const res = await agileRequest("GET", `/board/${params.boardId}/sprint${queryStr}`);

  return {
    sprints: (res.values || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      state: s.state,
      startDate: s.startDate,
      endDate: s.endDate,
      goal: s.goal,
    })),
  };
}

async function getSprint(params: { sprintId: number }): Promise<any> {
  const sprint = await agileRequest("GET", `/sprint/${params.sprintId}`);

  return {
    id: sprint.id,
    name: sprint.name,
    state: sprint.state,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    completeDate: sprint.completeDate,
    goal: sprint.goal,
    originBoardId: sprint.originBoardId,
  };
}

async function addToSprint(params: {
  sprintId: number;
  issueKeys: string[];
}): Promise<any> {
  await agileRequest("POST", `/sprint/${params.sprintId}/issue`, {
    issues: params.issueKeys,
  });

  return {
    sprintId: params.sprintId,
    issuesAdded: params.issueKeys,
  };
}

// --- Board Operations ---

async function listBoards(params: {
  projectKeyOrId?: string;
  type?: string;
  maxResults?: number;
}): Promise<any> {
  const query: string[] = [];
  if (params.projectKeyOrId) query.push(`projectKeyOrId=${params.projectKeyOrId}`);
  if (params.type) query.push(`type=${params.type}`);
  query.push(`maxResults=${params.maxResults || 50}`);

  const res = await agileRequest("GET", `/board?${query.join("&")}`);

  return {
    total: res.total,
    boards: (res.values || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      type: b.type,
      projectKey: b.location?.projectKey,
      projectName: b.location?.projectName,
    })),
  };
}

async function getBoard(params: { boardId: number }): Promise<any> {
  const board = await agileRequest("GET", `/board/${params.boardId}`);

  return {
    id: board.id,
    name: board.name,
    type: board.type,
    self: board.self,
    location: board.location,
  };
}

// --- User Operations ---

async function listUsers(params: {
  query: string;
  maxResults?: number;
}): Promise<any> {
  const res = await jiraRequest(
    "GET",
    `/user/search?query=${encodeURIComponent(params.query)}&maxResults=${params.maxResults || 50}`
  );

  return {
    users: res.map((u: any) => ({
      accountId: u.accountId,
      displayName: u.displayName,
      emailAddress: u.emailAddress,
      active: u.active,
    })),
  };
}

async function getUser(params: { accountId: string }): Promise<any> {
  const user = await jiraRequest("GET", `/user?accountId=${params.accountId}`);

  return {
    accountId: user.accountId,
    displayName: user.displayName,
    emailAddress: user.emailAddress,
    active: user.active,
    timeZone: user.timeZone,
    locale: user.locale,
    avatarUrls: user.avatarUrls,
  };
}

// --- Attachment Operations ---

async function addAttachment(params: {
  issueKey: string;
  filename: string;
  content: string;
}): Promise<any> {
  // Decode base64 content
  const buffer = Buffer.from(params.content, "base64");

  // Create form data boundary
  const boundary = `----FormBoundary${Date.now()}`;

  // Build multipart form data manually
  const formParts = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${params.filename}"`,
    "Content-Type: application/octet-stream",
    "",
    buffer.toString("binary"),
    `--${boundary}--`,
  ];

  const formBody = formParts.join("\r\n");

  const url = `${config.baseUrl}/rest/api/3/issue/${params.issueKey}/attachments`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "X-Atlassian-Token": "no-check",
    },
    body: formBody,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ errorMessages: [res.statusText] }));
    throw new Error(error.errorMessages?.join(", ") || error.message || res.statusText);
  }

  const attachments = await res.json();

  return {
    attachments: attachments.map((a: any) => ({
      id: a.id,
      filename: a.filename,
      size: a.size,
      mimeType: a.mimeType,
      created: a.created,
    })),
  };
}

// --- Issue Link Operations ---

async function linkIssues(params: {
  inwardIssue: string;
  outwardIssue: string;
  linkType: string;
}): Promise<any> {
  await jiraRequest("POST", "/issueLink", {
    type: { name: params.linkType },
    inwardIssue: { key: params.inwardIssue },
    outwardIssue: { key: params.outwardIssue },
  });

  return {
    inwardIssue: params.inwardIssue,
    outwardIssue: params.outwardIssue,
    linkType: params.linkType,
    linked: true,
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "jira-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // Issue Operations
      case "search_issues":
        result = await searchIssues(args as any);
        break;
      case "get_issue":
        result = await getIssue(args as any);
        break;
      case "create_issue":
        result = await createIssue(args as any);
        break;
      case "update_issue":
        result = await updateIssue(args as any);
        break;
      case "delete_issue":
        result = await deleteIssue(args as any);
        break;

      // Comment Operations
      case "add_comment":
        result = await addComment(args as any);
        break;
      case "list_comments":
        result = await listComments(args as any);
        break;

      // Transition Operations
      case "transition_issue":
        result = await transitionIssue(args as any);
        break;

      // Assignment
      case "assign_issue":
        result = await assignIssue(args as any);
        break;

      // Project Operations
      case "list_projects":
        result = await listProjects(args as any);
        break;
      case "get_project":
        result = await getProject(args as any);
        break;

      // Sprint Operations
      case "list_sprints":
        result = await listSprints(args as any);
        break;
      case "get_sprint":
        result = await getSprint(args as any);
        break;
      case "add_to_sprint":
        result = await addToSprint(args as any);
        break;

      // Board Operations
      case "list_boards":
        result = await listBoards(args as any);
        break;
      case "get_board":
        result = await getBoard(args as any);
        break;

      // User Operations
      case "list_users":
        result = await listUsers(args as any);
        break;
      case "get_user":
        result = await getUser(args as any);
        break;

      // Attachment Operations
      case "add_attachment":
        result = await addAttachment(args as any);
        break;

      // Issue Link Operations
      case "link_issues":
        result = await linkIssues(args as any);
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
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: error.message,
          }),
        },
      ],
      isError: true,
    };
  }
});

// =============================================================================
// Main
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Jira MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
