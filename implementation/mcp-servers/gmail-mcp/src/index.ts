/**
 * Gmail MCP Server
 *
 * Provides email operations for KOSMOS agents.
 * Features:
 * - List, search, and get messages
 * - Send, reply, and forward emails
 * - Manage labels
 * - Handle threads and drafts
 * - Mark messages as read/unread
 * - Get attachments
 *
 * Authentication: Uses OAuth2 credentials.
 * Required env vars: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { google, gmail_v1 } from "googleapis";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  clientId: process.env.GMAIL_CLIENT_ID || "",
  clientSecret: process.env.GMAIL_CLIENT_SECRET || "",
  refreshToken: process.env.GMAIL_REFRESH_TOKEN || "",
};

// =============================================================================
// Gmail Client
// =============================================================================

let gmail: gmail_v1.Gmail;
let userEmail: string = "me";

async function initializeClient(): Promise<void> {
  if (!config.clientId || !config.clientSecret || !config.refreshToken) {
    throw new Error(
      "Missing required credentials. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN"
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret
  );

  oauth2Client.setCredentials({
    refresh_token: config.refreshToken,
  });

  gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Get the user's email address
  try {
    const profile = await gmail.users.getProfile({ userId: "me" });
    userEmail = profile.data.emailAddress || "me";
  } catch (error) {
    console.error("Could not fetch user profile, using 'me' as userId");
  }
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  {
    name: "list_messages",
    description: "List messages with optional query filters. Returns message IDs and snippets.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Gmail search query (e.g., 'is:unread', 'from:user@example.com')",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of messages to return (default: 20, max: 500)",
        },
        pageToken: {
          type: "string",
          description: "Page token for pagination",
        },
        labelIds: {
          type: "array",
          items: { type: "string" },
          description: "Only return messages with these label IDs",
        },
        includeSpamTrash: {
          type: "boolean",
          description: "Include messages from SPAM and TRASH",
        },
      },
    },
  },
  {
    name: "get_message",
    description: "Get full details of a specific message including headers, body, and attachments info.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "The message ID",
        },
        format: {
          type: "string",
          enum: ["minimal", "full", "raw", "metadata"],
          description: "Message format (default: full)",
        },
        metadataHeaders: {
          type: "array",
          items: { type: "string" },
          description: "Headers to include when format is metadata",
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
          description: "Recipient email addresses",
        },
        cc: {
          type: "array",
          items: { type: "string" },
          description: "CC email addresses",
        },
        bcc: {
          type: "array",
          items: { type: "string" },
          description: "BCC email addresses",
        },
        subject: {
          type: "string",
          description: "Email subject",
        },
        body: {
          type: "string",
          description: "Email body (plain text)",
        },
        htmlBody: {
          type: "string",
          description: "Email body (HTML)",
        },
        attachments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              filename: { type: "string" },
              mimeType: { type: "string" },
              data: { type: "string", description: "Base64 encoded data" },
            },
          },
          description: "File attachments",
        },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "reply_to_message",
    description: "Reply to an existing email message.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "ID of the message to reply to",
        },
        body: {
          type: "string",
          description: "Reply body (plain text)",
        },
        htmlBody: {
          type: "string",
          description: "Reply body (HTML)",
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
    description: "Forward an existing email message to new recipients.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "ID of the message to forward",
        },
        to: {
          type: "array",
          items: { type: "string" },
          description: "Recipient email addresses",
        },
        cc: {
          type: "array",
          items: { type: "string" },
          description: "CC email addresses",
        },
        additionalMessage: {
          type: "string",
          description: "Optional message to prepend to the forwarded content",
        },
      },
      required: ["messageId", "to"],
    },
  },
  {
    name: "delete_message",
    description: "Move a message to trash.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "ID of the message to delete (move to trash)",
        },
        permanent: {
          type: "boolean",
          description: "Permanently delete (skip trash). Use with caution!",
        },
      },
      required: ["messageId"],
    },
  },
  {
    name: "list_labels",
    description: "List all labels in the user's mailbox.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_label",
    description: "Create a new label.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Label name",
        },
        labelListVisibility: {
          type: "string",
          enum: ["labelShow", "labelShowIfUnread", "labelHide"],
          description: "Visibility in label list",
        },
        messageListVisibility: {
          type: "string",
          enum: ["show", "hide"],
          description: "Visibility in message list",
        },
        backgroundColor: {
          type: "string",
          description: "Background color hex code",
        },
        textColor: {
          type: "string",
          description: "Text color hex code",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "apply_label",
    description: "Apply a label to a message.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "ID of the message",
        },
        labelIds: {
          type: "array",
          items: { type: "string" },
          description: "Label IDs to apply",
        },
      },
      required: ["messageId", "labelIds"],
    },
  },
  {
    name: "remove_label",
    description: "Remove a label from a message.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "ID of the message",
        },
        labelIds: {
          type: "array",
          items: { type: "string" },
          description: "Label IDs to remove",
        },
      },
      required: ["messageId", "labelIds"],
    },
  },
  {
    name: "list_threads",
    description: "List email threads with optional query filters.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Gmail search query",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of threads to return (default: 20)",
        },
        pageToken: {
          type: "string",
          description: "Page token for pagination",
        },
        labelIds: {
          type: "array",
          items: { type: "string" },
          description: "Only return threads with these label IDs",
        },
        includeSpamTrash: {
          type: "boolean",
          description: "Include threads from SPAM and TRASH",
        },
      },
    },
  },
  {
    name: "get_thread",
    description: "Get full details of an email thread including all messages.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "string",
          description: "The thread ID",
        },
        format: {
          type: "string",
          enum: ["minimal", "full", "metadata"],
          description: "Message format (default: full)",
        },
      },
      required: ["threadId"],
    },
  },
  {
    name: "archive_thread",
    description: "Archive a thread by removing the INBOX label.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "string",
          description: "ID of the thread to archive",
        },
      },
      required: ["threadId"],
    },
  },
  {
    name: "list_drafts",
    description: "List all drafts in the user's mailbox.",
    inputSchema: {
      type: "object",
      properties: {
        maxResults: {
          type: "number",
          description: "Maximum number of drafts to return (default: 20)",
        },
        pageToken: {
          type: "string",
          description: "Page token for pagination",
        },
      },
    },
  },
  {
    name: "create_draft",
    description: "Create a new email draft.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "array",
          items: { type: "string" },
          description: "Recipient email addresses",
        },
        cc: {
          type: "array",
          items: { type: "string" },
          description: "CC email addresses",
        },
        bcc: {
          type: "array",
          items: { type: "string" },
          description: "BCC email addresses",
        },
        subject: {
          type: "string",
          description: "Email subject",
        },
        body: {
          type: "string",
          description: "Email body (plain text)",
        },
        htmlBody: {
          type: "string",
          description: "Email body (HTML)",
        },
        threadId: {
          type: "string",
          description: "Thread ID to associate the draft with (for replies)",
        },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "send_draft",
    description: "Send an existing draft.",
    inputSchema: {
      type: "object",
      properties: {
        draftId: {
          type: "string",
          description: "ID of the draft to send",
        },
      },
      required: ["draftId"],
    },
  },
  {
    name: "search_messages",
    description: "Search messages using Gmail query syntax with advanced options.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Gmail search query (e.g., 'from:user@example.com subject:meeting after:2024/01/01')",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results (default: 50)",
        },
        includeFullMessages: {
          type: "boolean",
          description: "Include full message details in results (slower)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_attachment",
    description: "Get a message attachment by ID.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "ID of the message containing the attachment",
        },
        attachmentId: {
          type: "string",
          description: "ID of the attachment",
        },
      },
      required: ["messageId", "attachmentId"],
    },
  },
  {
    name: "mark_read",
    description: "Mark a message as read.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "ID of the message to mark as read",
        },
      },
      required: ["messageId"],
    },
  },
  {
    name: "mark_unread",
    description: "Mark a message as unread.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "ID of the message to mark as unread",
        },
      },
      required: ["messageId"],
    },
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string {
  if (!headers) return "";
  const header = headers.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return header?.value || "";
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function encodeBase64Url(data: string): string {
  return Buffer.from(data, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function getMessageBody(payload: gmail_v1.Schema$MessagePart | undefined): {
  text: string;
  html: string;
} {
  const result = { text: "", html: "" };
  if (!payload) return result;

  function extractParts(part: gmail_v1.Schema$MessagePart): void {
    if (part.mimeType === "text/plain" && part.body?.data) {
      result.text = decodeBase64Url(part.body.data);
    } else if (part.mimeType === "text/html" && part.body?.data) {
      result.html = decodeBase64Url(part.body.data);
    } else if (part.parts) {
      part.parts.forEach(extractParts);
    }
  }

  extractParts(payload);
  return result;
}

function getAttachments(
  payload: gmail_v1.Schema$MessagePart | undefined
): Array<{ id: string; filename: string; mimeType: string; size: number }> {
  const attachments: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  }> = [];

  function extractAttachments(part: gmail_v1.Schema$MessagePart): void {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        id: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body.size || 0,
      });
    }
    if (part.parts) {
      part.parts.forEach(extractAttachments);
    }
  }

  if (payload) {
    extractAttachments(payload);
  }
  return attachments;
}

function formatMessage(message: gmail_v1.Schema$Message): any {
  const headers = message.payload?.headers || [];
  const body = getMessageBody(message.payload);
  const attachments = getAttachments(message.payload);

  return {
    id: message.id,
    threadId: message.threadId,
    labelIds: message.labelIds,
    snippet: message.snippet,
    historyId: message.historyId,
    internalDate: message.internalDate,
    sizeEstimate: message.sizeEstimate,
    headers: {
      from: getHeader(headers, "From"),
      to: getHeader(headers, "To"),
      cc: getHeader(headers, "Cc"),
      bcc: getHeader(headers, "Bcc"),
      subject: getHeader(headers, "Subject"),
      date: getHeader(headers, "Date"),
      messageId: getHeader(headers, "Message-ID"),
      inReplyTo: getHeader(headers, "In-Reply-To"),
      references: getHeader(headers, "References"),
    },
    body: body.text || body.html,
    htmlBody: body.html,
    attachments,
    isUnread: message.labelIds?.includes("UNREAD"),
    isStarred: message.labelIds?.includes("STARRED"),
    isImportant: message.labelIds?.includes("IMPORTANT"),
  };
}

function createRawMessage(params: {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
}): string {
  const boundary = `boundary_${Date.now()}`;
  const headers: string[] = [
    `From: ${params.from}`,
    `To: ${params.to.join(", ")}`,
  ];

  if (params.cc?.length) {
    headers.push(`Cc: ${params.cc.join(", ")}`);
  }
  if (params.bcc?.length) {
    headers.push(`Bcc: ${params.bcc.join(", ")}`);
  }
  headers.push(`Subject: ${params.subject}`);
  headers.push(`MIME-Version: 1.0`);

  if (params.inReplyTo) {
    headers.push(`In-Reply-To: ${params.inReplyTo}`);
  }
  if (params.references) {
    headers.push(`References: ${params.references}`);
  }

  let message: string;

  if (params.htmlBody) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    message =
      headers.join("\r\n") +
      "\r\n\r\n" +
      `--${boundary}\r\n` +
      `Content-Type: text/plain; charset="UTF-8"\r\n\r\n` +
      params.body +
      "\r\n" +
      `--${boundary}\r\n` +
      `Content-Type: text/html; charset="UTF-8"\r\n\r\n` +
      params.htmlBody +
      "\r\n" +
      `--${boundary}--`;
  } else {
    headers.push(`Content-Type: text/plain; charset="UTF-8"`);
    message = headers.join("\r\n") + "\r\n\r\n" + params.body;
  }

  return encodeBase64Url(message);
}

// =============================================================================
// Tool Implementations
// =============================================================================

async function listMessages(params: {
  query?: string;
  maxResults?: number;
  pageToken?: string;
  labelIds?: string[];
  includeSpamTrash?: boolean;
}): Promise<any> {
  const response = await gmail.users.messages.list({
    userId: "me",
    q: params.query,
    maxResults: Math.min(params.maxResults || 20, 500),
    pageToken: params.pageToken,
    labelIds: params.labelIds,
    includeSpamTrash: params.includeSpamTrash,
  });

  const messages = await Promise.all(
    (response.data.messages || []).map(async (msg) => {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date"],
      });
      return {
        id: full.data.id,
        threadId: full.data.threadId,
        snippet: full.data.snippet,
        from: getHeader(full.data.payload?.headers, "From"),
        to: getHeader(full.data.payload?.headers, "To"),
        subject: getHeader(full.data.payload?.headers, "Subject"),
        date: getHeader(full.data.payload?.headers, "Date"),
        labelIds: full.data.labelIds,
        isUnread: full.data.labelIds?.includes("UNREAD"),
      };
    })
  );

  return {
    messages,
    nextPageToken: response.data.nextPageToken,
    resultSizeEstimate: response.data.resultSizeEstimate,
  };
}

async function getMessage(params: {
  messageId: string;
  format?: string;
  metadataHeaders?: string[];
}): Promise<any> {
  const response = await gmail.users.messages.get({
    userId: "me",
    id: params.messageId,
    format: (params.format as any) || "full",
    metadataHeaders: params.metadataHeaders,
  });

  return formatMessage(response.data);
}

async function sendMessage(params: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
}): Promise<any> {
  const raw = createRawMessage({
    from: userEmail,
    to: params.to,
    cc: params.cc,
    bcc: params.bcc,
    subject: params.subject,
    body: params.body,
    htmlBody: params.htmlBody,
  });

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return {
    id: response.data.id,
    threadId: response.data.threadId,
    labelIds: response.data.labelIds,
    message: "Email sent successfully",
  };
}

async function replyToMessage(params: {
  messageId: string;
  body: string;
  htmlBody?: string;
  replyAll?: boolean;
}): Promise<any> {
  // Get the original message
  const original = await gmail.users.messages.get({
    userId: "me",
    id: params.messageId,
    format: "full",
  });

  const headers = original.data.payload?.headers || [];
  const originalFrom = getHeader(headers, "From");
  const originalTo = getHeader(headers, "To");
  const originalCc = getHeader(headers, "Cc");
  const originalSubject = getHeader(headers, "Subject");
  const originalMessageId = getHeader(headers, "Message-ID");
  const originalReferences = getHeader(headers, "References");

  // Determine recipients
  const to = [originalFrom];
  let cc: string[] = [];

  if (params.replyAll) {
    // Add original To recipients (excluding self)
    const toAddresses = originalTo
      .split(",")
      .map((a) => a.trim())
      .filter((a) => !a.includes(userEmail));
    to.push(...toAddresses);

    // Add original CC recipients (excluding self)
    if (originalCc) {
      cc = originalCc
        .split(",")
        .map((a) => a.trim())
        .filter((a) => !a.includes(userEmail));
    }
  }

  // Build references
  const references = originalReferences
    ? `${originalReferences} ${originalMessageId}`
    : originalMessageId;

  // Build subject
  const subject = originalSubject.startsWith("Re:")
    ? originalSubject
    : `Re: ${originalSubject}`;

  const raw = createRawMessage({
    from: userEmail,
    to,
    cc,
    subject,
    body: params.body,
    htmlBody: params.htmlBody,
    inReplyTo: originalMessageId,
    references,
  });

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId: original.data.threadId,
    },
  });

  return {
    id: response.data.id,
    threadId: response.data.threadId,
    labelIds: response.data.labelIds,
    message: "Reply sent successfully",
  };
}

async function forwardMessage(params: {
  messageId: string;
  to: string[];
  cc?: string[];
  additionalMessage?: string;
}): Promise<any> {
  // Get the original message
  const original = await gmail.users.messages.get({
    userId: "me",
    id: params.messageId,
    format: "full",
  });

  const headers = original.data.payload?.headers || [];
  const originalFrom = getHeader(headers, "From");
  const originalTo = getHeader(headers, "To");
  const originalSubject = getHeader(headers, "Subject");
  const originalDate = getHeader(headers, "Date");
  const body = getMessageBody(original.data.payload);

  // Build forwarded message body
  const forwardHeader = [
    "---------- Forwarded message ---------",
    `From: ${originalFrom}`,
    `Date: ${originalDate}`,
    `Subject: ${originalSubject}`,
    `To: ${originalTo}`,
    "",
  ].join("\n");

  const fullBody = params.additionalMessage
    ? `${params.additionalMessage}\n\n${forwardHeader}\n${body.text}`
    : `${forwardHeader}\n${body.text}`;

  const subject = originalSubject.startsWith("Fwd:")
    ? originalSubject
    : `Fwd: ${originalSubject}`;

  const raw = createRawMessage({
    from: userEmail,
    to: params.to,
    cc: params.cc,
    subject,
    body: fullBody,
    htmlBody: body.html
      ? `${params.additionalMessage || ""}<br><br>${forwardHeader.replace(/\n/g, "<br>")}<br>${body.html}`
      : undefined,
  });

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return {
    id: response.data.id,
    threadId: response.data.threadId,
    labelIds: response.data.labelIds,
    message: "Email forwarded successfully",
  };
}

async function deleteMessage(params: {
  messageId: string;
  permanent?: boolean;
}): Promise<any> {
  if (params.permanent) {
    await gmail.users.messages.delete({
      userId: "me",
      id: params.messageId,
    });
    return {
      deleted: true,
      messageId: params.messageId,
      permanent: true,
    };
  } else {
    await gmail.users.messages.trash({
      userId: "me",
      id: params.messageId,
    });
    return {
      trashed: true,
      messageId: params.messageId,
      permanent: false,
    };
  }
}

async function listLabels(): Promise<any> {
  const response = await gmail.users.labels.list({
    userId: "me",
  });

  return {
    labels: response.data.labels?.map((label) => ({
      id: label.id,
      name: label.name,
      type: label.type,
      messageListVisibility: label.messageListVisibility,
      labelListVisibility: label.labelListVisibility,
      messagesTotal: label.messagesTotal,
      messagesUnread: label.messagesUnread,
      threadsTotal: label.threadsTotal,
      threadsUnread: label.threadsUnread,
      color: label.color,
    })),
  };
}

async function createLabel(params: {
  name: string;
  labelListVisibility?: string;
  messageListVisibility?: string;
  backgroundColor?: string;
  textColor?: string;
}): Promise<any> {
  const labelData: gmail_v1.Schema$Label = {
    name: params.name,
    labelListVisibility: params.labelListVisibility as any,
    messageListVisibility: params.messageListVisibility as any,
  };

  if (params.backgroundColor || params.textColor) {
    labelData.color = {
      backgroundColor: params.backgroundColor,
      textColor: params.textColor,
    };
  }

  const response = await gmail.users.labels.create({
    userId: "me",
    requestBody: labelData,
  });

  return {
    id: response.data.id,
    name: response.data.name,
    type: response.data.type,
    color: response.data.color,
  };
}

async function applyLabel(params: {
  messageId: string;
  labelIds: string[];
}): Promise<any> {
  const response = await gmail.users.messages.modify({
    userId: "me",
    id: params.messageId,
    requestBody: {
      addLabelIds: params.labelIds,
    },
  });

  return {
    messageId: response.data.id,
    labelIds: response.data.labelIds,
    message: "Labels applied successfully",
  };
}

async function removeLabel(params: {
  messageId: string;
  labelIds: string[];
}): Promise<any> {
  const response = await gmail.users.messages.modify({
    userId: "me",
    id: params.messageId,
    requestBody: {
      removeLabelIds: params.labelIds,
    },
  });

  return {
    messageId: response.data.id,
    labelIds: response.data.labelIds,
    message: "Labels removed successfully",
  };
}

async function listThreads(params: {
  query?: string;
  maxResults?: number;
  pageToken?: string;
  labelIds?: string[];
  includeSpamTrash?: boolean;
}): Promise<any> {
  const response = await gmail.users.threads.list({
    userId: "me",
    q: params.query,
    maxResults: params.maxResults || 20,
    pageToken: params.pageToken,
    labelIds: params.labelIds,
    includeSpamTrash: params.includeSpamTrash,
  });

  const threads = await Promise.all(
    (response.data.threads || []).map(async (thread) => {
      const full = await gmail.users.threads.get({
        userId: "me",
        id: thread.id!,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date"],
      });

      const firstMessage = full.data.messages?.[0];
      const lastMessage = full.data.messages?.[full.data.messages.length - 1];

      return {
        id: full.data.id,
        snippet: full.data.snippet,
        historyId: full.data.historyId,
        messageCount: full.data.messages?.length || 0,
        subject: getHeader(firstMessage?.payload?.headers, "Subject"),
        from: getHeader(firstMessage?.payload?.headers, "From"),
        lastMessageDate: getHeader(lastMessage?.payload?.headers, "Date"),
      };
    })
  );

  return {
    threads,
    nextPageToken: response.data.nextPageToken,
    resultSizeEstimate: response.data.resultSizeEstimate,
  };
}

async function getThread(params: {
  threadId: string;
  format?: string;
}): Promise<any> {
  const response = await gmail.users.threads.get({
    userId: "me",
    id: params.threadId,
    format: (params.format as any) || "full",
  });

  return {
    id: response.data.id,
    historyId: response.data.historyId,
    messages: response.data.messages?.map(formatMessage),
  };
}

async function archiveThread(params: { threadId: string }): Promise<any> {
  await gmail.users.threads.modify({
    userId: "me",
    id: params.threadId,
    requestBody: {
      removeLabelIds: ["INBOX"],
    },
  });

  return {
    threadId: params.threadId,
    archived: true,
    message: "Thread archived successfully",
  };
}

async function listDrafts(params: {
  maxResults?: number;
  pageToken?: string;
}): Promise<any> {
  const response = await gmail.users.drafts.list({
    userId: "me",
    maxResults: params.maxResults || 20,
    pageToken: params.pageToken,
  });

  const drafts = await Promise.all(
    (response.data.drafts || []).map(async (draft) => {
      const full = await gmail.users.drafts.get({
        userId: "me",
        id: draft.id!,
        format: "metadata",
      });

      const message = full.data.message;
      return {
        id: full.data.id,
        messageId: message?.id,
        threadId: message?.threadId,
        snippet: message?.snippet,
        to: getHeader(message?.payload?.headers, "To"),
        subject: getHeader(message?.payload?.headers, "Subject"),
      };
    })
  );

  return {
    drafts,
    nextPageToken: response.data.nextPageToken,
    resultSizeEstimate: response.data.resultSizeEstimate,
  };
}

async function createDraft(params: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  threadId?: string;
}): Promise<any> {
  const raw = createRawMessage({
    from: userEmail,
    to: params.to,
    cc: params.cc,
    bcc: params.bcc,
    subject: params.subject,
    body: params.body,
    htmlBody: params.htmlBody,
  });

  const response = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw,
        threadId: params.threadId,
      },
    },
  });

  return {
    id: response.data.id,
    messageId: response.data.message?.id,
    threadId: response.data.message?.threadId,
    message: "Draft created successfully",
  };
}

async function sendDraft(params: { draftId: string }): Promise<any> {
  const response = await gmail.users.drafts.send({
    userId: "me",
    requestBody: {
      id: params.draftId,
    },
  });

  return {
    id: response.data.id,
    threadId: response.data.threadId,
    labelIds: response.data.labelIds,
    message: "Draft sent successfully",
  };
}

async function searchMessages(params: {
  query: string;
  maxResults?: number;
  includeFullMessages?: boolean;
}): Promise<any> {
  const response = await gmail.users.messages.list({
    userId: "me",
    q: params.query,
    maxResults: params.maxResults || 50,
  });

  if (!params.includeFullMessages) {
    // Return just IDs and snippets
    const messages = await Promise.all(
      (response.data.messages || []).map(async (msg) => {
        const full = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "metadata",
          metadataHeaders: ["From", "To", "Subject", "Date"],
        });
        return {
          id: full.data.id,
          threadId: full.data.threadId,
          snippet: full.data.snippet,
          from: getHeader(full.data.payload?.headers, "From"),
          to: getHeader(full.data.payload?.headers, "To"),
          subject: getHeader(full.data.payload?.headers, "Subject"),
          date: getHeader(full.data.payload?.headers, "Date"),
          labelIds: full.data.labelIds,
        };
      })
    );

    return {
      query: params.query,
      messages,
      resultSizeEstimate: response.data.resultSizeEstimate,
    };
  }

  // Return full message details
  const messages = await Promise.all(
    (response.data.messages || []).map(async (msg) => {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
      });
      return formatMessage(full.data);
    })
  );

  return {
    query: params.query,
    messages,
    resultSizeEstimate: response.data.resultSizeEstimate,
  };
}

async function getAttachment(params: {
  messageId: string;
  attachmentId: string;
}): Promise<any> {
  const response = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId: params.messageId,
    id: params.attachmentId,
  });

  return {
    attachmentId: params.attachmentId,
    messageId: params.messageId,
    size: response.data.size,
    data: response.data.data, // Base64 encoded
  };
}

async function markRead(params: { messageId: string }): Promise<any> {
  const response = await gmail.users.messages.modify({
    userId: "me",
    id: params.messageId,
    requestBody: {
      removeLabelIds: ["UNREAD"],
    },
  });

  return {
    messageId: response.data.id,
    labelIds: response.data.labelIds,
    message: "Message marked as read",
  };
}

async function markUnread(params: { messageId: string }): Promise<any> {
  const response = await gmail.users.messages.modify({
    userId: "me",
    id: params.messageId,
    requestBody: {
      addLabelIds: ["UNREAD"],
    },
  });

  return {
    messageId: response.data.id,
    labelIds: response.data.labelIds,
    message: "Message marked as unread",
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "gmail-mcp",
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
      case "list_labels":
        result = await listLabels();
        break;
      case "create_label":
        result = await createLabel(args as any);
        break;
      case "apply_label":
        result = await applyLabel(args as any);
        break;
      case "remove_label":
        result = await removeLabel(args as any);
        break;
      case "list_threads":
        result = await listThreads(args as any);
        break;
      case "get_thread":
        result = await getThread(args as any);
        break;
      case "archive_thread":
        result = await archiveThread(args as any);
        break;
      case "list_drafts":
        result = await listDrafts(args as any);
        break;
      case "create_draft":
        result = await createDraft(args as any);
        break;
      case "send_draft":
        result = await sendDraft(args as any);
        break;
      case "search_messages":
        result = await searchMessages(args as any);
        break;
      case "get_attachment":
        result = await getAttachment(args as any);
        break;
      case "mark_read":
        result = await markRead(args as any);
        break;
      case "mark_unread":
        result = await markUnread(args as any);
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
  console.error("Gmail MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
