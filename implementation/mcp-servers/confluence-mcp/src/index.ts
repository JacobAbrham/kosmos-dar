/**
 * Confluence MCP Server - Wiki and documentation management for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  baseUrl: process.env.CONFLUENCE_BASE_URL || "",
  email: process.env.CONFLUENCE_EMAIL || "",
  apiToken: process.env.CONFLUENCE_API_TOKEN || "",
};

async function confluenceRequest(method: string, path: string, body?: any): Promise<any> {
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  const res = await fetch(`${config.baseUrl}/wiki/api/v2${path}`, {
    method,
    headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json", "Accept": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || res.statusText);
  }
  return res.status === 204 ? {} : res.json();
}

const TOOLS: Tool[] = [
  // Pages
  { name: "create_page", description: "Create a new page.", inputSchema: { type: "object", properties: { spaceId: { type: "string" }, title: { type: "string" }, body: { type: "string" }, parentId: { type: "string" }, status: { type: "string", enum: ["current", "draft"] } }, required: ["spaceId", "title", "body"] } },
  { name: "get_page", description: "Get page details.", inputSchema: { type: "object", properties: { pageId: { type: "string" }, bodyFormat: { type: "string", enum: ["storage", "atlas_doc_format", "view"] } }, required: ["pageId"] } },
  { name: "update_page", description: "Update a page.", inputSchema: { type: "object", properties: { pageId: { type: "string" }, title: { type: "string" }, body: { type: "string" }, version: { type: "number" } }, required: ["pageId", "version"] } },
  { name: "delete_page", description: "Delete a page.", inputSchema: { type: "object", properties: { pageId: { type: "string" } }, required: ["pageId"] } },
  { name: "list_pages", description: "List pages in a space.", inputSchema: { type: "object", properties: { spaceId: { type: "string" }, status: { type: "string" }, limit: { type: "number" }, cursor: { type: "string" } }, required: ["spaceId"] } },
  { name: "search_pages", description: "Search for pages.", inputSchema: { type: "object", properties: { query: { type: "string" }, spaceId: { type: "string" }, limit: { type: "number" } }, required: ["query"] } },
  { name: "get_page_children", description: "Get child pages.", inputSchema: { type: "object", properties: { pageId: { type: "string" }, limit: { type: "number" } }, required: ["pageId"] } },
  // Spaces
  { name: "create_space", description: "Create a new space.", inputSchema: { type: "object", properties: { key: { type: "string" }, name: { type: "string" }, description: { type: "string" }, type: { type: "string", enum: ["global", "personal"] } }, required: ["key", "name"] } },
  { name: "get_space", description: "Get space details.", inputSchema: { type: "object", properties: { spaceId: { type: "string" } }, required: ["spaceId"] } },
  { name: "list_spaces", description: "List all spaces.", inputSchema: { type: "object", properties: { type: { type: "string" }, status: { type: "string" }, limit: { type: "number" } } } },
  { name: "delete_space", description: "Delete a space.", inputSchema: { type: "object", properties: { spaceId: { type: "string" } }, required: ["spaceId"] } },
  // Comments
  { name: "add_comment", description: "Add a comment to a page.", inputSchema: { type: "object", properties: { pageId: { type: "string" }, body: { type: "string" } }, required: ["pageId", "body"] } },
  { name: "list_comments", description: "List page comments.", inputSchema: { type: "object", properties: { pageId: { type: "string" }, limit: { type: "number" } }, required: ["pageId"] } },
  { name: "delete_comment", description: "Delete a comment.", inputSchema: { type: "object", properties: { commentId: { type: "string" } }, required: ["commentId"] } },
  // Labels
  { name: "add_label", description: "Add a label to a page.", inputSchema: { type: "object", properties: { pageId: { type: "string" }, label: { type: "string" } }, required: ["pageId", "label"] } },
  { name: "list_labels", description: "List page labels.", inputSchema: { type: "object", properties: { pageId: { type: "string" } }, required: ["pageId"] } },
  { name: "remove_label", description: "Remove a label from a page.", inputSchema: { type: "object", properties: { pageId: { type: "string" }, labelId: { type: "string" } }, required: ["pageId", "labelId"] } },
  // Attachments
  { name: "list_attachments", description: "List page attachments.", inputSchema: { type: "object", properties: { pageId: { type: "string" } }, required: ["pageId"] } },
  { name: "get_attachment", description: "Get attachment details.", inputSchema: { type: "object", properties: { attachmentId: { type: "string" } }, required: ["attachmentId"] } },
  // Content Properties
  { name: "set_property", description: "Set a content property.", inputSchema: { type: "object", properties: { pageId: { type: "string" }, key: { type: "string" }, value: { type: "object" } }, required: ["pageId", "key", "value"] } },
  { name: "get_property", description: "Get a content property.", inputSchema: { type: "object", properties: { pageId: { type: "string" }, key: { type: "string" } }, required: ["pageId", "key"] } },
  // Versions
  { name: "list_versions", description: "List page versions.", inputSchema: { type: "object", properties: { pageId: { type: "string" }, limit: { type: "number" } }, required: ["pageId"] } },
  { name: "get_version", description: "Get a specific version.", inputSchema: { type: "object", properties: { pageId: { type: "string" }, version: { type: "number" } }, required: ["pageId", "version"] } },
  // Templates
  { name: "list_templates", description: "List space templates.", inputSchema: { type: "object", properties: { spaceId: { type: "string" } } } },
];

async function createPage(params: { spaceId: string; title: string; body: string; parentId?: string; status?: string }): Promise<any> {
  const pageBody: any = {
    spaceId: params.spaceId,
    title: params.title,
    body: { representation: "storage", value: params.body },
    status: params.status || "current",
  };
  if (params.parentId) pageBody.parentId = params.parentId;
  return confluenceRequest("POST", "/pages", pageBody);
}

async function getPage(params: { pageId: string; bodyFormat?: string }): Promise<any> {
  const format = params.bodyFormat || "storage";
  return confluenceRequest("GET", `/pages/${params.pageId}?body-format=${format}`);
}

async function updatePage(params: { pageId: string; title?: string; body?: string; version: number }): Promise<any> {
  const updates: any = { version: { number: params.version + 1 } };
  if (params.title) updates.title = params.title;
  if (params.body) updates.body = { representation: "storage", value: params.body };
  return confluenceRequest("PUT", `/pages/${params.pageId}`, updates);
}

async function deletePage(params: { pageId: string }): Promise<any> {
  await confluenceRequest("DELETE", `/pages/${params.pageId}`);
  return { pageId: params.pageId, deleted: true };
}

async function listPages(params: { spaceId: string; status?: string; limit?: number; cursor?: string }): Promise<any> {
  const query: string[] = [`space-id=${params.spaceId}`];
  if (params.status) query.push(`status=${params.status}`);
  if (params.limit) query.push(`limit=${params.limit}`);
  if (params.cursor) query.push(`cursor=${params.cursor}`);
  const res = await confluenceRequest("GET", `/pages?${query.join("&")}`);
  return { pages: res.results.map((p: any) => ({ id: p.id, title: p.title, status: p.status, version: p.version?.number })), next: res._links?.next };
}

async function searchPages(params: { query: string; spaceId?: string; limit?: number }): Promise<any> {
  const cql = params.spaceId ? `text~"${params.query}" AND space.id=${params.spaceId}` : `text~"${params.query}"`;
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  const res = await fetch(`${config.baseUrl}/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=${params.limit || 25}`, {
    headers: { "Authorization": `Basic ${auth}`, "Accept": "application/json" },
  });
  const data = await res.json();
  return { results: data.results?.map((r: any) => ({ id: r.id, title: r.title, type: r.type, space: r.space?.name })) || [] };
}

async function getPageChildren(params: { pageId: string; limit?: number }): Promise<any> {
  const res = await confluenceRequest("GET", `/pages/${params.pageId}/children?limit=${params.limit || 25}`);
  return { children: res.results.map((c: any) => ({ id: c.id, title: c.title, status: c.status })) };
}

async function createSpace(params: { key: string; name: string; description?: string; type?: string }): Promise<any> {
  return confluenceRequest("POST", "/spaces", {
    key: params.key,
    name: params.name,
    description: params.description ? { plain: { value: params.description, representation: "plain" } } : undefined,
    type: params.type || "global",
  });
}

async function getSpace(params: { spaceId: string }): Promise<any> {
  return confluenceRequest("GET", `/spaces/${params.spaceId}`);
}

async function listSpaces(params: { type?: string; status?: string; limit?: number }): Promise<any> {
  const query: string[] = [];
  if (params.type) query.push(`type=${params.type}`);
  if (params.status) query.push(`status=${params.status}`);
  if (params.limit) query.push(`limit=${params.limit}`);
  const queryStr = query.length ? `?${query.join("&")}` : "";
  const res = await confluenceRequest("GET", `/spaces${queryStr}`);
  return { spaces: res.results.map((s: any) => ({ id: s.id, key: s.key, name: s.name, type: s.type, status: s.status })) };
}

async function deleteSpace(params: { spaceId: string }): Promise<any> {
  await confluenceRequest("DELETE", `/spaces/${params.spaceId}`);
  return { spaceId: params.spaceId, deleted: true };
}

async function addComment(params: { pageId: string; body: string }): Promise<any> {
  return confluenceRequest("POST", `/pages/${params.pageId}/footer-comments`, {
    body: { representation: "storage", value: params.body },
  });
}

async function listComments(params: { pageId: string; limit?: number }): Promise<any> {
  const res = await confluenceRequest("GET", `/pages/${params.pageId}/footer-comments?limit=${params.limit || 25}`);
  return { comments: res.results.map((c: any) => ({ id: c.id, body: c.body, version: c.version?.number, createdAt: c.createdAt })) };
}

async function deleteComment(params: { commentId: string }): Promise<any> {
  await confluenceRequest("DELETE", `/footer-comments/${params.commentId}`);
  return { commentId: params.commentId, deleted: true };
}

async function addLabel(params: { pageId: string; label: string }): Promise<any> {
  return confluenceRequest("POST", `/pages/${params.pageId}/labels`, [{ name: params.label }]);
}

async function listLabels(params: { pageId: string }): Promise<any> {
  const res = await confluenceRequest("GET", `/pages/${params.pageId}/labels`);
  return { labels: res.results.map((l: any) => ({ id: l.id, name: l.name, prefix: l.prefix })) };
}

async function removeLabel(params: { pageId: string; labelId: string }): Promise<any> {
  await confluenceRequest("DELETE", `/pages/${params.pageId}/labels/${params.labelId}`);
  return { labelId: params.labelId, removed: true };
}

async function listAttachments(params: { pageId: string }): Promise<any> {
  const res = await confluenceRequest("GET", `/pages/${params.pageId}/attachments`);
  return { attachments: res.results.map((a: any) => ({ id: a.id, title: a.title, mediaType: a.mediaType, fileSize: a.fileSize })) };
}

async function getAttachment(params: { attachmentId: string }): Promise<any> {
  return confluenceRequest("GET", `/attachments/${params.attachmentId}`);
}

async function setProperty(params: { pageId: string; key: string; value: any }): Promise<any> {
  return confluenceRequest("POST", `/pages/${params.pageId}/properties`, {
    key: params.key,
    value: params.value,
  });
}

async function getProperty(params: { pageId: string; key: string }): Promise<any> {
  return confluenceRequest("GET", `/pages/${params.pageId}/properties/${params.key}`);
}

async function listVersions(params: { pageId: string; limit?: number }): Promise<any> {
  const res = await confluenceRequest("GET", `/pages/${params.pageId}/versions?limit=${params.limit || 25}`);
  return { versions: res.results.map((v: any) => ({ number: v.number, message: v.message, createdAt: v.createdAt, authorId: v.authorId })) };
}

async function getVersion(params: { pageId: string; version: number }): Promise<any> {
  return confluenceRequest("GET", `/pages/${params.pageId}/versions/${params.version}`);
}

async function listTemplates(params: { spaceId?: string }): Promise<any> {
  const path = params.spaceId ? `/spaces/${params.spaceId}/templates` : "/templates";
  const res = await confluenceRequest("GET", path);
  return { templates: res.results?.map((t: any) => ({ id: t.id, name: t.name, description: t.description })) || [] };
}

const server = new Server({ name: "confluence-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "create_page": result = await createPage(args as any); break;
      case "get_page": result = await getPage(args as any); break;
      case "update_page": result = await updatePage(args as any); break;
      case "delete_page": result = await deletePage(args as any); break;
      case "list_pages": result = await listPages(args as any); break;
      case "search_pages": result = await searchPages(args as any); break;
      case "get_page_children": result = await getPageChildren(args as any); break;
      case "create_space": result = await createSpace(args as any); break;
      case "get_space": result = await getSpace(args as any); break;
      case "list_spaces": result = await listSpaces(args as any); break;
      case "delete_space": result = await deleteSpace(args as any); break;
      case "add_comment": result = await addComment(args as any); break;
      case "list_comments": result = await listComments(args as any); break;
      case "delete_comment": result = await deleteComment(args as any); break;
      case "add_label": result = await addLabel(args as any); break;
      case "list_labels": result = await listLabels(args as any); break;
      case "remove_label": result = await removeLabel(args as any); break;
      case "list_attachments": result = await listAttachments(args as any); break;
      case "get_attachment": result = await getAttachment(args as any); break;
      case "set_property": result = await setProperty(args as any); break;
      case "get_property": result = await getProperty(args as any); break;
      case "list_versions": result = await listVersions(args as any); break;
      case "get_version": result = await getVersion(args as any); break;
      case "list_templates": result = await listTemplates(args as any); break;
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
  console.error("Confluence MCP Server running on stdio");
}

main().catch(console.error);
