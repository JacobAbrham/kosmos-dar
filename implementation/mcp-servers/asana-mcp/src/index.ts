/**
 * Asana MCP Server - Task and project management for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  accessToken: process.env.ASANA_ACCESS_TOKEN || "",
  defaultWorkspace: process.env.ASANA_WORKSPACE_ID || "",
};

async function asanaRequest(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`https://app.asana.com/api/1.0${path}`, {
    method,
    headers: { "Authorization": `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify({ data: body }) : undefined,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ errors: [{ message: res.statusText }] }));
    throw new Error(error.errors?.[0]?.message || res.statusText);
  }
  const data = await res.json();
  return data.data;
}

const TOOLS: Tool[] = [
  // Tasks
  { name: "create_task", description: "Create a new task.", inputSchema: { type: "object", properties: { name: { type: "string" }, projectId: { type: "string" }, assignee: { type: "string" }, dueOn: { type: "string" }, notes: { type: "string" }, tags: { type: "array", items: { type: "string" } }, parentTaskId: { type: "string" } }, required: ["name"] } },
  { name: "get_task", description: "Get task details.", inputSchema: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] } },
  { name: "update_task", description: "Update a task.", inputSchema: { type: "object", properties: { taskId: { type: "string" }, name: { type: "string" }, assignee: { type: "string" }, dueOn: { type: "string" }, notes: { type: "string" }, completed: { type: "boolean" } }, required: ["taskId"] } },
  { name: "delete_task", description: "Delete a task.", inputSchema: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] } },
  { name: "list_tasks", description: "List tasks in a project.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, assignee: { type: "string" }, completedSince: { type: "string" }, modifiedSince: { type: "string" }, limit: { type: "number" } } } },
  { name: "search_tasks", description: "Search for tasks.", inputSchema: { type: "object", properties: { workspaceId: { type: "string" }, text: { type: "string" }, assignee: { type: "string" }, projectId: { type: "string" }, isCompleted: { type: "boolean" }, limit: { type: "number" } }, required: ["text"] } },
  { name: "add_task_to_project", description: "Add a task to a project.", inputSchema: { type: "object", properties: { taskId: { type: "string" }, projectId: { type: "string" }, sectionId: { type: "string" } }, required: ["taskId", "projectId"] } },
  { name: "remove_task_from_project", description: "Remove a task from a project.", inputSchema: { type: "object", properties: { taskId: { type: "string" }, projectId: { type: "string" } }, required: ["taskId", "projectId"] } },
  { name: "get_subtasks", description: "Get subtasks of a task.", inputSchema: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] } },
  { name: "set_task_dependencies", description: "Set task dependencies.", inputSchema: { type: "object", properties: { taskId: { type: "string" }, dependsOn: { type: "array", items: { type: "string" } } }, required: ["taskId", "dependsOn"] } },
  // Projects
  { name: "create_project", description: "Create a new project.", inputSchema: { type: "object", properties: { name: { type: "string" }, workspaceId: { type: "string" }, teamId: { type: "string" }, notes: { type: "string" }, color: { type: "string" }, defaultView: { type: "string", enum: ["list", "board", "calendar", "timeline"] } }, required: ["name"] } },
  { name: "get_project", description: "Get project details.", inputSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"] } },
  { name: "update_project", description: "Update a project.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, name: { type: "string" }, notes: { type: "string" }, color: { type: "string" }, archived: { type: "boolean" } }, required: ["projectId"] } },
  { name: "delete_project", description: "Delete a project.", inputSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"] } },
  { name: "list_projects", description: "List projects.", inputSchema: { type: "object", properties: { workspaceId: { type: "string" }, teamId: { type: "string" }, archived: { type: "boolean" }, limit: { type: "number" } } } },
  // Sections
  { name: "create_section", description: "Create a section in a project.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, name: { type: "string" } }, required: ["projectId", "name"] } },
  { name: "list_sections", description: "List sections in a project.", inputSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"] } },
  { name: "move_task_to_section", description: "Move a task to a section.", inputSchema: { type: "object", properties: { taskId: { type: "string" }, sectionId: { type: "string" } }, required: ["taskId", "sectionId"] } },
  // Comments (Stories)
  { name: "add_comment", description: "Add a comment to a task.", inputSchema: { type: "object", properties: { taskId: { type: "string" }, text: { type: "string" } }, required: ["taskId", "text"] } },
  { name: "list_comments", description: "List task comments.", inputSchema: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] } },
  // Tags
  { name: "create_tag", description: "Create a tag.", inputSchema: { type: "object", properties: { name: { type: "string" }, workspaceId: { type: "string" }, color: { type: "string" } }, required: ["name"] } },
  { name: "list_tags", description: "List tags.", inputSchema: { type: "object", properties: { workspaceId: { type: "string" } } } },
  { name: "add_tag_to_task", description: "Add a tag to a task.", inputSchema: { type: "object", properties: { taskId: { type: "string" }, tagId: { type: "string" } }, required: ["taskId", "tagId"] } },
  { name: "remove_tag_from_task", description: "Remove a tag from a task.", inputSchema: { type: "object", properties: { taskId: { type: "string" }, tagId: { type: "string" } }, required: ["taskId", "tagId"] } },
  // Teams
  { name: "list_teams", description: "List teams.", inputSchema: { type: "object", properties: { workspaceId: { type: "string" } } } },
  { name: "get_team", description: "Get team details.", inputSchema: { type: "object", properties: { teamId: { type: "string" } }, required: ["teamId"] } },
  // Users
  { name: "get_me", description: "Get current user.", inputSchema: { type: "object", properties: {} } },
  { name: "list_users", description: "List workspace users.", inputSchema: { type: "object", properties: { workspaceId: { type: "string" } } } },
  // Workspaces
  { name: "list_workspaces", description: "List workspaces.", inputSchema: { type: "object", properties: {} } },
];

async function createTask(params: { name: string; projectId?: string; assignee?: string; dueOn?: string; notes?: string; tags?: string[]; parentTaskId?: string }): Promise<any> {
  const body: any = { name: params.name };
  if (params.projectId) body.projects = [params.projectId];
  if (params.assignee) body.assignee = params.assignee;
  if (params.dueOn) body.due_on = params.dueOn;
  if (params.notes) body.notes = params.notes;
  if (params.tags) body.tags = params.tags;
  if (params.parentTaskId) body.parent = params.parentTaskId;
  else body.workspace = config.defaultWorkspace;
  return asanaRequest("POST", "/tasks", body);
}

async function getTask(params: { taskId: string }): Promise<any> {
  return asanaRequest("GET", `/tasks/${params.taskId}`);
}

async function updateTask(params: { taskId: string; name?: string; assignee?: string; dueOn?: string; notes?: string; completed?: boolean }): Promise<any> {
  const body: any = {};
  if (params.name) body.name = params.name;
  if (params.assignee !== undefined) body.assignee = params.assignee;
  if (params.dueOn) body.due_on = params.dueOn;
  if (params.notes) body.notes = params.notes;
  if (params.completed !== undefined) body.completed = params.completed;
  return asanaRequest("PUT", `/tasks/${params.taskId}`, body);
}

async function deleteTask(params: { taskId: string }): Promise<any> {
  await asanaRequest("DELETE", `/tasks/${params.taskId}`);
  return { taskId: params.taskId, deleted: true };
}

async function listTasks(params: { projectId?: string; assignee?: string; completedSince?: string; modifiedSince?: string; limit?: number }): Promise<any> {
  const query: string[] = [];
  if (params.projectId) query.push(`project=${params.projectId}`);
  if (params.assignee) query.push(`assignee=${params.assignee}`);
  if (params.completedSince) query.push(`completed_since=${params.completedSince}`);
  if (params.modifiedSince) query.push(`modified_since=${params.modifiedSince}`);
  if (params.limit) query.push(`limit=${params.limit}`);
  query.push("opt_fields=name,completed,due_on,assignee.name");
  return asanaRequest("GET", `/tasks?${query.join("&")}`);
}

async function searchTasks(params: { text: string; workspaceId?: string; assignee?: string; projectId?: string; isCompleted?: boolean; limit?: number }): Promise<any> {
  const workspace = params.workspaceId || config.defaultWorkspace;
  const query: string[] = [`text=${encodeURIComponent(params.text)}`];
  if (params.assignee) query.push(`assignee.any=${params.assignee}`);
  if (params.projectId) query.push(`projects.any=${params.projectId}`);
  if (params.isCompleted !== undefined) query.push(`completed=${params.isCompleted}`);
  if (params.limit) query.push(`limit=${params.limit}`);
  return asanaRequest("GET", `/workspaces/${workspace}/tasks/search?${query.join("&")}`);
}

async function addTaskToProject(params: { taskId: string; projectId: string; sectionId?: string }): Promise<any> {
  const body: any = { project: params.projectId };
  if (params.sectionId) body.section = params.sectionId;
  await asanaRequest("POST", `/tasks/${params.taskId}/addProject`, body);
  return { taskId: params.taskId, projectId: params.projectId, added: true };
}

async function removeTaskFromProject(params: { taskId: string; projectId: string }): Promise<any> {
  await asanaRequest("POST", `/tasks/${params.taskId}/removeProject`, { project: params.projectId });
  return { taskId: params.taskId, projectId: params.projectId, removed: true };
}

async function getSubtasks(params: { taskId: string }): Promise<any> {
  return asanaRequest("GET", `/tasks/${params.taskId}/subtasks?opt_fields=name,completed,due_on`);
}

async function setTaskDependencies(params: { taskId: string; dependsOn: string[] }): Promise<any> {
  await asanaRequest("POST", `/tasks/${params.taskId}/addDependencies`, { dependencies: params.dependsOn });
  return { taskId: params.taskId, dependencies: params.dependsOn };
}

async function createProject(params: { name: string; workspaceId?: string; teamId?: string; notes?: string; color?: string; defaultView?: string }): Promise<any> {
  const body: any = { name: params.name, workspace: params.workspaceId || config.defaultWorkspace };
  if (params.teamId) body.team = params.teamId;
  if (params.notes) body.notes = params.notes;
  if (params.color) body.color = params.color;
  if (params.defaultView) body.default_view = params.defaultView;
  return asanaRequest("POST", "/projects", body);
}

async function getProject(params: { projectId: string }): Promise<any> {
  return asanaRequest("GET", `/projects/${params.projectId}`);
}

async function updateProject(params: { projectId: string; name?: string; notes?: string; color?: string; archived?: boolean }): Promise<any> {
  const body: any = {};
  if (params.name) body.name = params.name;
  if (params.notes) body.notes = params.notes;
  if (params.color) body.color = params.color;
  if (params.archived !== undefined) body.archived = params.archived;
  return asanaRequest("PUT", `/projects/${params.projectId}`, body);
}

async function deleteProject(params: { projectId: string }): Promise<any> {
  await asanaRequest("DELETE", `/projects/${params.projectId}`);
  return { projectId: params.projectId, deleted: true };
}

async function listProjects(params: { workspaceId?: string; teamId?: string; archived?: boolean; limit?: number }): Promise<any> {
  const query: string[] = [];
  if (params.workspaceId) query.push(`workspace=${params.workspaceId}`);
  else if (config.defaultWorkspace) query.push(`workspace=${config.defaultWorkspace}`);
  if (params.teamId) query.push(`team=${params.teamId}`);
  if (params.archived !== undefined) query.push(`archived=${params.archived}`);
  if (params.limit) query.push(`limit=${params.limit}`);
  query.push("opt_fields=name,archived,color");
  return asanaRequest("GET", `/projects?${query.join("&")}`);
}

async function createSection(params: { projectId: string; name: string }): Promise<any> {
  return asanaRequest("POST", `/projects/${params.projectId}/sections`, { name: params.name });
}

async function listSections(params: { projectId: string }): Promise<any> {
  return asanaRequest("GET", `/projects/${params.projectId}/sections`);
}

async function moveTaskToSection(params: { taskId: string; sectionId: string }): Promise<any> {
  await asanaRequest("POST", `/sections/${params.sectionId}/addTask`, { task: params.taskId });
  return { taskId: params.taskId, sectionId: params.sectionId, moved: true };
}

async function addComment(params: { taskId: string; text: string }): Promise<any> {
  return asanaRequest("POST", `/tasks/${params.taskId}/stories`, { text: params.text });
}

async function listComments(params: { taskId: string }): Promise<any> {
  const stories = await asanaRequest("GET", `/tasks/${params.taskId}/stories`);
  return stories.filter((s: any) => s.type === "comment");
}

async function createTag(params: { name: string; workspaceId?: string; color?: string }): Promise<any> {
  const body: any = { name: params.name, workspace: params.workspaceId || config.defaultWorkspace };
  if (params.color) body.color = params.color;
  return asanaRequest("POST", "/tags", body);
}

async function listTags(params: { workspaceId?: string }): Promise<any> {
  const workspace = params.workspaceId || config.defaultWorkspace;
  return asanaRequest("GET", `/workspaces/${workspace}/tags`);
}

async function addTagToTask(params: { taskId: string; tagId: string }): Promise<any> {
  await asanaRequest("POST", `/tasks/${params.taskId}/addTag`, { tag: params.tagId });
  return { taskId: params.taskId, tagId: params.tagId, added: true };
}

async function removeTagFromTask(params: { taskId: string; tagId: string }): Promise<any> {
  await asanaRequest("POST", `/tasks/${params.taskId}/removeTag`, { tag: params.tagId });
  return { taskId: params.taskId, tagId: params.tagId, removed: true };
}

async function listTeams(params: { workspaceId?: string }): Promise<any> {
  const workspace = params.workspaceId || config.defaultWorkspace;
  return asanaRequest("GET", `/organizations/${workspace}/teams`);
}

async function getTeam(params: { teamId: string }): Promise<any> {
  return asanaRequest("GET", `/teams/${params.teamId}`);
}

async function getMe(): Promise<any> {
  return asanaRequest("GET", "/users/me");
}

async function listUsers(params: { workspaceId?: string }): Promise<any> {
  const workspace = params.workspaceId || config.defaultWorkspace;
  return asanaRequest("GET", `/workspaces/${workspace}/users?opt_fields=name,email`);
}

async function listWorkspaces(): Promise<any> {
  return asanaRequest("GET", "/workspaces");
}

const server = new Server({ name: "asana-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "create_task": result = await createTask(args as any); break;
      case "get_task": result = await getTask(args as any); break;
      case "update_task": result = await updateTask(args as any); break;
      case "delete_task": result = await deleteTask(args as any); break;
      case "list_tasks": result = await listTasks(args as any); break;
      case "search_tasks": result = await searchTasks(args as any); break;
      case "add_task_to_project": result = await addTaskToProject(args as any); break;
      case "remove_task_from_project": result = await removeTaskFromProject(args as any); break;
      case "get_subtasks": result = await getSubtasks(args as any); break;
      case "set_task_dependencies": result = await setTaskDependencies(args as any); break;
      case "create_project": result = await createProject(args as any); break;
      case "get_project": result = await getProject(args as any); break;
      case "update_project": result = await updateProject(args as any); break;
      case "delete_project": result = await deleteProject(args as any); break;
      case "list_projects": result = await listProjects(args as any); break;
      case "create_section": result = await createSection(args as any); break;
      case "list_sections": result = await listSections(args as any); break;
      case "move_task_to_section": result = await moveTaskToSection(args as any); break;
      case "add_comment": result = await addComment(args as any); break;
      case "list_comments": result = await listComments(args as any); break;
      case "create_tag": result = await createTag(args as any); break;
      case "list_tags": result = await listTags(args as any); break;
      case "add_tag_to_task": result = await addTagToTask(args as any); break;
      case "remove_tag_from_task": result = await removeTagFromTask(args as any); break;
      case "list_teams": result = await listTeams(args as any); break;
      case "get_team": result = await getTeam(args as any); break;
      case "get_me": result = await getMe(); break;
      case "list_users": result = await listUsers(args as any); break;
      case "list_workspaces": result = await listWorkspaces(); break;
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
  console.error("Asana MCP Server running on stdio");
}

main().catch(console.error);
