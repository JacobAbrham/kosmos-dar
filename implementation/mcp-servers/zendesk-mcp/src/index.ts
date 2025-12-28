/**
 * Zendesk MCP Server
 *
 * Zendesk Support integration for KOSMOS agents including:
 * - Ticket management (CRUD operations)
 * - Ticket comments and updates
 * - User management
 * - Search functionality
 * - Groups and organizations
 * - Macros and views
 * - Triggers and metrics
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Environment configuration
const ZENDESK_SUBDOMAIN = process.env.ZENDESK_SUBDOMAIN || "";
const ZENDESK_EMAIL = process.env.ZENDESK_EMAIL || "";
const ZENDESK_API_TOKEN = process.env.ZENDESK_API_TOKEN || "";

// Base URL for Zendesk API
const getBaseUrl = () => `https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`;

// Authentication header
const getAuthHeader = () => {
  const credentials = Buffer.from(`${ZENDESK_EMAIL}/token:${ZENDESK_API_TOKEN}`).toString("base64");
  return `Basic ${credentials}`;
};

// HTTP client helper
async function zendeskRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const url = `${getBaseUrl()}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": getAuthHeader(),
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zendesk API error (${response.status}): ${errorText}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return { success: true };
  }

  return response.json();
}

// Tool schemas
const ListTicketsSchema = z.object({
  page: z.number().optional().describe("Page number"),
  perPage: z.number().optional().default(25).describe("Results per page (max 100)"),
  sortBy: z.string().optional().describe("Sort field (created_at, updated_at, priority, status)"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  status: z.string().optional().describe("Filter by status (new, open, pending, hold, solved, closed)"),
});

const GetTicketSchema = z.object({
  ticketId: z.number().describe("Ticket ID"),
});

const CreateTicketSchema = z.object({
  subject: z.string().describe("Ticket subject"),
  description: z.string().describe("Ticket description (initial comment)"),
  priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
  type: z.enum(["problem", "incident", "question", "task"]).optional(),
  status: z.enum(["new", "open", "pending", "hold", "solved", "closed"]).optional(),
  requesterId: z.number().optional().describe("Requester user ID"),
  assigneeId: z.number().optional().describe("Assignee user ID"),
  groupId: z.number().optional().describe("Group ID"),
  tags: z.array(z.string()).optional().describe("Ticket tags"),
  customFields: z.array(z.object({
    id: z.number(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  })).optional().describe("Custom field values"),
});

const UpdateTicketSchema = z.object({
  ticketId: z.number().describe("Ticket ID"),
  subject: z.string().optional().describe("New subject"),
  priority: z.enum(["urgent", "high", "normal", "low"]).optional(),
  type: z.enum(["problem", "incident", "question", "task"]).optional(),
  status: z.enum(["new", "open", "pending", "hold", "solved", "closed"]).optional(),
  assigneeId: z.number().optional().describe("New assignee user ID"),
  groupId: z.number().optional().describe("New group ID"),
  tags: z.array(z.string()).optional().describe("New tags (replaces existing)"),
  comment: z.string().optional().describe("Add a comment with the update"),
  commentPublic: z.boolean().optional().default(true).describe("Whether comment is public"),
  customFields: z.array(z.object({
    id: z.number(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  })).optional().describe("Custom field values"),
});

const DeleteTicketSchema = z.object({
  ticketId: z.number().describe("Ticket ID"),
});

const ListTicketCommentsSchema = z.object({
  ticketId: z.number().describe("Ticket ID"),
  page: z.number().optional(),
  perPage: z.number().optional().default(25),
  sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
});

const AddTicketCommentSchema = z.object({
  ticketId: z.number().describe("Ticket ID"),
  body: z.string().describe("Comment body (supports HTML)"),
  public: z.boolean().optional().default(true).describe("Whether comment is public to requester"),
  authorId: z.number().optional().describe("Author user ID (admin only)"),
});

const ListUsersSchema = z.object({
  page: z.number().optional(),
  perPage: z.number().optional().default(25),
  role: z.enum(["end-user", "agent", "admin"]).optional().describe("Filter by role"),
});

const GetUserSchema = z.object({
  userId: z.number().describe("User ID"),
});

const CreateUserSchema = z.object({
  name: z.string().describe("User's full name"),
  email: z.string().describe("User's email address"),
  role: z.enum(["end-user", "agent", "admin"]).optional().default("end-user"),
  phone: z.string().optional().describe("User's phone number"),
  organizationId: z.number().optional().describe("Organization ID"),
  tags: z.array(z.string()).optional().describe("User tags"),
  verified: z.boolean().optional().default(false).describe("Whether email is verified"),
});

const SearchTicketsSchema = z.object({
  query: z.string().describe("Search query (Zendesk search syntax)"),
  page: z.number().optional(),
  perPage: z.number().optional().default(25),
  sortBy: z.string().optional().describe("Sort field"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

const ListGroupsSchema = z.object({
  page: z.number().optional(),
  perPage: z.number().optional().default(25),
});

const ListOrganizationsSchema = z.object({
  page: z.number().optional(),
  perPage: z.number().optional().default(25),
});

const GetOrganizationSchema = z.object({
  organizationId: z.number().describe("Organization ID"),
});

const ListMacrosSchema = z.object({
  page: z.number().optional(),
  perPage: z.number().optional().default(25),
  active: z.boolean().optional().describe("Filter by active status"),
  category: z.number().optional().describe("Filter by category ID"),
});

const ApplyMacroSchema = z.object({
  ticketId: z.number().describe("Ticket ID"),
  macroId: z.number().describe("Macro ID"),
});

const ListViewsSchema = z.object({
  page: z.number().optional(),
  perPage: z.number().optional().default(25),
  active: z.boolean().optional().describe("Filter by active status"),
});

const GetViewTicketsSchema = z.object({
  viewId: z.number().describe("View ID"),
  page: z.number().optional(),
  perPage: z.number().optional().default(25),
});

const ListTriggersSchema = z.object({
  page: z.number().optional(),
  perPage: z.number().optional().default(25),
  active: z.boolean().optional().describe("Filter by active status"),
  categoryId: z.string().optional().describe("Filter by category ID"),
});

const GetTicketMetricsSchema = z.object({
  ticketId: z.number().describe("Ticket ID"),
});

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "list_tickets",
    description: "List tickets from Zendesk Support with optional filtering and sorting",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number" },
        perPage: { type: "number", description: "Results per page (max 100)", default: 25 },
        sortBy: { type: "string", description: "Sort field (created_at, updated_at, priority, status)" },
        sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
        status: { type: "string", description: "Filter by status (new, open, pending, hold, solved, closed)" },
      },
    },
  },
  {
    name: "get_ticket",
    description: "Get detailed information about a specific ticket",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: { type: "number", description: "Ticket ID" },
      },
      required: ["ticketId"],
    },
  },
  {
    name: "create_ticket",
    description: "Create a new support ticket",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Ticket subject" },
        description: { type: "string", description: "Ticket description (initial comment)" },
        priority: { type: "string", enum: ["urgent", "high", "normal", "low"] },
        type: { type: "string", enum: ["problem", "incident", "question", "task"] },
        status: { type: "string", enum: ["new", "open", "pending", "hold", "solved", "closed"] },
        requesterId: { type: "number", description: "Requester user ID" },
        assigneeId: { type: "number", description: "Assignee user ID" },
        groupId: { type: "number", description: "Group ID" },
        tags: { type: "array", items: { type: "string" }, description: "Ticket tags" },
        customFields: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number" },
              value: {},
            },
          },
          description: "Custom field values",
        },
      },
      required: ["subject", "description"],
    },
  },
  {
    name: "update_ticket",
    description: "Update an existing ticket",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: { type: "number", description: "Ticket ID" },
        subject: { type: "string", description: "New subject" },
        priority: { type: "string", enum: ["urgent", "high", "normal", "low"] },
        type: { type: "string", enum: ["problem", "incident", "question", "task"] },
        status: { type: "string", enum: ["new", "open", "pending", "hold", "solved", "closed"] },
        assigneeId: { type: "number", description: "New assignee user ID" },
        groupId: { type: "number", description: "New group ID" },
        tags: { type: "array", items: { type: "string" }, description: "New tags" },
        comment: { type: "string", description: "Add a comment with the update" },
        commentPublic: { type: "boolean", description: "Whether comment is public", default: true },
        customFields: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number" },
              value: {},
            },
          },
        },
      },
      required: ["ticketId"],
    },
  },
  {
    name: "delete_ticket",
    description: "Delete a ticket (moves to deleted tickets, can be recovered within 30 days)",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: { type: "number", description: "Ticket ID" },
      },
      required: ["ticketId"],
    },
  },
  {
    name: "list_ticket_comments",
    description: "List all comments on a ticket",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: { type: "number", description: "Ticket ID" },
        page: { type: "number" },
        perPage: { type: "number", default: 25 },
        sortOrder: { type: "string", enum: ["asc", "desc"], default: "asc" },
      },
      required: ["ticketId"],
    },
  },
  {
    name: "add_ticket_comment",
    description: "Add a comment to a ticket",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: { type: "number", description: "Ticket ID" },
        body: { type: "string", description: "Comment body (supports HTML)" },
        public: { type: "boolean", description: "Whether comment is public", default: true },
        authorId: { type: "number", description: "Author user ID (admin only)" },
      },
      required: ["ticketId", "body"],
    },
  },
  {
    name: "list_users",
    description: "List users in Zendesk",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number" },
        perPage: { type: "number", default: 25 },
        role: { type: "string", enum: ["end-user", "agent", "admin"], description: "Filter by role" },
      },
    },
  },
  {
    name: "get_user",
    description: "Get detailed information about a user",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "number", description: "User ID" },
      },
      required: ["userId"],
    },
  },
  {
    name: "create_user",
    description: "Create a new user in Zendesk",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "User's full name" },
        email: { type: "string", description: "User's email address" },
        role: { type: "string", enum: ["end-user", "agent", "admin"], default: "end-user" },
        phone: { type: "string", description: "User's phone number" },
        organizationId: { type: "number", description: "Organization ID" },
        tags: { type: "array", items: { type: "string" }, description: "User tags" },
        verified: { type: "boolean", description: "Whether email is verified", default: false },
      },
      required: ["name", "email"],
    },
  },
  {
    name: "search_tickets",
    description: "Search tickets using Zendesk search syntax",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (e.g., 'status:open priority:high')" },
        page: { type: "number" },
        perPage: { type: "number", default: 25 },
        sortBy: { type: "string", description: "Sort field" },
        sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
      },
      required: ["query"],
    },
  },
  {
    name: "list_groups",
    description: "List all groups in Zendesk",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number" },
        perPage: { type: "number", default: 25 },
      },
    },
  },
  {
    name: "list_organizations",
    description: "List all organizations in Zendesk",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number" },
        perPage: { type: "number", default: 25 },
      },
    },
  },
  {
    name: "get_organization",
    description: "Get detailed information about an organization",
    inputSchema: {
      type: "object",
      properties: {
        organizationId: { type: "number", description: "Organization ID" },
      },
      required: ["organizationId"],
    },
  },
  {
    name: "list_macros",
    description: "List available macros",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number" },
        perPage: { type: "number", default: 25 },
        active: { type: "boolean", description: "Filter by active status" },
        category: { type: "number", description: "Filter by category ID" },
      },
    },
  },
  {
    name: "apply_macro",
    description: "Apply a macro to a ticket",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: { type: "number", description: "Ticket ID" },
        macroId: { type: "number", description: "Macro ID" },
      },
      required: ["ticketId", "macroId"],
    },
  },
  {
    name: "list_views",
    description: "List ticket views",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number" },
        perPage: { type: "number", default: 25 },
        active: { type: "boolean", description: "Filter by active status" },
      },
    },
  },
  {
    name: "get_view_tickets",
    description: "Get tickets in a specific view",
    inputSchema: {
      type: "object",
      properties: {
        viewId: { type: "number", description: "View ID" },
        page: { type: "number" },
        perPage: { type: "number", default: 25 },
      },
      required: ["viewId"],
    },
  },
  {
    name: "list_triggers",
    description: "List automation triggers",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number" },
        perPage: { type: "number", default: 25 },
        active: { type: "boolean", description: "Filter by active status" },
        categoryId: { type: "string", description: "Filter by category ID" },
      },
    },
  },
  {
    name: "get_ticket_metrics",
    description: "Get metrics for a ticket (reply time, resolution time, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        ticketId: { type: "number", description: "Ticket ID" },
      },
      required: ["ticketId"],
    },
  },
];

// Tool implementations
async function listTickets(params: z.infer<typeof ListTicketsSchema>): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.perPage) queryParams.set("per_page", params.perPage.toString());
  if (params.sortBy) queryParams.set("sort_by", params.sortBy);
  if (params.sortOrder) queryParams.set("sort_order", params.sortOrder);

  let endpoint = "/tickets.json";
  if (params.status) {
    endpoint = `/search.json?query=type:ticket status:${params.status}`;
  } else if (queryParams.toString()) {
    endpoint += `?${queryParams.toString()}`;
  }

  const data = await zendeskRequest(endpoint);

  return {
    tickets: (data.tickets || data.results)?.map((t: any) => ({
      id: t.id,
      subject: t.subject,
      description: t.description,
      status: t.status,
      priority: t.priority,
      type: t.type,
      requesterId: t.requester_id,
      assigneeId: t.assignee_id,
      groupId: t.group_id,
      organizationId: t.organization_id,
      tags: t.tags,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      dueAt: t.due_at,
    })),
    count: data.count,
    nextPage: data.next_page,
    previousPage: data.previous_page,
  };
}

async function getTicket(params: z.infer<typeof GetTicketSchema>): Promise<any> {
  const data = await zendeskRequest(`/tickets/${params.ticketId}.json`);
  const t = data.ticket;

  return {
    id: t.id,
    url: t.url,
    subject: t.subject,
    description: t.description,
    rawSubject: t.raw_subject,
    status: t.status,
    priority: t.priority,
    type: t.type,
    recipient: t.recipient,
    requesterId: t.requester_id,
    submitterId: t.submitter_id,
    assigneeId: t.assignee_id,
    organizationId: t.organization_id,
    groupId: t.group_id,
    collaboratorIds: t.collaborator_ids,
    followerIds: t.follower_ids,
    forumTopicId: t.forum_topic_id,
    problemId: t.problem_id,
    hasIncidents: t.has_incidents,
    isPublic: t.is_public,
    dueAt: t.due_at,
    tags: t.tags,
    customFields: t.custom_fields,
    satisfactionRating: t.satisfaction_rating,
    sharingAgreementIds: t.sharing_agreement_ids,
    fields: t.fields,
    brand_id: t.brand_id,
    allowChannelback: t.allow_channelback,
    allowAttachments: t.allow_attachments,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

async function createTicket(params: z.infer<typeof CreateTicketSchema>): Promise<any> {
  const ticketData: any = {
    subject: params.subject,
    comment: {
      body: params.description,
    },
  };

  if (params.priority) ticketData.priority = params.priority;
  if (params.type) ticketData.type = params.type;
  if (params.status) ticketData.status = params.status;
  if (params.requesterId) ticketData.requester_id = params.requesterId;
  if (params.assigneeId) ticketData.assignee_id = params.assigneeId;
  if (params.groupId) ticketData.group_id = params.groupId;
  if (params.tags) ticketData.tags = params.tags;
  if (params.customFields) ticketData.custom_fields = params.customFields;

  const data = await zendeskRequest("/tickets.json", {
    method: "POST",
    body: JSON.stringify({ ticket: ticketData }),
  });

  return {
    success: true,
    ticket: {
      id: data.ticket.id,
      subject: data.ticket.subject,
      status: data.ticket.status,
      priority: data.ticket.priority,
      createdAt: data.ticket.created_at,
    },
  };
}

async function updateTicket(params: z.infer<typeof UpdateTicketSchema>): Promise<any> {
  const ticketData: any = {};

  if (params.subject) ticketData.subject = params.subject;
  if (params.priority) ticketData.priority = params.priority;
  if (params.type) ticketData.type = params.type;
  if (params.status) ticketData.status = params.status;
  if (params.assigneeId) ticketData.assignee_id = params.assigneeId;
  if (params.groupId) ticketData.group_id = params.groupId;
  if (params.tags) ticketData.tags = params.tags;
  if (params.customFields) ticketData.custom_fields = params.customFields;

  if (params.comment) {
    ticketData.comment = {
      body: params.comment,
      public: params.commentPublic,
    };
  }

  const data = await zendeskRequest(`/tickets/${params.ticketId}.json`, {
    method: "PUT",
    body: JSON.stringify({ ticket: ticketData }),
  });

  return {
    success: true,
    ticket: {
      id: data.ticket.id,
      subject: data.ticket.subject,
      status: data.ticket.status,
      priority: data.ticket.priority,
      updatedAt: data.ticket.updated_at,
    },
  };
}

async function deleteTicket(params: z.infer<typeof DeleteTicketSchema>): Promise<any> {
  await zendeskRequest(`/tickets/${params.ticketId}.json`, {
    method: "DELETE",
  });

  return {
    success: true,
    message: `Ticket ${params.ticketId} deleted (can be recovered within 30 days)`,
  };
}

async function listTicketComments(params: z.infer<typeof ListTicketCommentsSchema>): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.perPage) queryParams.set("per_page", params.perPage.toString());
  if (params.sortOrder) queryParams.set("sort_order", params.sortOrder);

  const endpoint = `/tickets/${params.ticketId}/comments.json?${queryParams.toString()}`;
  const data = await zendeskRequest(endpoint);

  return {
    comments: data.comments?.map((c: any) => ({
      id: c.id,
      type: c.type,
      authorId: c.author_id,
      body: c.body,
      htmlBody: c.html_body,
      plainBody: c.plain_body,
      public: c.public,
      attachments: c.attachments?.map((a: any) => ({
        id: a.id,
        fileName: a.file_name,
        contentUrl: a.content_url,
        contentType: a.content_type,
        size: a.size,
      })),
      createdAt: c.created_at,
    })),
    count: data.count,
    nextPage: data.next_page,
    previousPage: data.previous_page,
  };
}

async function addTicketComment(params: z.infer<typeof AddTicketCommentSchema>): Promise<any> {
  const ticketData: any = {
    comment: {
      body: params.body,
      public: params.public,
    },
  };

  if (params.authorId) {
    ticketData.comment.author_id = params.authorId;
  }

  const data = await zendeskRequest(`/tickets/${params.ticketId}.json`, {
    method: "PUT",
    body: JSON.stringify({ ticket: ticketData }),
  });

  return {
    success: true,
    ticket: {
      id: data.ticket.id,
      updatedAt: data.ticket.updated_at,
    },
  };
}

async function listUsers(params: z.infer<typeof ListUsersSchema>): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.perPage) queryParams.set("per_page", params.perPage.toString());
  if (params.role) queryParams.set("role", params.role);

  const endpoint = `/users.json?${queryParams.toString()}`;
  const data = await zendeskRequest(endpoint);

  return {
    users: data.users?.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      organizationId: u.organization_id,
      timeZone: u.time_zone,
      active: u.active,
      verified: u.verified,
      suspended: u.suspended,
      tags: u.tags,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
      lastLoginAt: u.last_login_at,
    })),
    count: data.count,
    nextPage: data.next_page,
    previousPage: data.previous_page,
  };
}

async function getUser(params: z.infer<typeof GetUserSchema>): Promise<any> {
  const data = await zendeskRequest(`/users/${params.userId}.json`);
  const u = data.user;

  return {
    id: u.id,
    url: u.url,
    name: u.name,
    email: u.email,
    phone: u.phone,
    photo: u.photo,
    organizationId: u.organization_id,
    role: u.role,
    timeZone: u.time_zone,
    locale: u.locale,
    localeId: u.locale_id,
    active: u.active,
    verified: u.verified,
    suspended: u.suspended,
    ticketRestriction: u.ticket_restriction,
    onlyPrivateComments: u.only_private_comments,
    tags: u.tags,
    userFields: u.user_fields,
    signature: u.signature,
    details: u.details,
    notes: u.notes,
    alias: u.alias,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    lastLoginAt: u.last_login_at,
  };
}

async function createUser(params: z.infer<typeof CreateUserSchema>): Promise<any> {
  const userData: any = {
    name: params.name,
    email: params.email,
    role: params.role || "end-user",
  };

  if (params.phone) userData.phone = params.phone;
  if (params.organizationId) userData.organization_id = params.organizationId;
  if (params.tags) userData.tags = params.tags;
  if (params.verified !== undefined) userData.verified = params.verified;

  const data = await zendeskRequest("/users.json", {
    method: "POST",
    body: JSON.stringify({ user: userData }),
  });

  return {
    success: true,
    user: {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      createdAt: data.user.created_at,
    },
  };
}

async function searchTickets(params: z.infer<typeof SearchTicketsSchema>): Promise<any> {
  const queryParams = new URLSearchParams();
  queryParams.set("query", `type:ticket ${params.query}`);
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.perPage) queryParams.set("per_page", params.perPage.toString());
  if (params.sortBy) queryParams.set("sort_by", params.sortBy);
  if (params.sortOrder) queryParams.set("sort_order", params.sortOrder);

  const endpoint = `/search.json?${queryParams.toString()}`;
  const data = await zendeskRequest(endpoint);

  return {
    results: data.results?.map((t: any) => ({
      id: t.id,
      subject: t.subject,
      description: t.description,
      status: t.status,
      priority: t.priority,
      type: t.type,
      requesterId: t.requester_id,
      assigneeId: t.assignee_id,
      groupId: t.group_id,
      tags: t.tags,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    })),
    count: data.count,
    facets: data.facets,
    nextPage: data.next_page,
    previousPage: data.previous_page,
  };
}

async function listGroups(params: z.infer<typeof ListGroupsSchema>): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.perPage) queryParams.set("per_page", params.perPage.toString());

  const endpoint = `/groups.json?${queryParams.toString()}`;
  const data = await zendeskRequest(endpoint);

  return {
    groups: data.groups?.map((g: any) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      isPublic: g.is_public,
      default: g.default,
      deleted: g.deleted,
      createdAt: g.created_at,
      updatedAt: g.updated_at,
    })),
    count: data.count,
    nextPage: data.next_page,
    previousPage: data.previous_page,
  };
}

async function listOrganizations(params: z.infer<typeof ListOrganizationsSchema>): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.perPage) queryParams.set("per_page", params.perPage.toString());

  const endpoint = `/organizations.json?${queryParams.toString()}`;
  const data = await zendeskRequest(endpoint);

  return {
    organizations: data.organizations?.map((o: any) => ({
      id: o.id,
      name: o.name,
      domainNames: o.domain_names,
      details: o.details,
      notes: o.notes,
      groupId: o.group_id,
      sharedTickets: o.shared_tickets,
      sharedComments: o.shared_comments,
      tags: o.tags,
      organizationFields: o.organization_fields,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
    })),
    count: data.count,
    nextPage: data.next_page,
    previousPage: data.previous_page,
  };
}

async function getOrganization(params: z.infer<typeof GetOrganizationSchema>): Promise<any> {
  const data = await zendeskRequest(`/organizations/${params.organizationId}.json`);
  const o = data.organization;

  return {
    id: o.id,
    url: o.url,
    name: o.name,
    domainNames: o.domain_names,
    details: o.details,
    notes: o.notes,
    groupId: o.group_id,
    sharedTickets: o.shared_tickets,
    sharedComments: o.shared_comments,
    tags: o.tags,
    organizationFields: o.organization_fields,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}

async function listMacros(params: z.infer<typeof ListMacrosSchema>): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.perPage) queryParams.set("per_page", params.perPage.toString());
  if (params.active !== undefined) queryParams.set("active", params.active.toString());
  if (params.category) queryParams.set("category", params.category.toString());

  const endpoint = `/macros.json?${queryParams.toString()}`;
  const data = await zendeskRequest(endpoint);

  return {
    macros: data.macros?.map((m: any) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      active: m.active,
      position: m.position,
      restriction: m.restriction,
      actions: m.actions,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    })),
    count: data.count,
    nextPage: data.next_page,
    previousPage: data.previous_page,
  };
}

async function applyMacro(params: z.infer<typeof ApplyMacroSchema>): Promise<any> {
  // First, get the macro to see what it does
  const macroData = await zendeskRequest(`/macros/${params.macroId}/apply.json?ticket_id=${params.ticketId}`);

  // The apply endpoint shows what changes would be made
  // To actually apply it, we need to update the ticket with those changes
  if (macroData.result?.ticket) {
    const ticketUpdate = macroData.result.ticket;

    await zendeskRequest(`/tickets/${params.ticketId}.json`, {
      method: "PUT",
      body: JSON.stringify({ ticket: ticketUpdate }),
    });
  }

  return {
    success: true,
    result: {
      ticketId: params.ticketId,
      macroId: params.macroId,
      changes: macroData.result?.ticket,
    },
  };
}

async function listViews(params: z.infer<typeof ListViewsSchema>): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.perPage) queryParams.set("per_page", params.perPage.toString());
  if (params.active !== undefined) queryParams.set("active", params.active.toString());

  const endpoint = `/views.json?${queryParams.toString()}`;
  const data = await zendeskRequest(endpoint);

  return {
    views: data.views?.map((v: any) => ({
      id: v.id,
      title: v.title,
      description: v.description,
      active: v.active,
      position: v.position,
      restriction: v.restriction,
      conditions: v.conditions,
      execution: v.execution,
      createdAt: v.created_at,
      updatedAt: v.updated_at,
    })),
    count: data.count,
    nextPage: data.next_page,
    previousPage: data.previous_page,
  };
}

async function getViewTickets(params: z.infer<typeof GetViewTicketsSchema>): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.perPage) queryParams.set("per_page", params.perPage.toString());

  const endpoint = `/views/${params.viewId}/tickets.json?${queryParams.toString()}`;
  const data = await zendeskRequest(endpoint);

  return {
    tickets: data.tickets?.map((t: any) => ({
      id: t.id,
      subject: t.subject,
      description: t.description,
      status: t.status,
      priority: t.priority,
      type: t.type,
      requesterId: t.requester_id,
      assigneeId: t.assignee_id,
      groupId: t.group_id,
      tags: t.tags,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    })),
    count: data.count,
    nextPage: data.next_page,
    previousPage: data.previous_page,
  };
}

async function listTriggers(params: z.infer<typeof ListTriggersSchema>): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", params.page.toString());
  if (params.perPage) queryParams.set("per_page", params.perPage.toString());
  if (params.active !== undefined) queryParams.set("active", params.active.toString());
  if (params.categoryId) queryParams.set("category_id", params.categoryId);

  const endpoint = `/triggers.json?${queryParams.toString()}`;
  const data = await zendeskRequest(endpoint);

  return {
    triggers: data.triggers?.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      active: t.active,
      position: t.position,
      conditions: t.conditions,
      actions: t.actions,
      categoryId: t.category_id,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    })),
    count: data.count,
    nextPage: data.next_page,
    previousPage: data.previous_page,
  };
}

async function getTicketMetrics(params: z.infer<typeof GetTicketMetricsSchema>): Promise<any> {
  const data = await zendeskRequest(`/tickets/${params.ticketId}/metrics.json`);
  const m = data.ticket_metric;

  return {
    id: m.id,
    ticketId: m.ticket_id,
    groupStations: m.group_stations,
    assigneeStations: m.assignee_stations,
    reopens: m.reopens,
    replies: m.replies,
    assigneeUpdatedAt: m.assignee_updated_at,
    requesterUpdatedAt: m.requester_updated_at,
    statusUpdatedAt: m.status_updated_at,
    initiallyAssignedAt: m.initially_assigned_at,
    assignedAt: m.assigned_at,
    solvedAt: m.solved_at,
    latestCommentAddedAt: m.latest_comment_added_at,
    replyTimeInMinutes: m.reply_time_in_minutes,
    firstResolutionTimeInMinutes: m.first_resolution_time_in_minutes,
    fullResolutionTimeInMinutes: m.full_resolution_time_in_minutes,
    agentWaitTimeInMinutes: m.agent_wait_time_in_minutes,
    requesterWaitTimeInMinutes: m.requester_wait_time_in_minutes,
    onHoldTimeInMinutes: m.on_hold_time_in_minutes,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  };
}

// Create server
const server = new Server(
  {
    name: "zendesk-mcp-server",
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
      case "list_tickets":
        result = await listTickets(ListTicketsSchema.parse(args));
        break;
      case "get_ticket":
        result = await getTicket(GetTicketSchema.parse(args));
        break;
      case "create_ticket":
        result = await createTicket(CreateTicketSchema.parse(args));
        break;
      case "update_ticket":
        result = await updateTicket(UpdateTicketSchema.parse(args));
        break;
      case "delete_ticket":
        result = await deleteTicket(DeleteTicketSchema.parse(args));
        break;
      case "list_ticket_comments":
        result = await listTicketComments(ListTicketCommentsSchema.parse(args));
        break;
      case "add_ticket_comment":
        result = await addTicketComment(AddTicketCommentSchema.parse(args));
        break;
      case "list_users":
        result = await listUsers(ListUsersSchema.parse(args));
        break;
      case "get_user":
        result = await getUser(GetUserSchema.parse(args));
        break;
      case "create_user":
        result = await createUser(CreateUserSchema.parse(args));
        break;
      case "search_tickets":
        result = await searchTickets(SearchTicketsSchema.parse(args));
        break;
      case "list_groups":
        result = await listGroups(ListGroupsSchema.parse(args));
        break;
      case "list_organizations":
        result = await listOrganizations(ListOrganizationsSchema.parse(args));
        break;
      case "get_organization":
        result = await getOrganization(GetOrganizationSchema.parse(args));
        break;
      case "list_macros":
        result = await listMacros(ListMacrosSchema.parse(args));
        break;
      case "apply_macro":
        result = await applyMacro(ApplyMacroSchema.parse(args));
        break;
      case "list_views":
        result = await listViews(ListViewsSchema.parse(args));
        break;
      case "get_view_tickets":
        result = await getViewTickets(GetViewTicketsSchema.parse(args));
        break;
      case "list_triggers":
        result = await listTriggers(ListTriggersSchema.parse(args));
        break;
      case "get_ticket_metrics":
        result = await getTicketMetrics(GetTicketMetricsSchema.parse(args));
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
  console.error("Zendesk MCP Server started");
}

main().catch(console.error);
