/**
 * Microsoft Outlook MCP Server
 *
 * Provides email, calendar, and contacts operations for KOSMOS agents via Microsoft Graph API.
 * Features:
 * - List, search, send, reply, forward, delete emails
 * - Manage mail folders and attachments
 * - Create and manage drafts
 * - Calendar event management
 * - Contact list access
 * - Message flagging and organization
 *
 * Authentication: Uses OAuth2 with client credentials or refresh token.
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
  clientId: process.env.OUTLOOK_CLIENT_ID || "",
  clientSecret: process.env.OUTLOOK_CLIENT_SECRET || "",
  tenantId: process.env.OUTLOOK_TENANT_ID || "common",
  refreshToken: process.env.OUTLOOK_REFRESH_TOKEN || "",
  redirectUri: process.env.OUTLOOK_REDIRECT_URI || "http://localhost:3000/callback",
};

// =============================================================================
// Microsoft Graph Client
// =============================================================================

interface GraphClientOptions {
  accessToken: string;
}

class GraphClient {
  private accessToken: string;
  private baseUrl = "https://graph.microsoft.com/v1.0";

  constructor(options: GraphClientOptions) {
    this.accessToken = options.accessToken;
  }

  async request<T>(
    method: string,
    path: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Graph API error: ${response.status}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body?: any): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async patch<T>(path: string, body?: any): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  async delete(path: string): Promise<void> {
    await this.request("DELETE", path);
  }
}

let graphClient: GraphClient;

async function refreshAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: "refresh_token",
    scope: "https://graph.microsoft.com/.default offline_access",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error_description || "Failed to refresh access token");
  }

  const data = await response.json();
  return data.access_token;
}

async function initializeClient(): Promise<void> {
  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      "Missing credentials. Set OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, and OUTLOOK_REFRESH_TOKEN"
    );
  }

  const accessToken = await refreshAccessToken();
  graphClient = new GraphClient({ accessToken });
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Email Tools
  {
    name: "list_messages",
    description: "List email messages with optional filters. Supports filtering by folder, sender, subject, date range, and read status.",
    inputSchema: {
      type: "object",
      properties: {
        folderId: {
          type: "string",
          description: "Folder ID to list messages from (default: inbox)",
        },
        top: {
          type: "number",
          description: "Maximum number of messages to return (default: 25, max: 100)",
        },
        skip: {
          type: "number",
          description: "Number of messages to skip for pagination",
        },
        filter: {
          type: "string",
          description: "OData filter query (e.g., \"isRead eq false\")",
        },
        orderBy: {
          type: "string",
          description: "Order by field (e.g., \"receivedDateTime desc\")",
        },
        select: {
          type: "array",
          items: { type: "string" },
          description: "Fields to select (e.g., [\"subject\", \"from\", \"receivedDateTime\"])",
        },
      },
    },
  },
  {
    name: "get_message",
    description: "Get full details of a specific email message including body content.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "The message ID",
        },
        includeBody: {
          type: "boolean",
          description: "Include full message body (default: true)",
        },
      },
      required: ["messageId"],
    },
  },
  {
    name: "send_message",
    description: "Send a new email message.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "array",
          items: { type: "string" },
          description: "List of recipient email addresses",
        },
        cc: {
          type: "array",
          items: { type: "string" },
          description: "List of CC recipient email addresses",
        },
        bcc: {
          type: "array",
          items: { type: "string" },
          description: "List of BCC recipient email addresses",
        },
        subject: {
          type: "string",
          description: "Email subject",
        },
        body: {
          type: "string",
          description: "Email body content",
        },
        bodyType: {
          type: "string",
          enum: ["text", "html"],
          description: "Body content type (default: text)",
        },
        importance: {
          type: "string",
          enum: ["low", "normal", "high"],
          description: "Message importance (default: normal)",
        },
        saveToSentItems: {
          type: "boolean",
          description: "Save to sent items folder (default: true)",
        },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "reply_to_message",
    description: "Reply to an email message.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "The message ID to reply to",
        },
        body: {
          type: "string",
          description: "Reply body content",
        },
        replyAll: {
          type: "boolean",
          description: "Reply to all recipients (default: false)",
        },
      },
      required: ["messageId", "body"],
    },
  },
  {
    name: "forward_message",
    description: "Forward an email message to other recipients.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "The message ID to forward",
        },
        to: {
          type: "array",
          items: { type: "string" },
          description: "List of recipient email addresses",
        },
        comment: {
          type: "string",
          description: "Optional comment to include with the forwarded message",
        },
      },
      required: ["messageId", "to"],
    },
  },
  {
    name: "delete_message",
    description: "Delete an email message (moves to Deleted Items).",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "The message ID to delete",
        },
        permanent: {
          type: "boolean",
          description: "Permanently delete (skip Deleted Items) - default: false",
        },
      },
      required: ["messageId"],
    },
  },
  {
    name: "move_message",
    description: "Move an email message to a different folder.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "The message ID to move",
        },
        destinationFolderId: {
          type: "string",
          description: "Destination folder ID",
        },
      },
      required: ["messageId", "destinationFolderId"],
    },
  },
  {
    name: "search_messages",
    description: "Search email messages using Microsoft Search.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query string",
        },
        top: {
          type: "number",
          description: "Maximum results to return (default: 25)",
        },
        folderId: {
          type: "string",
          description: "Limit search to specific folder",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "flag_message",
    description: "Flag or unflag an email message for follow-up.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "The message ID",
        },
        flagStatus: {
          type: "string",
          enum: ["notFlagged", "flagged", "complete"],
          description: "Flag status to set",
        },
        dueDateTime: {
          type: "string",
          description: "Due date for flagged item (ISO 8601)",
        },
      },
      required: ["messageId", "flagStatus"],
    },
  },

  // Folder Tools
  {
    name: "list_folders",
    description: "List mail folders.",
    inputSchema: {
      type: "object",
      properties: {
        parentFolderId: {
          type: "string",
          description: "Parent folder ID to list subfolders (omit for top-level)",
        },
        includeHidden: {
          type: "boolean",
          description: "Include hidden folders (default: false)",
        },
      },
    },
  },
  {
    name: "create_folder",
    description: "Create a new mail folder.",
    inputSchema: {
      type: "object",
      properties: {
        displayName: {
          type: "string",
          description: "Name for the new folder",
        },
        parentFolderId: {
          type: "string",
          description: "Parent folder ID (omit for top-level)",
        },
        isHidden: {
          type: "boolean",
          description: "Create as hidden folder (default: false)",
        },
      },
      required: ["displayName"],
    },
  },

  // Attachment Tools
  {
    name: "list_attachments",
    description: "List attachments of an email message.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "The message ID",
        },
      },
      required: ["messageId"],
    },
  },
  {
    name: "get_attachment",
    description: "Download/get attachment content.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "The message ID",
        },
        attachmentId: {
          type: "string",
          description: "The attachment ID",
        },
      },
      required: ["messageId", "attachmentId"],
    },
  },
  {
    name: "add_attachment",
    description: "Add an attachment to a draft message.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "The draft message ID",
        },
        name: {
          type: "string",
          description: "Attachment file name",
        },
        contentType: {
          type: "string",
          description: "MIME type of the attachment",
        },
        contentBytes: {
          type: "string",
          description: "Base64 encoded content of the attachment",
        },
      },
      required: ["messageId", "name", "contentBytes"],
    },
  },

  // Draft Tools
  {
    name: "create_draft",
    description: "Create a new draft email message.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "array",
          items: { type: "string" },
          description: "List of recipient email addresses",
        },
        cc: {
          type: "array",
          items: { type: "string" },
          description: "List of CC recipient email addresses",
        },
        bcc: {
          type: "array",
          items: { type: "string" },
          description: "List of BCC recipient email addresses",
        },
        subject: {
          type: "string",
          description: "Email subject",
        },
        body: {
          type: "string",
          description: "Email body content",
        },
        bodyType: {
          type: "string",
          enum: ["text", "html"],
          description: "Body content type (default: text)",
        },
        importance: {
          type: "string",
          enum: ["low", "normal", "high"],
          description: "Message importance (default: normal)",
        },
      },
    },
  },
  {
    name: "update_draft",
    description: "Update an existing draft message.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "The draft message ID",
        },
        to: {
          type: "array",
          items: { type: "string" },
          description: "Updated list of recipient email addresses",
        },
        cc: {
          type: "array",
          items: { type: "string" },
          description: "Updated list of CC recipient email addresses",
        },
        bcc: {
          type: "array",
          items: { type: "string" },
          description: "Updated list of BCC recipient email addresses",
        },
        subject: {
          type: "string",
          description: "Updated email subject",
        },
        body: {
          type: "string",
          description: "Updated email body content",
        },
        bodyType: {
          type: "string",
          enum: ["text", "html"],
          description: "Body content type",
        },
      },
      required: ["messageId"],
    },
  },
  {
    name: "send_draft",
    description: "Send an existing draft message.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "The draft message ID to send",
        },
      },
      required: ["messageId"],
    },
  },

  // Calendar Tools
  {
    name: "list_calendar_events",
    description: "List calendar events within a time range.",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: {
          type: "string",
          description: "Calendar ID (default: primary calendar)",
        },
        startDateTime: {
          type: "string",
          description: "Start of time range (ISO 8601)",
        },
        endDateTime: {
          type: "string",
          description: "End of time range (ISO 8601)",
        },
        top: {
          type: "number",
          description: "Maximum events to return (default: 50)",
        },
        filter: {
          type: "string",
          description: "OData filter query",
        },
      },
    },
  },
  {
    name: "create_event",
    description: "Create a new calendar event.",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: {
          type: "string",
          description: "Calendar ID (default: primary)",
        },
        subject: {
          type: "string",
          description: "Event title/subject",
        },
        body: {
          type: "string",
          description: "Event description",
        },
        bodyType: {
          type: "string",
          enum: ["text", "html"],
          description: "Body content type (default: text)",
        },
        start: {
          type: "string",
          description: "Start time (ISO 8601)",
        },
        end: {
          type: "string",
          description: "End time (ISO 8601)",
        },
        timeZone: {
          type: "string",
          description: "Time zone (e.g., 'Pacific Standard Time')",
        },
        location: {
          type: "string",
          description: "Event location",
        },
        attendees: {
          type: "array",
          items: { type: "string" },
          description: "List of attendee email addresses",
        },
        isAllDay: {
          type: "boolean",
          description: "All-day event (default: false)",
        },
        isOnlineMeeting: {
          type: "boolean",
          description: "Create Teams meeting (default: false)",
        },
        recurrence: {
          type: "object",
          description: "Recurrence pattern",
        },
        reminderMinutesBefore: {
          type: "number",
          description: "Reminder minutes before start",
        },
        showAs: {
          type: "string",
          enum: ["free", "tentative", "busy", "oof", "workingElsewhere", "unknown"],
          description: "Show as status (default: busy)",
        },
        importance: {
          type: "string",
          enum: ["low", "normal", "high"],
          description: "Event importance",
        },
      },
      required: ["subject", "start", "end"],
    },
  },

  // Contacts Tools
  {
    name: "list_contacts",
    description: "List contacts from the user's contact list.",
    inputSchema: {
      type: "object",
      properties: {
        top: {
          type: "number",
          description: "Maximum contacts to return (default: 50)",
        },
        skip: {
          type: "number",
          description: "Number of contacts to skip for pagination",
        },
        filter: {
          type: "string",
          description: "OData filter query",
        },
        orderBy: {
          type: "string",
          description: "Order by field (e.g., \"displayName\")",
        },
        search: {
          type: "string",
          description: "Search query for contacts",
        },
      },
    },
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

interface Recipient {
  emailAddress: {
    address: string;
    name?: string;
  };
}

function formatRecipients(emails: string[] | undefined): Recipient[] | undefined {
  if (!emails || emails.length === 0) return undefined;
  return emails.map((email) => ({
    emailAddress: { address: email },
  }));
}

function formatMessage(message: any): any {
  return {
    id: message.id,
    conversationId: message.conversationId,
    subject: message.subject,
    from: message.from?.emailAddress,
    toRecipients: message.toRecipients?.map((r: any) => r.emailAddress),
    ccRecipients: message.ccRecipients?.map((r: any) => r.emailAddress),
    bccRecipients: message.bccRecipients?.map((r: any) => r.emailAddress),
    receivedDateTime: message.receivedDateTime,
    sentDateTime: message.sentDateTime,
    hasAttachments: message.hasAttachments,
    isRead: message.isRead,
    isDraft: message.isDraft,
    importance: message.importance,
    flag: message.flag,
    bodyPreview: message.bodyPreview,
    body: message.body,
    webLink: message.webLink,
    parentFolderId: message.parentFolderId,
  };
}

function formatEvent(event: any): any {
  return {
    id: event.id,
    subject: event.subject,
    body: event.body,
    start: event.start,
    end: event.end,
    location: event.location,
    locations: event.locations,
    attendees: event.attendees?.map((a: any) => ({
      email: a.emailAddress?.address,
      name: a.emailAddress?.name,
      status: a.status,
      type: a.type,
    })),
    organizer: event.organizer?.emailAddress,
    isAllDay: event.isAllDay,
    isCancelled: event.isCancelled,
    isOnlineMeeting: event.isOnlineMeeting,
    onlineMeetingUrl: event.onlineMeetingUrl,
    onlineMeeting: event.onlineMeeting,
    recurrence: event.recurrence,
    seriesMasterId: event.seriesMasterId,
    showAs: event.showAs,
    importance: event.importance,
    sensitivity: event.sensitivity,
    webLink: event.webLink,
    createdDateTime: event.createdDateTime,
    lastModifiedDateTime: event.lastModifiedDateTime,
  };
}

function formatContact(contact: any): any {
  return {
    id: contact.id,
    displayName: contact.displayName,
    givenName: contact.givenName,
    surname: contact.surname,
    emailAddresses: contact.emailAddresses,
    businessPhones: contact.businessPhones,
    mobilePhone: contact.mobilePhone,
    homePhones: contact.homePhones,
    jobTitle: contact.jobTitle,
    companyName: contact.companyName,
    department: contact.department,
    officeLocation: contact.officeLocation,
    businessAddress: contact.businessAddress,
    homeAddress: contact.homeAddress,
    personalNotes: contact.personalNotes,
    birthday: contact.birthday,
    createdDateTime: contact.createdDateTime,
  };
}

// =============================================================================
// Tool Implementations
// =============================================================================

async function listMessages(params: {
  folderId?: string;
  top?: number;
  skip?: number;
  filter?: string;
  orderBy?: string;
  select?: string[];
}): Promise<any> {
  const folder = params.folderId || "inbox";
  const top = Math.min(params.top || 25, 100);

  let path = `/me/mailFolders/${folder}/messages?$top=${top}`;

  if (params.skip) {
    path += `&$skip=${params.skip}`;
  }
  if (params.filter) {
    path += `&$filter=${encodeURIComponent(params.filter)}`;
  }
  if (params.orderBy) {
    path += `&$orderby=${encodeURIComponent(params.orderBy)}`;
  } else {
    path += `&$orderby=receivedDateTime desc`;
  }
  if (params.select && params.select.length > 0) {
    path += `&$select=${params.select.join(",")}`;
  }

  const response = await graphClient.get<any>(path);

  return {
    messages: response.value?.map(formatMessage) || [],
    nextLink: response["@odata.nextLink"],
    count: response["@odata.count"],
  };
}

async function getMessage(params: {
  messageId: string;
  includeBody?: boolean;
}): Promise<any> {
  let path = `/me/messages/${params.messageId}`;
  if (params.includeBody !== false) {
    path += "?$select=id,conversationId,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,sentDateTime,hasAttachments,isRead,isDraft,importance,flag,body,bodyPreview,webLink,parentFolderId";
  }

  const message = await graphClient.get<any>(path);
  return formatMessage(message);
}

async function sendMessage(params: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  bodyType?: string;
  importance?: string;
  saveToSentItems?: boolean;
}): Promise<any> {
  const message = {
    message: {
      subject: params.subject,
      body: {
        contentType: params.bodyType === "html" ? "HTML" : "Text",
        content: params.body,
      },
      toRecipients: formatRecipients(params.to),
      ccRecipients: formatRecipients(params.cc),
      bccRecipients: formatRecipients(params.bcc),
      importance: params.importance || "normal",
    },
    saveToSentItems: params.saveToSentItems !== false,
  };

  await graphClient.post("/me/sendMail", message);

  return {
    success: true,
    message: "Email sent successfully",
    to: params.to,
    subject: params.subject,
  };
}

async function replyToMessage(params: {
  messageId: string;
  body: string;
  replyAll?: boolean;
}): Promise<any> {
  const endpoint = params.replyAll
    ? `/me/messages/${params.messageId}/replyAll`
    : `/me/messages/${params.messageId}/reply`;

  await graphClient.post(endpoint, {
    comment: params.body,
  });

  return {
    success: true,
    message: params.replyAll ? "Reply all sent successfully" : "Reply sent successfully",
    messageId: params.messageId,
  };
}

async function forwardMessage(params: {
  messageId: string;
  to: string[];
  comment?: string;
}): Promise<any> {
  await graphClient.post(`/me/messages/${params.messageId}/forward`, {
    toRecipients: formatRecipients(params.to),
    comment: params.comment,
  });

  return {
    success: true,
    message: "Message forwarded successfully",
    messageId: params.messageId,
    forwardedTo: params.to,
  };
}

async function deleteMessage(params: {
  messageId: string;
  permanent?: boolean;
}): Promise<any> {
  if (params.permanent) {
    await graphClient.delete(`/me/messages/${params.messageId}`);
  } else {
    // Move to deleted items
    await graphClient.post(`/me/messages/${params.messageId}/move`, {
      destinationId: "deleteditems",
    });
  }

  return {
    success: true,
    message: params.permanent ? "Message permanently deleted" : "Message moved to Deleted Items",
    messageId: params.messageId,
  };
}

async function moveMessage(params: {
  messageId: string;
  destinationFolderId: string;
}): Promise<any> {
  const result = await graphClient.post<any>(`/me/messages/${params.messageId}/move`, {
    destinationId: params.destinationFolderId,
  });

  return {
    success: true,
    message: "Message moved successfully",
    messageId: result.id,
    destinationFolderId: params.destinationFolderId,
  };
}

async function searchMessages(params: {
  query: string;
  top?: number;
  folderId?: string;
}): Promise<any> {
  const top = params.top || 25;
  let path = `/me/messages?$search="${encodeURIComponent(params.query)}"&$top=${top}`;

  if (params.folderId) {
    path = `/me/mailFolders/${params.folderId}/messages?$search="${encodeURIComponent(params.query)}"&$top=${top}`;
  }

  const response = await graphClient.get<any>(path);

  return {
    query: params.query,
    messages: response.value?.map(formatMessage) || [],
    count: response.value?.length || 0,
  };
}

async function flagMessage(params: {
  messageId: string;
  flagStatus: string;
  dueDateTime?: string;
}): Promise<any> {
  const flag: any = {
    flagStatus: params.flagStatus,
  };

  if (params.dueDateTime && params.flagStatus === "flagged") {
    flag.dueDateTime = {
      dateTime: params.dueDateTime,
      timeZone: "UTC",
    };
  }

  await graphClient.patch(`/me/messages/${params.messageId}`, { flag });

  return {
    success: true,
    message: `Message flag status set to ${params.flagStatus}`,
    messageId: params.messageId,
  };
}

async function listFolders(params: {
  parentFolderId?: string;
  includeHidden?: boolean;
}): Promise<any> {
  let path = params.parentFolderId
    ? `/me/mailFolders/${params.parentFolderId}/childFolders`
    : "/me/mailFolders";

  if (params.includeHidden) {
    path += "?includeHiddenFolders=true";
  }

  const response = await graphClient.get<any>(path);

  return {
    folders: response.value?.map((folder: any) => ({
      id: folder.id,
      displayName: folder.displayName,
      parentFolderId: folder.parentFolderId,
      childFolderCount: folder.childFolderCount,
      totalItemCount: folder.totalItemCount,
      unreadItemCount: folder.unreadItemCount,
      isHidden: folder.isHidden,
    })) || [],
  };
}

async function createFolder(params: {
  displayName: string;
  parentFolderId?: string;
  isHidden?: boolean;
}): Promise<any> {
  const path = params.parentFolderId
    ? `/me/mailFolders/${params.parentFolderId}/childFolders`
    : "/me/mailFolders";

  const folder = await graphClient.post<any>(path, {
    displayName: params.displayName,
    isHidden: params.isHidden || false,
  });

  return {
    success: true,
    folder: {
      id: folder.id,
      displayName: folder.displayName,
      parentFolderId: folder.parentFolderId,
    },
  };
}

async function listAttachments(params: {
  messageId: string;
}): Promise<any> {
  const response = await graphClient.get<any>(`/me/messages/${params.messageId}/attachments`);

  return {
    messageId: params.messageId,
    attachments: response.value?.map((att: any) => ({
      id: att.id,
      name: att.name,
      contentType: att.contentType,
      size: att.size,
      isInline: att.isInline,
      lastModifiedDateTime: att.lastModifiedDateTime,
      "@odata.type": att["@odata.type"],
    })) || [],
  };
}

async function getAttachment(params: {
  messageId: string;
  attachmentId: string;
}): Promise<any> {
  const attachment = await graphClient.get<any>(
    `/me/messages/${params.messageId}/attachments/${params.attachmentId}`
  );

  return {
    id: attachment.id,
    name: attachment.name,
    contentType: attachment.contentType,
    size: attachment.size,
    isInline: attachment.isInline,
    contentBytes: attachment.contentBytes, // Base64 encoded
    "@odata.type": attachment["@odata.type"],
  };
}

async function addAttachment(params: {
  messageId: string;
  name: string;
  contentType?: string;
  contentBytes: string;
}): Promise<any> {
  const attachment = await graphClient.post<any>(
    `/me/messages/${params.messageId}/attachments`,
    {
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: params.name,
      contentType: params.contentType || "application/octet-stream",
      contentBytes: params.contentBytes,
    }
  );

  return {
    success: true,
    attachment: {
      id: attachment.id,
      name: attachment.name,
      contentType: attachment.contentType,
      size: attachment.size,
    },
  };
}

async function createDraft(params: {
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
  bodyType?: string;
  importance?: string;
}): Promise<any> {
  const draft: any = {
    subject: params.subject || "",
    importance: params.importance || "normal",
  };

  if (params.body) {
    draft.body = {
      contentType: params.bodyType === "html" ? "HTML" : "Text",
      content: params.body,
    };
  }

  if (params.to) {
    draft.toRecipients = formatRecipients(params.to);
  }
  if (params.cc) {
    draft.ccRecipients = formatRecipients(params.cc);
  }
  if (params.bcc) {
    draft.bccRecipients = formatRecipients(params.bcc);
  }

  const message = await graphClient.post<any>("/me/messages", draft);

  return formatMessage(message);
}

async function updateDraft(params: {
  messageId: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
  bodyType?: string;
}): Promise<any> {
  const update: any = {};

  if (params.subject !== undefined) {
    update.subject = params.subject;
  }
  if (params.body !== undefined) {
    update.body = {
      contentType: params.bodyType === "html" ? "HTML" : "Text",
      content: params.body,
    };
  }
  if (params.to) {
    update.toRecipients = formatRecipients(params.to);
  }
  if (params.cc) {
    update.ccRecipients = formatRecipients(params.cc);
  }
  if (params.bcc) {
    update.bccRecipients = formatRecipients(params.bcc);
  }

  const message = await graphClient.patch<any>(`/me/messages/${params.messageId}`, update);

  return formatMessage(message);
}

async function sendDraft(params: {
  messageId: string;
}): Promise<any> {
  await graphClient.post(`/me/messages/${params.messageId}/send`, {});

  return {
    success: true,
    message: "Draft sent successfully",
    messageId: params.messageId,
  };
}

async function listCalendarEvents(params: {
  calendarId?: string;
  startDateTime?: string;
  endDateTime?: string;
  top?: number;
  filter?: string;
}): Promise<any> {
  const top = params.top || 50;
  const calendarPath = params.calendarId
    ? `/me/calendars/${params.calendarId}/events`
    : "/me/events";

  let path = `${calendarPath}?$top=${top}`;

  if (params.startDateTime && params.endDateTime) {
    // Use calendar view for time range
    const viewPath = params.calendarId
      ? `/me/calendars/${params.calendarId}/calendarView`
      : "/me/calendarView";
    path = `${viewPath}?startDateTime=${encodeURIComponent(params.startDateTime)}&endDateTime=${encodeURIComponent(params.endDateTime)}&$top=${top}`;
  } else if (params.filter) {
    path += `&$filter=${encodeURIComponent(params.filter)}`;
  }

  path += "&$orderby=start/dateTime";

  const response = await graphClient.get<any>(path);

  return {
    events: response.value?.map(formatEvent) || [],
    count: response.value?.length || 0,
    nextLink: response["@odata.nextLink"],
  };
}

async function createEvent(params: {
  calendarId?: string;
  subject: string;
  body?: string;
  bodyType?: string;
  start: string;
  end: string;
  timeZone?: string;
  location?: string;
  attendees?: string[];
  isAllDay?: boolean;
  isOnlineMeeting?: boolean;
  recurrence?: any;
  reminderMinutesBefore?: number;
  showAs?: string;
  importance?: string;
}): Promise<any> {
  const timeZone = params.timeZone || "UTC";

  const event: any = {
    subject: params.subject,
    start: {
      dateTime: params.start,
      timeZone,
    },
    end: {
      dateTime: params.end,
      timeZone,
    },
    isAllDay: params.isAllDay || false,
    showAs: params.showAs || "busy",
    importance: params.importance || "normal",
  };

  if (params.body) {
    event.body = {
      contentType: params.bodyType === "html" ? "HTML" : "Text",
      content: params.body,
    };
  }

  if (params.location) {
    event.location = {
      displayName: params.location,
    };
  }

  if (params.attendees && params.attendees.length > 0) {
    event.attendees = params.attendees.map((email) => ({
      emailAddress: { address: email },
      type: "required",
    }));
  }

  if (params.isOnlineMeeting) {
    event.isOnlineMeeting = true;
    event.onlineMeetingProvider = "teamsForBusiness";
  }

  if (params.recurrence) {
    event.recurrence = params.recurrence;
  }

  if (params.reminderMinutesBefore !== undefined) {
    event.isReminderOn = true;
    event.reminderMinutesBeforeStart = params.reminderMinutesBefore;
  }

  const path = params.calendarId
    ? `/me/calendars/${params.calendarId}/events`
    : "/me/events";

  const created = await graphClient.post<any>(path, event);

  return formatEvent(created);
}

async function listContacts(params: {
  top?: number;
  skip?: number;
  filter?: string;
  orderBy?: string;
  search?: string;
}): Promise<any> {
  const top = params.top || 50;
  let path = `/me/contacts?$top=${top}`;

  if (params.skip) {
    path += `&$skip=${params.skip}`;
  }
  if (params.filter) {
    path += `&$filter=${encodeURIComponent(params.filter)}`;
  }
  if (params.orderBy) {
    path += `&$orderby=${encodeURIComponent(params.orderBy)}`;
  }
  if (params.search) {
    path += `&$search="${encodeURIComponent(params.search)}"`;
  }

  const response = await graphClient.get<any>(path);

  return {
    contacts: response.value?.map(formatContact) || [],
    count: response.value?.length || 0,
    nextLink: response["@odata.nextLink"],
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "outlook-mcp",
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
      // Email Tools
      case "list_messages":
        result = await listMessages(args as any);
        break;
      case "get_message":
        result = await getMessage(args as any);
        break;
      case "send_message":
        result = await sendMessage(args as any);
        break;
      case "reply_to_message":
        result = await replyToMessage(args as any);
        break;
      case "forward_message":
        result = await forwardMessage(args as any);
        break;
      case "delete_message":
        result = await deleteMessage(args as any);
        break;
      case "move_message":
        result = await moveMessage(args as any);
        break;
      case "search_messages":
        result = await searchMessages(args as any);
        break;
      case "flag_message":
        result = await flagMessage(args as any);
        break;

      // Folder Tools
      case "list_folders":
        result = await listFolders(args as any);
        break;
      case "create_folder":
        result = await createFolder(args as any);
        break;

      // Attachment Tools
      case "list_attachments":
        result = await listAttachments(args as any);
        break;
      case "get_attachment":
        result = await getAttachment(args as any);
        break;
      case "add_attachment":
        result = await addAttachment(args as any);
        break;

      // Draft Tools
      case "create_draft":
        result = await createDraft(args as any);
        break;
      case "update_draft":
        result = await updateDraft(args as any);
        break;
      case "send_draft":
        result = await sendDraft(args as any);
        break;

      // Calendar Tools
      case "list_calendar_events":
        result = await listCalendarEvents(args as any);
        break;
      case "create_event":
        result = await createEvent(args as any);
        break;

      // Contact Tools
      case "list_contacts":
        result = await listContacts(args as any);
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
            code: error.code,
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
  await initializeClient();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Microsoft Outlook MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
