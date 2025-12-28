/**
 * Slack MCP Server
 *
 * Slack workspace integration for KOSMOS agents including:
 * - Sending messages to channels and users
 * - Reading channel history
 * - Managing channels
 * - User lookups
 * - File uploads
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { WebClient } from "@slack/web-api";

// Environment configuration
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";
const SLACK_USER_TOKEN = process.env.SLACK_USER_TOKEN || "";

// Initialize Slack client
const slack = new WebClient(SLACK_BOT_TOKEN);
const slackUser = SLACK_USER_TOKEN ? new WebClient(SLACK_USER_TOKEN) : null;

// Tool schemas
const SendMessageSchema = z.object({
  channel: z.string().describe("Channel ID or name (e.g., #general or C123456)"),
  text: z.string().describe("Message text (supports Slack markdown)"),
  threadTs: z.string().optional().describe("Thread timestamp to reply to"),
  blocks: z.array(z.unknown()).optional().describe("Slack Block Kit blocks"),
  unfurlLinks: z.boolean().default(true),
  unfurlMedia: z.boolean().default(true),
});

const GetChannelHistorySchema = z.object({
  channel: z.string(),
  limit: z.number().default(20),
  oldest: z.string().optional().describe("Start timestamp"),
  latest: z.string().optional().describe("End timestamp"),
  inclusive: z.boolean().default(true),
});

const SearchMessagesSchema = z.object({
  query: z.string().describe("Search query"),
  sort: z.enum(["score", "timestamp"]).default("score"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  count: z.number().default(20),
});

const ListChannelsSchema = z.object({
  types: z.string().default("public_channel,private_channel"),
  excludeArchived: z.boolean().default(true),
  limit: z.number().default(100),
});

const GetUserInfoSchema = z.object({
  user: z.string().describe("User ID"),
});

const LookupUserByEmailSchema = z.object({
  email: z.string().describe("User email address"),
});

const UploadFileSchema = z.object({
  channels: z.array(z.string()).describe("Channel IDs to share to"),
  content: z.string().describe("File content (text or base64)"),
  filename: z.string(),
  filetype: z.string().optional(),
  title: z.string().optional(),
  initialComment: z.string().optional(),
});

const AddReactionSchema = z.object({
  channel: z.string(),
  timestamp: z.string().describe("Message timestamp"),
  emoji: z.string().describe("Emoji name without colons"),
});

const GetThreadRepliesSchema = z.object({
  channel: z.string(),
  threadTs: z.string().describe("Thread parent timestamp"),
  limit: z.number().default(50),
});

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "send_message",
    description: "Send a message to a Slack channel or user",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", description: "Channel ID or #channel-name" },
        text: { type: "string", description: "Message text" },
        threadTs: { type: "string", description: "Thread to reply to" },
        blocks: { type: "array", description: "Block Kit blocks" },
        unfurlLinks: { type: "boolean", default: true },
        unfurlMedia: { type: "boolean", default: true },
      },
      required: ["channel", "text"],
    },
  },
  {
    name: "get_channel_history",
    description: "Get message history from a channel",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string" },
        limit: { type: "number", default: 20 },
        oldest: { type: "string" },
        latest: { type: "string" },
        inclusive: { type: "boolean", default: true },
      },
      required: ["channel"],
    },
  },
  {
    name: "search_messages",
    description: "Search for messages across Slack (requires user token)",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        sort: { type: "string", enum: ["score", "timestamp"], default: "score" },
        sortDir: { type: "string", enum: ["asc", "desc"], default: "desc" },
        count: { type: "number", default: 20 },
      },
      required: ["query"],
    },
  },
  {
    name: "list_channels",
    description: "List all channels in the workspace",
    inputSchema: {
      type: "object",
      properties: {
        types: { type: "string", default: "public_channel,private_channel" },
        excludeArchived: { type: "boolean", default: true },
        limit: { type: "number", default: 100 },
      },
    },
  },
  {
    name: "get_user_info",
    description: "Get information about a user",
    inputSchema: {
      type: "object",
      properties: {
        user: { type: "string", description: "User ID" },
      },
      required: ["user"],
    },
  },
  {
    name: "lookup_user_by_email",
    description: "Find a user by their email address",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string" },
      },
      required: ["email"],
    },
  },
  {
    name: "upload_file",
    description: "Upload a file to Slack",
    inputSchema: {
      type: "object",
      properties: {
        channels: { type: "array", items: { type: "string" } },
        content: { type: "string" },
        filename: { type: "string" },
        filetype: { type: "string" },
        title: { type: "string" },
        initialComment: { type: "string" },
      },
      required: ["channels", "content", "filename"],
    },
  },
  {
    name: "add_reaction",
    description: "Add an emoji reaction to a message",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string" },
        timestamp: { type: "string" },
        emoji: { type: "string", description: "Emoji name (e.g., thumbsup)" },
      },
      required: ["channel", "timestamp", "emoji"],
    },
  },
  {
    name: "get_thread_replies",
    description: "Get all replies in a thread",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string" },
        threadTs: { type: "string" },
        limit: { type: "number", default: 50 },
      },
      required: ["channel", "threadTs"],
    },
  },
];

// Tool implementations
async function sendMessage(params: z.infer<typeof SendMessageSchema>): Promise<any> {
  const result = await slack.chat.postMessage({
    channel: params.channel,
    text: params.text,
    thread_ts: params.threadTs,
    blocks: params.blocks as any,
    unfurl_links: params.unfurlLinks,
    unfurl_media: params.unfurlMedia,
  });

  return {
    success: result.ok,
    channel: result.channel,
    timestamp: result.ts,
    message: result.message,
  };
}

async function getChannelHistory(params: z.infer<typeof GetChannelHistorySchema>): Promise<any> {
  const result = await slack.conversations.history({
    channel: params.channel,
    limit: params.limit,
    oldest: params.oldest,
    latest: params.latest,
    inclusive: params.inclusive,
  });

  return {
    success: result.ok,
    messages: result.messages?.map((m) => ({
      user: m.user,
      text: m.text,
      timestamp: m.ts,
      threadTs: m.thread_ts,
      replyCount: m.reply_count,
      reactions: m.reactions,
    })),
    hasMore: result.has_more,
  };
}

async function searchMessages(params: z.infer<typeof SearchMessagesSchema>): Promise<any> {
  if (!slackUser) {
    throw new Error("Search requires SLACK_USER_TOKEN to be configured");
  }

  const result = await slackUser.search.messages({
    query: params.query,
    sort: params.sort,
    sort_dir: params.sortDir,
    count: params.count,
  });

  return {
    success: result.ok,
    total: result.messages?.total,
    matches: result.messages?.matches?.map((m: any) => ({
      channel: m.channel?.name,
      channelId: m.channel?.id,
      user: m.user,
      text: m.text,
      timestamp: m.ts,
      permalink: m.permalink,
    })),
  };
}

async function listChannels(params: z.infer<typeof ListChannelsSchema>): Promise<any> {
  const result = await slack.conversations.list({
    types: params.types,
    exclude_archived: params.excludeArchived,
    limit: params.limit,
  });

  return {
    success: result.ok,
    channels: result.channels?.map((c) => ({
      id: c.id,
      name: c.name,
      isPrivate: c.is_private,
      isArchived: c.is_archived,
      topic: c.topic?.value,
      purpose: c.purpose?.value,
      memberCount: c.num_members,
    })),
  };
}

async function getUserInfo(params: z.infer<typeof GetUserInfoSchema>): Promise<any> {
  const result = await slack.users.info({
    user: params.user,
  });

  const user = result.user;
  return {
    success: result.ok,
    user: {
      id: user?.id,
      name: user?.name,
      realName: user?.real_name,
      displayName: user?.profile?.display_name,
      email: user?.profile?.email,
      title: user?.profile?.title,
      phone: user?.profile?.phone,
      status: user?.profile?.status_text,
      statusEmoji: user?.profile?.status_emoji,
      timezone: user?.tz,
      isAdmin: user?.is_admin,
      isBot: user?.is_bot,
      avatar: user?.profile?.image_192,
    },
  };
}

async function lookupUserByEmail(params: z.infer<typeof LookupUserByEmailSchema>): Promise<any> {
  const result = await slack.users.lookupByEmail({
    email: params.email,
  });

  const user = result.user;
  return {
    success: result.ok,
    user: {
      id: user?.id,
      name: user?.name,
      realName: user?.real_name,
      email: user?.profile?.email,
    },
  };
}

async function uploadFile(params: z.infer<typeof UploadFileSchema>): Promise<any> {
  const result = await slack.files.uploadV2({
    channels: params.channels.join(","),
    content: params.content,
    filename: params.filename,
    filetype: params.filetype,
    title: params.title,
    initial_comment: params.initialComment,
  });

  return {
    success: result.ok,
    file: {
      id: (result.file as any)?.id,
      name: (result.file as any)?.name,
      url: (result.file as any)?.url_private,
      permalink: (result.file as any)?.permalink,
    },
  };
}

async function addReaction(params: z.infer<typeof AddReactionSchema>): Promise<any> {
  const result = await slack.reactions.add({
    channel: params.channel,
    timestamp: params.timestamp,
    name: params.emoji,
  });

  return {
    success: result.ok,
  };
}

async function getThreadReplies(params: z.infer<typeof GetThreadRepliesSchema>): Promise<any> {
  const result = await slack.conversations.replies({
    channel: params.channel,
    ts: params.threadTs,
    limit: params.limit,
  });

  return {
    success: result.ok,
    messages: result.messages?.map((m) => ({
      user: m.user,
      text: m.text,
      timestamp: m.ts,
      reactions: m.reactions,
    })),
    hasMore: result.has_more,
  };
}

// Create server
const server = new Server(
  {
    name: "slack-mcp-server",
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
      case "send_message":
        result = await sendMessage(SendMessageSchema.parse(args));
        break;
      case "get_channel_history":
        result = await getChannelHistory(GetChannelHistorySchema.parse(args));
        break;
      case "search_messages":
        result = await searchMessages(SearchMessagesSchema.parse(args));
        break;
      case "list_channels":
        result = await listChannels(ListChannelsSchema.parse(args));
        break;
      case "get_user_info":
        result = await getUserInfo(GetUserInfoSchema.parse(args));
        break;
      case "lookup_user_by_email":
        result = await lookupUserByEmail(LookupUserByEmailSchema.parse(args));
        break;
      case "upload_file":
        result = await uploadFile(UploadFileSchema.parse(args));
        break;
      case "add_reaction":
        result = await addReaction(AddReactionSchema.parse(args));
        break;
      case "get_thread_replies":
        result = await getThreadReplies(GetThreadRepliesSchema.parse(args));
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
  console.error("Slack MCP Server started");
}

main().catch(console.error);
