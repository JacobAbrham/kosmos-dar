/**
 * Notion MCP Server
 *
 * Provides Notion workspace operations for KOSMOS agents.
 * Features:
 * - Search across pages, databases, and blocks
 * - Create, read, update, archive pages
 * - Query and modify databases
 * - Manage blocks and content
 * - Handle page properties and relations
 * - User and comment management
 *
 * Authentication: Uses NOTION_API_KEY environment variable.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Client } from "@notionhq/client";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  apiKey: process.env.NOTION_API_KEY || "",
};

const notion = new Client({ auth: config.apiKey });

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // ----- Search -----
  {
    name: "search",
    description: "Search across all pages and databases in the workspace.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query text",
        },
        filter: {
          type: "object",
          properties: {
            property: { type: "string", enum: ["object"] },
            value: { type: "string", enum: ["page", "database"] },
          },
          description: "Filter by object type",
        },
        sort: {
          type: "object",
          properties: {
            direction: { type: "string", enum: ["ascending", "descending"] },
            timestamp: { type: "string", enum: ["last_edited_time"] },
          },
          description: "Sort results",
        },
        pageSize: {
          type: "number",
          description: "Number of results (max 100)",
        },
      },
    },
  },

  // ----- Page Operations -----
  {
    name: "get_page",
    description: "Retrieve a page by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The page ID (UUID format)",
        },
      },
      required: ["pageId"],
    },
  },
  {
    name: "create_page",
    description: "Create a new page in a parent page or database.",
    inputSchema: {
      type: "object",
      properties: {
        parentType: {
          type: "string",
          enum: ["page", "database"],
          description: "Type of parent",
        },
        parentId: {
          type: "string",
          description: "Parent page or database ID",
        },
        title: {
          type: "string",
          description: "Page title",
        },
        properties: {
          type: "object",
          description: "Page properties (for database pages)",
        },
        content: {
          type: "array",
          items: { type: "object" },
          description: "Initial content blocks",
        },
        icon: {
          type: "object",
          description: "Page icon (emoji or external URL)",
        },
        cover: {
          type: "object",
          description: "Page cover image",
        },
      },
      required: ["parentType", "parentId"],
    },
  },
  {
    name: "update_page",
    description: "Update page properties, icon, or cover.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The page ID to update",
        },
        properties: {
          type: "object",
          description: "Properties to update",
        },
        icon: {
          type: "object",
          description: "New icon",
        },
        cover: {
          type: "object",
          description: "New cover image",
        },
      },
      required: ["pageId"],
    },
  },
  {
    name: "archive_page",
    description: "Archive or restore a page.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The page ID to archive/restore",
        },
        archived: {
          type: "boolean",
          description: "True to archive, false to restore",
        },
      },
      required: ["pageId", "archived"],
    },
  },

  // ----- Database Operations -----
  {
    name: "list_databases",
    description: "List all databases in the workspace.",
    inputSchema: {
      type: "object",
      properties: {
        pageSize: {
          type: "number",
          description: "Number of results (max 100)",
        },
        startCursor: {
          type: "string",
          description: "Pagination cursor",
        },
      },
    },
  },
  {
    name: "get_database",
    description: "Retrieve a database and its schema.",
    inputSchema: {
      type: "object",
      properties: {
        databaseId: {
          type: "string",
          description: "The database ID",
        },
      },
      required: ["databaseId"],
    },
  },
  {
    name: "create_database",
    description: "Create a new database as a child of a page.",
    inputSchema: {
      type: "object",
      properties: {
        parentPageId: {
          type: "string",
          description: "Parent page ID",
        },
        title: {
          type: "string",
          description: "Database title",
        },
        properties: {
          type: "object",
          description: "Database schema (property definitions)",
        },
        isInline: {
          type: "boolean",
          description: "Create as inline database",
        },
      },
      required: ["parentPageId", "title", "properties"],
    },
  },
  {
    name: "query_database",
    description: "Query a database with filters and sorts.",
    inputSchema: {
      type: "object",
      properties: {
        databaseId: {
          type: "string",
          description: "The database ID",
        },
        filter: {
          type: "object",
          description: "Filter conditions (see Notion filter syntax)",
        },
        sorts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              property: { type: "string" },
              direction: { type: "string", enum: ["ascending", "descending"] },
            },
          },
          description: "Sort order",
        },
        pageSize: {
          type: "number",
          description: "Results per page (max 100)",
        },
        startCursor: {
          type: "string",
          description: "Pagination cursor",
        },
      },
      required: ["databaseId"],
    },
  },
  {
    name: "create_database_item",
    description: "Add a new item (page) to a database.",
    inputSchema: {
      type: "object",
      properties: {
        databaseId: {
          type: "string",
          description: "The database ID",
        },
        properties: {
          type: "object",
          description: "Item properties matching database schema",
        },
        content: {
          type: "array",
          items: { type: "object" },
          description: "Initial content blocks",
        },
        icon: {
          type: "object",
          description: "Item icon",
        },
        cover: {
          type: "object",
          description: "Item cover image",
        },
      },
      required: ["databaseId", "properties"],
    },
  },
  {
    name: "update_database_item",
    description: "Update an item in a database.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "The database item (page) ID",
        },
        properties: {
          type: "object",
          description: "Properties to update",
        },
        icon: {
          type: "object",
          description: "New icon",
        },
        cover: {
          type: "object",
          description: "New cover image",
        },
        archived: {
          type: "boolean",
          description: "Archive or restore the item",
        },
      },
      required: ["pageId"],
    },
  },

  // ----- Block Operations -----
  {
    name: "get_block",
    description: "Get a block by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        blockId: {
          type: "string",
          description: "The block ID",
        },
      },
      required: ["blockId"],
    },
  },
  {
    name: "get_block_children",
    description: "Get all child blocks of a page or block.",
    inputSchema: {
      type: "object",
      properties: {
        blockId: {
          type: "string",
          description: "Block or page ID",
        },
        pageSize: {
          type: "number",
          description: "Results per page (max 100)",
        },
        startCursor: {
          type: "string",
          description: "Pagination cursor",
        },
      },
      required: ["blockId"],
    },
  },
  {
    name: "append_block_children",
    description: "Append new blocks to a page or block.",
    inputSchema: {
      type: "object",
      properties: {
        blockId: {
          type: "string",
          description: "Parent block or page ID",
        },
        children: {
          type: "array",
          items: { type: "object" },
          description: "Block objects to append",
        },
        after: {
          type: "string",
          description: "Block ID to insert after (optional)",
        },
      },
      required: ["blockId", "children"],
    },
  },
  {
    name: "update_block",
    description: "Update a block's content.",
    inputSchema: {
      type: "object",
      properties: {
        blockId: {
          type: "string",
          description: "Block ID to update",
        },
        content: {
          type: "object",
          description: "New block content (type-specific)",
        },
        archived: {
          type: "boolean",
          description: "Archive the block",
        },
      },
      required: ["blockId"],
    },
  },
  {
    name: "delete_block",
    description: "Delete (archive) a block.",
    inputSchema: {
      type: "object",
      properties: {
        blockId: {
          type: "string",
          description: "Block ID to delete",
        },
      },
      required: ["blockId"],
    },
  },

  // ----- User Operations -----
  {
    name: "list_users",
    description: "List all users in the workspace.",
    inputSchema: {
      type: "object",
      properties: {
        pageSize: {
          type: "number",
          description: "Results per page",
        },
        startCursor: {
          type: "string",
          description: "Pagination cursor",
        },
      },
    },
  },
  {
    name: "get_user",
    description: "Get a user by ID.",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "User ID",
        },
      },
      required: ["userId"],
    },
  },

  // ----- Comment Operations -----
  {
    name: "get_comments",
    description: "Get comments on a page or block.",
    inputSchema: {
      type: "object",
      properties: {
        blockId: {
          type: "string",
          description: "Block or page ID",
        },
        pageSize: {
          type: "number",
          description: "Results per page",
        },
        startCursor: {
          type: "string",
          description: "Pagination cursor",
        },
      },
      required: ["blockId"],
    },
  },
  {
    name: "add_comment",
    description: "Add a comment to a page or discussion.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          description: "Page ID to comment on",
        },
        discussionId: {
          type: "string",
          description: "Discussion ID (for replies)",
        },
        richText: {
          type: "array",
          items: { type: "object" },
          description: "Comment content as rich text",
        },
        text: {
          type: "string",
          description: "Simple text content (alternative to richText)",
        },
      },
    },
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

function createRichText(text: string): any[] {
  return [
    {
      type: "text",
      text: { content: text },
    },
  ];
}

function extractPlainText(richText: any[]): string {
  return richText?.map((t: any) => t.plain_text || t.text?.content || "").join("") || "";
}

function formatPageResult(page: any): any {
  const title = page.properties?.title?.title ||
                page.properties?.Name?.title ||
                Object.values(page.properties || {}).find((p: any) => p.type === "title")?.title;

  return {
    id: page.id,
    title: extractPlainText(title),
    url: page.url,
    created: page.created_time,
    lastEdited: page.last_edited_time,
    icon: page.icon,
    cover: page.cover,
    archived: page.archived,
    properties: page.properties,
    parent: page.parent,
  };
}

function formatBlockResult(block: any): any {
  return {
    id: block.id,
    type: block.type,
    hasChildren: block.has_children,
    content: block[block.type],
    created: block.created_time,
    lastEdited: block.last_edited_time,
    archived: block.archived,
    parent: block.parent,
  };
}

function formatDatabaseResult(db: any): any {
  return {
    id: db.id,
    title: extractPlainText(db.title),
    description: extractPlainText(db.description || []),
    url: db.url,
    created: db.created_time,
    lastEdited: db.last_edited_time,
    properties: db.properties,
    isInline: db.is_inline,
    archived: db.archived,
    parent: db.parent,
  };
}

function formatUserResult(user: any): any {
  return {
    id: user.id,
    type: user.type,
    name: user.name,
    avatarUrl: user.avatar_url,
    email: user.person?.email,
    bot: user.bot,
  };
}

function formatCommentResult(comment: any): any {
  return {
    id: comment.id,
    discussionId: comment.discussion_id,
    text: extractPlainText(comment.rich_text),
    richText: comment.rich_text,
    createdBy: comment.created_by,
    created: comment.created_time,
    parent: comment.parent,
  };
}

// =============================================================================
// Tool Implementations
// =============================================================================

// ----- Search -----
async function search(params: {
  query?: string;
  filter?: { property: string; value: string };
  sort?: { direction: string; timestamp: string };
  pageSize?: number;
}): Promise<any> {
  const searchParams: any = {};

  if (params.query) searchParams.query = params.query;
  if (params.filter) searchParams.filter = params.filter;
  if (params.sort) searchParams.sort = params.sort;
  if (params.pageSize) searchParams.page_size = Math.min(params.pageSize, 100);

  const response = await notion.search(searchParams);

  return {
    results: response.results.map((item: any) => ({
      id: item.id,
      type: item.object,
      title: item.object === "page"
        ? extractPlainText(Object.values(item.properties || {}).find((p: any) => p.type === "title")?.title)
        : extractPlainText(item.title),
      url: item.url,
      lastEdited: item.last_edited_time,
      archived: item.archived,
    })),
    hasMore: response.has_more,
    nextCursor: response.next_cursor,
  };
}

// ----- Page Operations -----
async function getPage(params: { pageId: string }): Promise<any> {
  const page = await notion.pages.retrieve({ page_id: params.pageId });
  return formatPageResult(page);
}

async function createPage(params: {
  parentType: string;
  parentId: string;
  title?: string;
  properties?: any;
  content?: any[];
  icon?: any;
  cover?: any;
}): Promise<any> {
  const createParams: any = {};

  if (params.parentType === "page") {
    createParams.parent = { page_id: params.parentId };
    createParams.properties = {
      title: { title: createRichText(params.title || "Untitled") },
    };
  } else {
    createParams.parent = { database_id: params.parentId };
    createParams.properties = params.properties || {};
    if (params.title && !createParams.properties.Name) {
      createParams.properties.Name = { title: createRichText(params.title) };
    }
  }

  if (params.content) {
    createParams.children = params.content;
  }

  if (params.icon) createParams.icon = params.icon;
  if (params.cover) createParams.cover = params.cover;

  const page = await notion.pages.create(createParams);
  return formatPageResult(page);
}

async function updatePage(params: {
  pageId: string;
  properties?: any;
  icon?: any;
  cover?: any;
}): Promise<any> {
  const updateParams: any = { page_id: params.pageId };

  if (params.properties) updateParams.properties = params.properties;
  if (params.icon) updateParams.icon = params.icon;
  if (params.cover) updateParams.cover = params.cover;

  const page = await notion.pages.update(updateParams);
  return formatPageResult(page);
}

async function archivePage(params: {
  pageId: string;
  archived: boolean;
}): Promise<any> {
  const page = await notion.pages.update({
    page_id: params.pageId,
    archived: params.archived,
  });
  return formatPageResult(page);
}

// ----- Database Operations -----
async function listDatabases(params: {
  pageSize?: number;
  startCursor?: string;
}): Promise<any> {
  // Use search with database filter to list all databases
  const searchParams: any = {
    filter: { property: "object", value: "database" },
  };

  if (params.pageSize) searchParams.page_size = Math.min(params.pageSize, 100);
  if (params.startCursor) searchParams.start_cursor = params.startCursor;

  const response = await notion.search(searchParams);

  return {
    databases: response.results.map(formatDatabaseResult),
    hasMore: response.has_more,
    nextCursor: response.next_cursor,
  };
}

async function getDatabase(params: { databaseId: string }): Promise<any> {
  const db = await notion.databases.retrieve({ database_id: params.databaseId });
  return formatDatabaseResult(db);
}

async function createDatabase(params: {
  parentPageId: string;
  title: string;
  properties: any;
  isInline?: boolean;
}): Promise<any> {
  const db = await notion.databases.create({
    parent: { page_id: params.parentPageId },
    title: createRichText(params.title),
    properties: params.properties,
    is_inline: params.isInline || false,
  });

  return formatDatabaseResult(db);
}

async function queryDatabase(params: {
  databaseId: string;
  filter?: any;
  sorts?: any[];
  pageSize?: number;
  startCursor?: string;
}): Promise<any> {
  const queryParams: any = { database_id: params.databaseId };

  if (params.filter) queryParams.filter = params.filter;
  if (params.sorts) queryParams.sorts = params.sorts;
  if (params.pageSize) queryParams.page_size = Math.min(params.pageSize, 100);
  if (params.startCursor) queryParams.start_cursor = params.startCursor;

  const response = await notion.databases.query(queryParams);

  return {
    results: response.results.map(formatPageResult),
    hasMore: response.has_more,
    nextCursor: response.next_cursor,
  };
}

async function createDatabaseItem(params: {
  databaseId: string;
  properties: any;
  content?: any[];
  icon?: any;
  cover?: any;
}): Promise<any> {
  const createParams: any = {
    parent: { database_id: params.databaseId },
    properties: params.properties,
  };

  if (params.content) createParams.children = params.content;
  if (params.icon) createParams.icon = params.icon;
  if (params.cover) createParams.cover = params.cover;

  const page = await notion.pages.create(createParams);
  return formatPageResult(page);
}

async function updateDatabaseItem(params: {
  pageId: string;
  properties?: any;
  icon?: any;
  cover?: any;
  archived?: boolean;
}): Promise<any> {
  const updateParams: any = { page_id: params.pageId };

  if (params.properties) updateParams.properties = params.properties;
  if (params.icon) updateParams.icon = params.icon;
  if (params.cover) updateParams.cover = params.cover;
  if (params.archived !== undefined) updateParams.archived = params.archived;

  const page = await notion.pages.update(updateParams);
  return formatPageResult(page);
}

// ----- Block Operations -----
async function getBlock(params: { blockId: string }): Promise<any> {
  const block = await notion.blocks.retrieve({ block_id: params.blockId });
  return formatBlockResult(block);
}

async function getBlockChildren(params: {
  blockId: string;
  pageSize?: number;
  startCursor?: string;
}): Promise<any> {
  const response = await notion.blocks.children.list({
    block_id: params.blockId,
    page_size: params.pageSize ? Math.min(params.pageSize, 100) : undefined,
    start_cursor: params.startCursor,
  });

  return {
    results: response.results.map(formatBlockResult),
    hasMore: response.has_more,
    nextCursor: response.next_cursor,
  };
}

async function appendBlockChildren(params: {
  blockId: string;
  children: any[];
  after?: string;
}): Promise<any> {
  const appendParams: any = {
    block_id: params.blockId,
    children: params.children,
  };

  if (params.after) {
    appendParams.after = params.after;
  }

  const response = await notion.blocks.children.append(appendParams);

  return {
    results: response.results.map(formatBlockResult),
  };
}

async function updateBlock(params: {
  blockId: string;
  content?: any;
  archived?: boolean;
}): Promise<any> {
  const updateParams: any = { block_id: params.blockId };

  if (params.content) {
    Object.assign(updateParams, params.content);
  }
  if (params.archived !== undefined) {
    updateParams.archived = params.archived;
  }

  const block = await notion.blocks.update(updateParams);
  return formatBlockResult(block);
}

async function deleteBlock(params: { blockId: string }): Promise<any> {
  const block = await notion.blocks.delete({ block_id: params.blockId });
  return {
    deleted: true,
    blockId: params.blockId,
    block: formatBlockResult(block),
  };
}

// ----- User Operations -----
async function listUsers(params: {
  pageSize?: number;
  startCursor?: string;
}): Promise<any> {
  const listParams: any = {};

  if (params.pageSize) listParams.page_size = Math.min(params.pageSize, 100);
  if (params.startCursor) listParams.start_cursor = params.startCursor;

  const response = await notion.users.list(listParams);

  return {
    users: response.results.map(formatUserResult),
    hasMore: response.has_more,
    nextCursor: response.next_cursor,
  };
}

async function getUser(params: { userId: string }): Promise<any> {
  const user = await notion.users.retrieve({ user_id: params.userId });
  return formatUserResult(user);
}

// ----- Comment Operations -----
async function getComments(params: {
  blockId: string;
  pageSize?: number;
  startCursor?: string;
}): Promise<any> {
  const listParams: any = {
    block_id: params.blockId,
  };

  if (params.pageSize) listParams.page_size = Math.min(params.pageSize, 100);
  if (params.startCursor) listParams.start_cursor = params.startCursor;

  const response = await notion.comments.list(listParams);

  return {
    comments: response.results.map(formatCommentResult),
    hasMore: response.has_more,
    nextCursor: response.next_cursor,
  };
}

async function addComment(params: {
  pageId?: string;
  discussionId?: string;
  richText?: any[];
  text?: string;
}): Promise<any> {
  const commentParams: any = {};

  // Set rich text content
  if (params.richText) {
    commentParams.rich_text = params.richText;
  } else if (params.text) {
    commentParams.rich_text = createRichText(params.text);
  } else {
    throw new Error("Either richText or text must be provided");
  }

  // Set parent
  if (params.discussionId) {
    commentParams.discussion_id = params.discussionId;
  } else if (params.pageId) {
    commentParams.parent = { page_id: params.pageId };
  } else {
    throw new Error("Either pageId or discussionId must be provided");
  }

  const comment = await notion.comments.create(commentParams);
  return formatCommentResult(comment);
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "notion-mcp",
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
      // Search
      case "search":
        result = await search(args as any);
        break;

      // Page Operations
      case "get_page":
        result = await getPage(args as any);
        break;
      case "create_page":
        result = await createPage(args as any);
        break;
      case "update_page":
        result = await updatePage(args as any);
        break;
      case "archive_page":
        result = await archivePage(args as any);
        break;

      // Database Operations
      case "list_databases":
        result = await listDatabases(args as any);
        break;
      case "get_database":
        result = await getDatabase(args as any);
        break;
      case "create_database":
        result = await createDatabase(args as any);
        break;
      case "query_database":
        result = await queryDatabase(args as any);
        break;
      case "create_database_item":
        result = await createDatabaseItem(args as any);
        break;
      case "update_database_item":
        result = await updateDatabaseItem(args as any);
        break;

      // Block Operations
      case "get_block":
        result = await getBlock(args as any);
        break;
      case "get_block_children":
        result = await getBlockChildren(args as any);
        break;
      case "append_block_children":
        result = await appendBlockChildren(args as any);
        break;
      case "update_block":
        result = await updateBlock(args as any);
        break;
      case "delete_block":
        result = await deleteBlock(args as any);
        break;

      // User Operations
      case "list_users":
        result = await listUsers(args as any);
        break;
      case "get_user":
        result = await getUser(args as any);
        break;

      // Comment Operations
      case "get_comments":
        result = await getComments(args as any);
        break;
      case "add_comment":
        result = await addComment(args as any);
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
    const errorResponse: any = {
      error: error.message,
    };

    // Include additional error details if available
    if (error.code) errorResponse.code = error.code;
    if (error.status) errorResponse.status = error.status;
    if (error.body) errorResponse.details = error.body;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(errorResponse, null, 2),
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
  if (!config.apiKey) {
    console.error("Warning: NOTION_API_KEY environment variable is not set");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Notion MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
