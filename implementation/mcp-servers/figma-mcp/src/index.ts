/**
 * Figma MCP Server - Figma design integration for KOSMOS
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  token: process.env.FIGMA_ACCESS_TOKEN || "",
  apiUrl: "https://api.figma.com/v1",
};

async function figmaRequest(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      "X-Figma-Token": config.token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || error.err || res.statusText);
  }

  return res.json();
}

const TOOLS: Tool[] = [
  // Files
  { name: "get_file", description: "Get Figma file.", inputSchema: { type: "object", properties: { fileKey: { type: "string" }, version: { type: "string" }, depth: { type: "number" } }, required: ["fileKey"] } },
  { name: "get_file_nodes", description: "Get specific nodes from a file.", inputSchema: { type: "object", properties: { fileKey: { type: "string" }, nodeIds: { type: "array", items: { type: "string" } } }, required: ["fileKey", "nodeIds"] } },
  { name: "get_file_versions", description: "Get file version history.", inputSchema: { type: "object", properties: { fileKey: { type: "string" } }, required: ["fileKey"] } },
  // Images
  { name: "get_images", description: "Export nodes as images.", inputSchema: { type: "object", properties: { fileKey: { type: "string" }, nodeIds: { type: "array", items: { type: "string" } }, format: { type: "string", enum: ["jpg", "png", "svg", "pdf"] }, scale: { type: "number" } }, required: ["fileKey", "nodeIds"] } },
  { name: "get_image_fills", description: "Get image URLs for fills.", inputSchema: { type: "object", properties: { fileKey: { type: "string" } }, required: ["fileKey"] } },
  // Comments
  { name: "get_comments", description: "Get file comments.", inputSchema: { type: "object", properties: { fileKey: { type: "string" } }, required: ["fileKey"] } },
  { name: "post_comment", description: "Post a comment.", inputSchema: { type: "object", properties: { fileKey: { type: "string" }, message: { type: "string" }, clientMeta: { type: "object" } }, required: ["fileKey", "message"] } },
  { name: "delete_comment", description: "Delete a comment.", inputSchema: { type: "object", properties: { fileKey: { type: "string" }, commentId: { type: "string" } }, required: ["fileKey", "commentId"] } },
  // Teams & Projects
  { name: "get_team_projects", description: "Get team projects.", inputSchema: { type: "object", properties: { teamId: { type: "string" } }, required: ["teamId"] } },
  { name: "get_project_files", description: "Get project files.", inputSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"] } },
  // Components & Styles
  { name: "get_file_components", description: "Get file components.", inputSchema: { type: "object", properties: { fileKey: { type: "string" } }, required: ["fileKey"] } },
  { name: "get_team_components", description: "Get team component library.", inputSchema: { type: "object", properties: { teamId: { type: "string" } }, required: ["teamId"] } },
  { name: "get_file_styles", description: "Get file styles.", inputSchema: { type: "object", properties: { fileKey: { type: "string" } }, required: ["fileKey"] } },
  { name: "get_team_styles", description: "Get team style library.", inputSchema: { type: "object", properties: { teamId: { type: "string" } }, required: ["teamId"] } },
  // User
  { name: "get_current_user", description: "Get current user.", inputSchema: { type: "object", properties: {} } },
  // Webhooks
  { name: "get_webhooks", description: "Get team webhooks.", inputSchema: { type: "object", properties: { teamId: { type: "string" } }, required: ["teamId"] } },
  { name: "create_webhook", description: "Create a webhook.", inputSchema: { type: "object", properties: { teamId: { type: "string" }, eventType: { type: "string" }, endpoint: { type: "string" }, passcode: { type: "string" } }, required: ["teamId", "eventType", "endpoint", "passcode"] } },
  { name: "delete_webhook", description: "Delete a webhook.", inputSchema: { type: "object", properties: { webhookId: { type: "string" } }, required: ["webhookId"] } },
  // Variables
  { name: "get_local_variables", description: "Get local variables.", inputSchema: { type: "object", properties: { fileKey: { type: "string" } }, required: ["fileKey"] } },
  { name: "get_published_variables", description: "Get published variables.", inputSchema: { type: "object", properties: { fileKey: { type: "string" } }, required: ["fileKey"] } },
];

async function getFile(params: { fileKey: string; version?: string; depth?: number }): Promise<any> {
  const query = new URLSearchParams();
  if (params.version) query.set("version", params.version);
  if (params.depth) query.set("depth", params.depth.toString());
  return figmaRequest("GET", `/files/${params.fileKey}?${query.toString()}`);
}

async function getFileNodes(params: { fileKey: string; nodeIds: string[] }): Promise<any> {
  return figmaRequest("GET", `/files/${params.fileKey}/nodes?ids=${params.nodeIds.join(",")}`);
}

async function getFileVersions(params: { fileKey: string }): Promise<any> {
  return figmaRequest("GET", `/files/${params.fileKey}/versions`);
}

async function getImages(params: { fileKey: string; nodeIds: string[]; format?: string; scale?: number }): Promise<any> {
  const query = new URLSearchParams();
  query.set("ids", params.nodeIds.join(","));
  if (params.format) query.set("format", params.format);
  if (params.scale) query.set("scale", params.scale.toString());
  return figmaRequest("GET", `/images/${params.fileKey}?${query.toString()}`);
}

async function getImageFills(params: { fileKey: string }): Promise<any> {
  return figmaRequest("GET", `/files/${params.fileKey}/images`);
}

async function getComments(params: { fileKey: string }): Promise<any> {
  return figmaRequest("GET", `/files/${params.fileKey}/comments`);
}

async function postComment(params: { fileKey: string; message: string; clientMeta?: any }): Promise<any> {
  return figmaRequest("POST", `/files/${params.fileKey}/comments`, { message: params.message, client_meta: params.clientMeta });
}

async function deleteComment(params: { fileKey: string; commentId: string }): Promise<any> {
  await figmaRequest("DELETE", `/files/${params.fileKey}/comments/${params.commentId}`);
  return { deleted: true };
}

async function getTeamProjects(params: { teamId: string }): Promise<any> {
  return figmaRequest("GET", `/teams/${params.teamId}/projects`);
}

async function getProjectFiles(params: { projectId: string }): Promise<any> {
  return figmaRequest("GET", `/projects/${params.projectId}/files`);
}

async function getFileComponents(params: { fileKey: string }): Promise<any> {
  return figmaRequest("GET", `/files/${params.fileKey}/components`);
}

async function getTeamComponents(params: { teamId: string }): Promise<any> {
  return figmaRequest("GET", `/teams/${params.teamId}/components`);
}

async function getFileStyles(params: { fileKey: string }): Promise<any> {
  return figmaRequest("GET", `/files/${params.fileKey}/styles`);
}

async function getTeamStyles(params: { teamId: string }): Promise<any> {
  return figmaRequest("GET", `/teams/${params.teamId}/styles`);
}

async function getCurrentUser(): Promise<any> {
  return figmaRequest("GET", "/me");
}

async function getWebhooks(params: { teamId: string }): Promise<any> {
  return figmaRequest("GET", `/teams/${params.teamId}/webhooks`);
}

async function createWebhook(params: { teamId: string; eventType: string; endpoint: string; passcode: string }): Promise<any> {
  return figmaRequest("POST", `/webhooks`, { event_type: params.eventType, team_id: params.teamId, endpoint: params.endpoint, passcode: params.passcode });
}

async function deleteWebhook(params: { webhookId: string }): Promise<any> {
  await figmaRequest("DELETE", `/webhooks/${params.webhookId}`);
  return { deleted: true };
}

async function getLocalVariables(params: { fileKey: string }): Promise<any> {
  return figmaRequest("GET", `/files/${params.fileKey}/variables/local`);
}

async function getPublishedVariables(params: { fileKey: string }): Promise<any> {
  return figmaRequest("GET", `/files/${params.fileKey}/variables/published`);
}

const server = new Server({ name: "figma-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "get_file": result = await getFile(args as any); break;
      case "get_file_nodes": result = await getFileNodes(args as any); break;
      case "get_file_versions": result = await getFileVersions(args as any); break;
      case "get_images": result = await getImages(args as any); break;
      case "get_image_fills": result = await getImageFills(args as any); break;
      case "get_comments": result = await getComments(args as any); break;
      case "post_comment": result = await postComment(args as any); break;
      case "delete_comment": result = await deleteComment(args as any); break;
      case "get_team_projects": result = await getTeamProjects(args as any); break;
      case "get_project_files": result = await getProjectFiles(args as any); break;
      case "get_file_components": result = await getFileComponents(args as any); break;
      case "get_team_components": result = await getTeamComponents(args as any); break;
      case "get_file_styles": result = await getFileStyles(args as any); break;
      case "get_team_styles": result = await getTeamStyles(args as any); break;
      case "get_current_user": result = await getCurrentUser(); break;
      case "get_webhooks": result = await getWebhooks(args as any); break;
      case "create_webhook": result = await createWebhook(args as any); break;
      case "delete_webhook": result = await deleteWebhook(args as any); break;
      case "get_local_variables": result = await getLocalVariables(args as any); break;
      case "get_published_variables": result = await getPublishedVariables(args as any); break;
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
  console.error("Figma MCP Server running on stdio");
}

main().catch(console.error);
