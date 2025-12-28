/**
 * GitLab MCP Server - GitLab API integration for KOSMOS
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  baseUrl: process.env.GITLAB_URL || "https://gitlab.com",
  token: process.env.GITLAB_TOKEN || "",
};

async function gitlabRequest(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${config.baseUrl}/api/v4${path}`, {
    method,
    headers: {
      "PRIVATE-TOKEN": config.token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || res.statusText);
  }

  return res.status === 204 ? {} : res.json();
}

const TOOLS: Tool[] = [
  // Projects
  { name: "list_projects", description: "List projects.", inputSchema: { type: "object", properties: { owned: { type: "boolean" }, membership: { type: "boolean" }, search: { type: "string" }, perPage: { type: "number" } } } },
  { name: "get_project", description: "Get project details.", inputSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"] } },
  { name: "create_project", description: "Create a project.", inputSchema: { type: "object", properties: { name: { type: "string" }, path: { type: "string" }, description: { type: "string" }, visibility: { type: "string" }, namespaceId: { type: "number" } }, required: ["name"] } },
  { name: "delete_project", description: "Delete a project.", inputSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"] } },
  // Merge Requests
  { name: "list_merge_requests", description: "List merge requests.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, state: { type: "string" }, scope: { type: "string" } }, required: ["projectId"] } },
  { name: "get_merge_request", description: "Get merge request details.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, mrIid: { type: "number" } }, required: ["projectId", "mrIid"] } },
  { name: "create_merge_request", description: "Create a merge request.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, sourceBranch: { type: "string" }, targetBranch: { type: "string" }, title: { type: "string" }, description: { type: "string" } }, required: ["projectId", "sourceBranch", "targetBranch", "title"] } },
  { name: "merge_merge_request", description: "Merge a merge request.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, mrIid: { type: "number" }, squash: { type: "boolean" }, removeSourceBranch: { type: "boolean" } }, required: ["projectId", "mrIid"] } },
  // Issues
  { name: "list_issues", description: "List issues.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, state: { type: "string" }, labels: { type: "string" } }, required: ["projectId"] } },
  { name: "get_issue", description: "Get issue details.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, issueIid: { type: "number" } }, required: ["projectId", "issueIid"] } },
  { name: "create_issue", description: "Create an issue.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, title: { type: "string" }, description: { type: "string" }, labels: { type: "string" }, assigneeIds: { type: "array", items: { type: "number" } } }, required: ["projectId", "title"] } },
  { name: "update_issue", description: "Update an issue.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, issueIid: { type: "number" }, title: { type: "string" }, state: { type: "string" }, labels: { type: "string" } }, required: ["projectId", "issueIid"] } },
  // Branches
  { name: "list_branches", description: "List branches.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, search: { type: "string" } }, required: ["projectId"] } },
  { name: "create_branch", description: "Create a branch.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, branch: { type: "string" }, ref: { type: "string" } }, required: ["projectId", "branch", "ref"] } },
  { name: "delete_branch", description: "Delete a branch.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, branch: { type: "string" } }, required: ["projectId", "branch"] } },
  // Pipelines
  { name: "list_pipelines", description: "List pipelines.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, status: { type: "string" }, ref: { type: "string" } }, required: ["projectId"] } },
  { name: "get_pipeline", description: "Get pipeline details.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, pipelineId: { type: "number" } }, required: ["projectId", "pipelineId"] } },
  { name: "create_pipeline", description: "Create/trigger a pipeline.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, ref: { type: "string" }, variables: { type: "array" } }, required: ["projectId", "ref"] } },
  { name: "retry_pipeline", description: "Retry a pipeline.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, pipelineId: { type: "number" } }, required: ["projectId", "pipelineId"] } },
  { name: "cancel_pipeline", description: "Cancel a pipeline.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, pipelineId: { type: "number" } }, required: ["projectId", "pipelineId"] } },
  // Jobs
  { name: "list_jobs", description: "List pipeline jobs.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, pipelineId: { type: "number" } }, required: ["projectId", "pipelineId"] } },
  { name: "get_job_log", description: "Get job log.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, jobId: { type: "number" } }, required: ["projectId", "jobId"] } },
  { name: "retry_job", description: "Retry a job.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, jobId: { type: "number" } }, required: ["projectId", "jobId"] } },
  // Files
  { name: "get_file", description: "Get file content.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, filePath: { type: "string" }, ref: { type: "string" } }, required: ["projectId", "filePath"] } },
  { name: "create_file", description: "Create a file.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, filePath: { type: "string" }, branch: { type: "string" }, content: { type: "string" }, commitMessage: { type: "string" } }, required: ["projectId", "filePath", "branch", "content", "commitMessage"] } },
  // Users
  { name: "get_current_user", description: "Get current user.", inputSchema: { type: "object", properties: {} } },
  { name: "list_users", description: "List users.", inputSchema: { type: "object", properties: { search: { type: "string" }, perPage: { type: "number" } } } },
];

async function listProjects(params: { owned?: boolean; membership?: boolean; search?: string; perPage?: number }): Promise<any> {
  const query = new URLSearchParams();
  if (params.owned) query.set("owned", "true");
  if (params.membership) query.set("membership", "true");
  if (params.search) query.set("search", params.search);
  if (params.perPage) query.set("per_page", params.perPage.toString());
  const result = await gitlabRequest("GET", `/projects?${query.toString()}`);
  return { projects: result.map((p: any) => ({ id: p.id, name: p.name, path: p.path_with_namespace, visibility: p.visibility, webUrl: p.web_url })) };
}

async function getProject(params: { projectId: string }): Promise<any> {
  return gitlabRequest("GET", `/projects/${encodeURIComponent(params.projectId)}`);
}

async function createProject(params: { name: string; path?: string; description?: string; visibility?: string; namespaceId?: number }): Promise<any> {
  return gitlabRequest("POST", "/projects", { name: params.name, path: params.path, description: params.description, visibility: params.visibility || "private", namespace_id: params.namespaceId });
}

async function deleteProject(params: { projectId: string }): Promise<any> {
  await gitlabRequest("DELETE", `/projects/${encodeURIComponent(params.projectId)}`);
  return { deleted: true };
}

async function listMergeRequests(params: { projectId: string; state?: string; scope?: string }): Promise<any> {
  const query = new URLSearchParams();
  if (params.state) query.set("state", params.state);
  if (params.scope) query.set("scope", params.scope);
  return gitlabRequest("GET", `/projects/${encodeURIComponent(params.projectId)}/merge_requests?${query.toString()}`);
}

async function getMergeRequest(params: { projectId: string; mrIid: number }): Promise<any> {
  return gitlabRequest("GET", `/projects/${encodeURIComponent(params.projectId)}/merge_requests/${params.mrIid}`);
}

async function createMergeRequest(params: { projectId: string; sourceBranch: string; targetBranch: string; title: string; description?: string }): Promise<any> {
  return gitlabRequest("POST", `/projects/${encodeURIComponent(params.projectId)}/merge_requests`, { source_branch: params.sourceBranch, target_branch: params.targetBranch, title: params.title, description: params.description });
}

async function mergeMergeRequest(params: { projectId: string; mrIid: number; squash?: boolean; removeSourceBranch?: boolean }): Promise<any> {
  return gitlabRequest("PUT", `/projects/${encodeURIComponent(params.projectId)}/merge_requests/${params.mrIid}/merge`, { squash: params.squash, should_remove_source_branch: params.removeSourceBranch });
}

async function listIssues(params: { projectId: string; state?: string; labels?: string }): Promise<any> {
  const query = new URLSearchParams();
  if (params.state) query.set("state", params.state);
  if (params.labels) query.set("labels", params.labels);
  return gitlabRequest("GET", `/projects/${encodeURIComponent(params.projectId)}/issues?${query.toString()}`);
}

async function getIssue(params: { projectId: string; issueIid: number }): Promise<any> {
  return gitlabRequest("GET", `/projects/${encodeURIComponent(params.projectId)}/issues/${params.issueIid}`);
}

async function createIssue(params: { projectId: string; title: string; description?: string; labels?: string; assigneeIds?: number[] }): Promise<any> {
  return gitlabRequest("POST", `/projects/${encodeURIComponent(params.projectId)}/issues`, { title: params.title, description: params.description, labels: params.labels, assignee_ids: params.assigneeIds });
}

async function updateIssue(params: { projectId: string; issueIid: number; title?: string; state?: string; labels?: string }): Promise<any> {
  return gitlabRequest("PUT", `/projects/${encodeURIComponent(params.projectId)}/issues/${params.issueIid}`, { title: params.title, state_event: params.state, labels: params.labels });
}

async function listBranches(params: { projectId: string; search?: string }): Promise<any> {
  const query = params.search ? `?search=${params.search}` : "";
  return gitlabRequest("GET", `/projects/${encodeURIComponent(params.projectId)}/repository/branches${query}`);
}

async function createBranch(params: { projectId: string; branch: string; ref: string }): Promise<any> {
  return gitlabRequest("POST", `/projects/${encodeURIComponent(params.projectId)}/repository/branches`, { branch: params.branch, ref: params.ref });
}

async function deleteBranch(params: { projectId: string; branch: string }): Promise<any> {
  await gitlabRequest("DELETE", `/projects/${encodeURIComponent(params.projectId)}/repository/branches/${encodeURIComponent(params.branch)}`);
  return { deleted: true };
}

async function listPipelines(params: { projectId: string; status?: string; ref?: string }): Promise<any> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.ref) query.set("ref", params.ref);
  return gitlabRequest("GET", `/projects/${encodeURIComponent(params.projectId)}/pipelines?${query.toString()}`);
}

async function getPipeline(params: { projectId: string; pipelineId: number }): Promise<any> {
  return gitlabRequest("GET", `/projects/${encodeURIComponent(params.projectId)}/pipelines/${params.pipelineId}`);
}

async function createPipeline(params: { projectId: string; ref: string; variables?: any[] }): Promise<any> {
  return gitlabRequest("POST", `/projects/${encodeURIComponent(params.projectId)}/pipeline`, { ref: params.ref, variables: params.variables });
}

async function retryPipeline(params: { projectId: string; pipelineId: number }): Promise<any> {
  return gitlabRequest("POST", `/projects/${encodeURIComponent(params.projectId)}/pipelines/${params.pipelineId}/retry`);
}

async function cancelPipeline(params: { projectId: string; pipelineId: number }): Promise<any> {
  return gitlabRequest("POST", `/projects/${encodeURIComponent(params.projectId)}/pipelines/${params.pipelineId}/cancel`);
}

async function listJobs(params: { projectId: string; pipelineId: number }): Promise<any> {
  return gitlabRequest("GET", `/projects/${encodeURIComponent(params.projectId)}/pipelines/${params.pipelineId}/jobs`);
}

async function getJobLog(params: { projectId: string; jobId: number }): Promise<any> {
  const res = await fetch(`${config.baseUrl}/api/v4/projects/${encodeURIComponent(params.projectId)}/jobs/${params.jobId}/trace`, {
    headers: { "PRIVATE-TOKEN": config.token },
  });
  return { log: await res.text() };
}

async function retryJob(params: { projectId: string; jobId: number }): Promise<any> {
  return gitlabRequest("POST", `/projects/${encodeURIComponent(params.projectId)}/jobs/${params.jobId}/retry`);
}

async function getFile(params: { projectId: string; filePath: string; ref?: string }): Promise<any> {
  const query = params.ref ? `?ref=${params.ref}` : "";
  const result = await gitlabRequest("GET", `/projects/${encodeURIComponent(params.projectId)}/repository/files/${encodeURIComponent(params.filePath)}${query}`);
  return { ...result, content: Buffer.from(result.content, "base64").toString() };
}

async function createFile(params: { projectId: string; filePath: string; branch: string; content: string; commitMessage: string }): Promise<any> {
  return gitlabRequest("POST", `/projects/${encodeURIComponent(params.projectId)}/repository/files/${encodeURIComponent(params.filePath)}`, { branch: params.branch, content: params.content, commit_message: params.commitMessage });
}

async function getCurrentUser(): Promise<any> {
  return gitlabRequest("GET", "/user");
}

async function listUsers(params: { search?: string; perPage?: number }): Promise<any> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.perPage) query.set("per_page", params.perPage.toString());
  return gitlabRequest("GET", `/users?${query.toString()}`);
}

const server = new Server({ name: "gitlab-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "list_projects": result = await listProjects(args as any); break;
      case "get_project": result = await getProject(args as any); break;
      case "create_project": result = await createProject(args as any); break;
      case "delete_project": result = await deleteProject(args as any); break;
      case "list_merge_requests": result = await listMergeRequests(args as any); break;
      case "get_merge_request": result = await getMergeRequest(args as any); break;
      case "create_merge_request": result = await createMergeRequest(args as any); break;
      case "merge_merge_request": result = await mergeMergeRequest(args as any); break;
      case "list_issues": result = await listIssues(args as any); break;
      case "get_issue": result = await getIssue(args as any); break;
      case "create_issue": result = await createIssue(args as any); break;
      case "update_issue": result = await updateIssue(args as any); break;
      case "list_branches": result = await listBranches(args as any); break;
      case "create_branch": result = await createBranch(args as any); break;
      case "delete_branch": result = await deleteBranch(args as any); break;
      case "list_pipelines": result = await listPipelines(args as any); break;
      case "get_pipeline": result = await getPipeline(args as any); break;
      case "create_pipeline": result = await createPipeline(args as any); break;
      case "retry_pipeline": result = await retryPipeline(args as any); break;
      case "cancel_pipeline": result = await cancelPipeline(args as any); break;
      case "list_jobs": result = await listJobs(args as any); break;
      case "get_job_log": result = await getJobLog(args as any); break;
      case "retry_job": result = await retryJob(args as any); break;
      case "get_file": result = await getFile(args as any); break;
      case "create_file": result = await createFile(args as any); break;
      case "get_current_user": result = await getCurrentUser(); break;
      case "list_users": result = await listUsers(args as any); break;
      default: throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GitLab MCP Server running on stdio");
}

main().catch(console.error);
