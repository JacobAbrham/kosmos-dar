/**
 * Email MCP Server
 *
 * Email operations for KOSMOS agents including:
 * - Reading emails via IMAP
 * - Sending emails via SMTP
 * - Email search and filtering
 * - Attachment handling
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ImapFlow } from "imapflow";
import * as nodemailer from "nodemailer";
import { simpleParser } from "mailparser";

// Environment configuration
const IMAP_HOST = process.env.IMAP_HOST || "imap.gmail.com";
const IMAP_PORT = parseInt(process.env.IMAP_PORT || "993");
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const EMAIL_USER = process.env.EMAIL_USER || "";
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || "";

// Tool schemas
const ListEmailsSchema = z.object({
  folder: z.string().default("INBOX"),
  limit: z.number().default(20),
  unreadOnly: z.boolean().default(false),
  since: z.string().optional().describe("Date string (e.g., '2024-01-01')"),
});

const ReadEmailSchema = z.object({
  folder: z.string().default("INBOX"),
  uid: z.number().describe("Email UID"),
  markAsRead: z.boolean().default(true),
});

const SearchEmailsSchema = z.object({
  folder: z.string().default("INBOX"),
  query: z.string().describe("Search query"),
  from: z.string().optional(),
  to: z.string().optional(),
  subject: z.string().optional(),
  since: z.string().optional(),
  before: z.string().optional(),
  limit: z.number().default(50),
});

const SendEmailSchema = z.object({
  to: z.array(z.string()).describe("Recipient email addresses"),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
  subject: z.string(),
  body: z.string().describe("Email body (plain text or HTML)"),
  isHtml: z.boolean().default(false),
  replyTo: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string().describe("Base64 encoded content"),
    contentType: z.string().optional(),
  })).optional(),
});

const MoveEmailSchema = z.object({
  folder: z.string().default("INBOX"),
  uid: z.number(),
  targetFolder: z.string(),
});

const ListFoldersSchema = z.object({});

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "list_emails",
    description: "List emails in a folder with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        folder: { type: "string", default: "INBOX" },
        limit: { type: "number", default: 20 },
        unreadOnly: { type: "boolean", default: false },
        since: { type: "string", description: "Date filter (YYYY-MM-DD)" },
      },
    },
  },
  {
    name: "read_email",
    description: "Read full email content including attachments",
    inputSchema: {
      type: "object",
      properties: {
        folder: { type: "string", default: "INBOX" },
        uid: { type: "number", description: "Email UID" },
        markAsRead: { type: "boolean", default: true },
      },
      required: ["uid"],
    },
  },
  {
    name: "search_emails",
    description: "Search emails with advanced filters",
    inputSchema: {
      type: "object",
      properties: {
        folder: { type: "string", default: "INBOX" },
        query: { type: "string", description: "Free text search" },
        from: { type: "string" },
        to: { type: "string" },
        subject: { type: "string" },
        since: { type: "string" },
        before: { type: "string" },
        limit: { type: "number", default: 50 },
      },
      required: ["query"],
    },
  },
  {
    name: "send_email",
    description: "Send an email with optional attachments",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "array", items: { type: "string" } },
        cc: { type: "array", items: { type: "string" } },
        bcc: { type: "array", items: { type: "string" } },
        subject: { type: "string" },
        body: { type: "string" },
        isHtml: { type: "boolean", default: false },
        replyTo: { type: "string" },
        attachments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              filename: { type: "string" },
              content: { type: "string" },
              contentType: { type: "string" },
            },
          },
        },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "move_email",
    description: "Move an email to a different folder",
    inputSchema: {
      type: "object",
      properties: {
        folder: { type: "string", default: "INBOX" },
        uid: { type: "number" },
        targetFolder: { type: "string" },
      },
      required: ["uid", "targetFolder"],
    },
  },
  {
    name: "list_folders",
    description: "List all email folders/labels",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// IMAP client factory
async function getImapClient(): Promise<ImapFlow> {
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD,
    },
    logger: false,
  });
  await client.connect();
  return client;
}

// SMTP transporter
const smtpTransporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASSWORD,
  },
});

// Tool implementations
async function listEmails(params: z.infer<typeof ListEmailsSchema>): Promise<any> {
  const client = await getImapClient();
  try {
    await client.mailboxOpen(params.folder);

    const searchCriteria: any[] = [];
    if (params.unreadOnly) {
      searchCriteria.push("UNSEEN");
    }
    if (params.since) {
      searchCriteria.push(["SINCE", new Date(params.since)]);
    }

    const messages = [];
    let count = 0;

    for await (const message of client.fetch(
      searchCriteria.length ? { or: searchCriteria } : "1:*",
      { envelope: true, flags: true, uid: true }
    )) {
      if (count >= params.limit) break;

      messages.push({
        uid: message.uid,
        subject: message.envelope.subject,
        from: message.envelope.from?.[0]?.address,
        fromName: message.envelope.from?.[0]?.name,
        to: message.envelope.to?.map((t: any) => t.address),
        date: message.envelope.date,
        flags: Array.from(message.flags),
        isRead: message.flags.has("\\Seen"),
      });
      count++;
    }

    return {
      folder: params.folder,
      count: messages.length,
      emails: messages.reverse(), // Most recent first
    };
  } finally {
    await client.logout();
  }
}

async function readEmail(params: z.infer<typeof ReadEmailSchema>): Promise<any> {
  const client = await getImapClient();
  try {
    await client.mailboxOpen(params.folder);

    const message = await client.fetchOne(String(params.uid), {
      source: true,
      envelope: true,
      flags: true,
    });

    if (!message) {
      throw new Error(`Email with UID ${params.uid} not found`);
    }

    // Parse email content
    const parsed = await simpleParser(message.source);

    // Mark as read if requested
    if (params.markAsRead && !message.flags.has("\\Seen")) {
      await client.messageFlagsAdd(String(params.uid), ["\\Seen"]);
    }

    return {
      uid: params.uid,
      subject: parsed.subject,
      from: parsed.from?.text,
      to: parsed.to?.text,
      cc: parsed.cc?.text,
      date: parsed.date,
      textBody: parsed.text,
      htmlBody: parsed.html || undefined,
      attachments: parsed.attachments?.map((att) => ({
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
        // Don't include content by default to save memory
      })),
      headers: {
        messageId: parsed.messageId,
        inReplyTo: parsed.inReplyTo,
        references: parsed.references,
      },
    };
  } finally {
    await client.logout();
  }
}

async function searchEmails(params: z.infer<typeof SearchEmailsSchema>): Promise<any> {
  const client = await getImapClient();
  try {
    await client.mailboxOpen(params.folder);

    const searchCriteria: any[] = [];

    if (params.query) {
      searchCriteria.push(["TEXT", params.query]);
    }
    if (params.from) {
      searchCriteria.push(["FROM", params.from]);
    }
    if (params.to) {
      searchCriteria.push(["TO", params.to]);
    }
    if (params.subject) {
      searchCriteria.push(["SUBJECT", params.subject]);
    }
    if (params.since) {
      searchCriteria.push(["SINCE", new Date(params.since)]);
    }
    if (params.before) {
      searchCriteria.push(["BEFORE", new Date(params.before)]);
    }

    const results = [];
    let count = 0;

    for await (const message of client.fetch(
      { and: searchCriteria },
      { envelope: true, flags: true, uid: true }
    )) {
      if (count >= params.limit) break;

      results.push({
        uid: message.uid,
        subject: message.envelope.subject,
        from: message.envelope.from?.[0]?.address,
        date: message.envelope.date,
        isRead: message.flags.has("\\Seen"),
      });
      count++;
    }

    return {
      query: params.query,
      folder: params.folder,
      count: results.length,
      results: results.reverse(),
    };
  } finally {
    await client.logout();
  }
}

async function sendEmail(params: z.infer<typeof SendEmailSchema>): Promise<any> {
  const mailOptions: nodemailer.SendMailOptions = {
    from: EMAIL_USER,
    to: params.to.join(", "),
    cc: params.cc?.join(", "),
    bcc: params.bcc?.join(", "),
    subject: params.subject,
    replyTo: params.replyTo,
  };

  if (params.isHtml) {
    mailOptions.html = params.body;
  } else {
    mailOptions.text = params.body;
  }

  if (params.attachments) {
    mailOptions.attachments = params.attachments.map((att) => ({
      filename: att.filename,
      content: Buffer.from(att.content, "base64"),
      contentType: att.contentType,
    }));
  }

  const result = await smtpTransporter.sendMail(mailOptions);

  return {
    success: true,
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
    response: result.response,
  };
}

async function moveEmail(params: z.infer<typeof MoveEmailSchema>): Promise<any> {
  const client = await getImapClient();
  try {
    await client.mailboxOpen(params.folder);
    await client.messageMove(String(params.uid), params.targetFolder);

    return {
      success: true,
      uid: params.uid,
      from: params.folder,
      to: params.targetFolder,
    };
  } finally {
    await client.logout();
  }
}

async function listFolders(): Promise<any> {
  const client = await getImapClient();
  try {
    const folders = await client.list();

    return {
      folders: folders.map((f) => ({
        path: f.path,
        name: f.name,
        delimiter: f.delimiter,
        flags: Array.from(f.flags),
        specialUse: f.specialUse,
      })),
    };
  } finally {
    await client.logout();
  }
}

// Create server
const server = new Server(
  {
    name: "email-mcp-server",
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
      case "list_emails":
        result = await listEmails(ListEmailsSchema.parse(args));
        break;
      case "read_email":
        result = await readEmail(ReadEmailSchema.parse(args));
        break;
      case "search_emails":
        result = await searchEmails(SearchEmailsSchema.parse(args));
        break;
      case "send_email":
        result = await sendEmail(SendEmailSchema.parse(args));
        break;
      case "move_email":
        result = await moveEmail(MoveEmailSchema.parse(args));
        break;
      case "list_folders":
        result = await listFolders();
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
  console.error("Email MCP Server started");
}

main().catch(console.error);
