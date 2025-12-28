/**
 * Microsoft Teams MCP Server
 *
 * Microsoft Teams integration for KOSMOS agents via Microsoft Graph API including:
 * - Sending messages to channels and chats
 * - Managing teams and channels
 * - Managing chats and chat members
 * - Scheduling and listing meetings
 * - User presence information
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

// Environment configuration
const config = {
  clientId: process.env.TEAMS_CLIENT_ID || "",
  clientSecret: process.env.TEAMS_CLIENT_SECRET || "",
  tenantId: process.env.TEAMS_TENANT_ID || "",
};

// Token cache with expiration
let tokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Get access token using OAuth2 client credentials flow
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 minute buffer)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 300000) {
    return tokenCache.token;
  }

  if (!config.clientId || !config.clientSecret || !config.tenantId) {
    throw new Error(
      "Missing required environment variables: TEAMS_CLIENT_ID, TEAMS_CLIENT_SECRET, TEAMS_TENANT_ID"
    );
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error_description: response.statusText }));
    throw new Error(`OAuth2 token error: ${error.error_description || response.statusText}`);
  }

  const data = await response.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

/**
 * Make a request to Microsoft Graph API
 */
async function graphRequest(
  method: string,
  path: string,
  body?: unknown,
  contentType: string = "application/json"
): Promise<unknown> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method,
    headers,
    body: body ? (contentType === "application/json" ? JSON.stringify(body) : body as BodyInit) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || `Graph API error: ${response.statusText}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return { success: true };
  }

  return response.json();
}

// ============================================================================
// Zod Schemas
// ============================================================================

// Message schemas
const SendMessageSchema = z.object({
  teamId: z.string().optional().describe("Team ID (required for channel messages)"),
  channelId: z.string().optional().describe("Channel ID (required for channel messages)"),
  chatId: z.string().optional().describe("Chat ID (required for chat messages)"),
  content: z.string().describe("Message content"),
  contentType: z.enum(["text", "html"]).default("text").describe("Content type"),
  importance: z.enum(["normal", "high", "urgent"]).default("normal").describe("Message importance"),
});

const ListMessagesSchema = z.object({
  teamId: z.string().describe("Team ID"),
  channelId: z.string().describe("Channel ID"),
  top: z.number().optional().default(50).describe("Number of messages to retrieve"),
});

const ReplyToMessageSchema = z.object({
  teamId: z.string().describe("Team ID"),
  channelId: z.string().describe("Channel ID"),
  messageId: z.string().describe("Message ID to reply to"),
  content: z.string().describe("Reply content"),
  contentType: z.enum(["text", "html"]).default("text"),
});

const UpdateMessageSchema = z.object({
  teamId: z.string().describe("Team ID"),
  channelId: z.string().describe("Channel ID"),
  messageId: z.string().describe("Message ID to update"),
  content: z.string().describe("New message content"),
  contentType: z.enum(["text", "html"]).default("text"),
});

const DeleteMessageSchema = z.object({
  teamId: z.string().describe("Team ID"),
  channelId: z.string().describe("Channel ID"),
  messageId: z.string().describe("Message ID to delete"),
});

// Team schemas
const ListTeamsSchema = z.object({
  filter: z.string().optional().describe("OData filter query"),
  top: z.number().optional().default(100).describe("Number of teams to retrieve"),
});

const GetTeamSchema = z.object({
  teamId: z.string().describe("Team ID"),
});

const CreateTeamSchema = z.object({
  displayName: z.string().describe("Team display name"),
  description: z.string().optional().describe("Team description"),
  visibility: z.enum(["private", "public"]).default("private").describe("Team visibility"),
  ownerUserId: z.string().optional().describe("Owner user ID"),
});

// Channel schemas
const ListChannelsSchema = z.object({
  teamId: z.string().describe("Team ID"),
  filter: z.string().optional().describe("OData filter query"),
});

const CreateChannelSchema = z.object({
  teamId: z.string().describe("Team ID"),
  displayName: z.string().describe("Channel display name"),
  description: z.string().optional().describe("Channel description"),
  membershipType: z.enum(["standard", "private", "shared"]).default("standard"),
});

// Chat schemas
const ListChatsSchema = z.object({
  userId: z.string().optional().describe("User ID (defaults to current user via /me)"),
  top: z.number().optional().default(50).describe("Number of chats to retrieve"),
});

const GetChatSchema = z.object({
  chatId: z.string().describe("Chat ID"),
});

const CreateChatSchema = z.object({
  chatType: z.enum(["oneOnOne", "group"]).describe("Type of chat"),
  members: z.array(z.string()).describe("Array of user IDs to add as members"),
  topic: z.string().optional().describe("Chat topic (for group chats)"),
});

// Member schemas
const ListMembersSchema = z.object({
  teamId: z.string().optional().describe("Team ID (for team members)"),
  chatId: z.string().optional().describe("Chat ID (for chat members)"),
});

const AddMemberSchema = z.object({
  teamId: z.string().optional().describe("Team ID (for adding to team)"),
  chatId: z.string().optional().describe("Chat ID (for adding to chat)"),
  userId: z.string().describe("User ID to add"),
  roles: z.array(z.string()).optional().describe("Roles for the member (e.g., 'owner')"),
});

const RemoveMemberSchema = z.object({
  teamId: z.string().optional().describe("Team ID"),
  chatId: z.string().optional().describe("Chat ID"),
  membershipId: z.string().describe("Membership ID to remove"),
});

// File schemas
const UploadFileSchema = z.object({
  teamId: z.string().describe("Team ID"),
  channelId: z.string().describe("Channel ID"),
  fileName: z.string().describe("File name"),
  content: z.string().describe("File content (base64 encoded for binary files)"),
  contentType: z.string().optional().default("application/octet-stream"),
});

// Meeting schemas
const CreateMeetingSchema = z.object({
  subject: z.string().describe("Meeting subject"),
  startDateTime: z.string().describe("Start date/time in ISO 8601 format"),
  endDateTime: z.string().describe("End date/time in ISO 8601 format"),
  attendees: z.array(z.string()).optional().describe("Array of attendee email addresses"),
  isOnlineMeeting: z.boolean().default(true),
  onlineMeetingProvider: z.enum(["teamsForBusiness", "skypeForBusiness", "skypeForConsumer"]).default("teamsForBusiness"),
});

const ListMeetingsSchema = z.object({
  userId: z.string().optional().describe("User ID (defaults to /me)"),
  startDateTime: z.string().optional().describe("Filter events starting after this time"),
  endDateTime: z.string().optional().describe("Filter events ending before this time"),
  top: z.number().optional().default(50),
});

// Presence schema
const GetPresenceSchema = z.object({
  userId: z.string().describe("User ID"),
});

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS: Tool[] = [
  // Message tools
  {
    name: "send_message",
    description: "Send a message to a Teams channel or chat. Provide either teamId+channelId for channel messages, or chatId for chat messages.",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string", description: "Team ID (for channel messages)" },
        channelId: { type: "string", description: "Channel ID (for channel messages)" },
        chatId: { type: "string", description: "Chat ID (for chat messages)" },
        content: { type: "string", description: "Message content" },
        contentType: { type: "string", enum: ["text", "html"], default: "text" },
        importance: { type: "string", enum: ["normal", "high", "urgent"], default: "normal" },
      },
      required: ["content"],
    },
  },
  {
    name: "list_messages",
    description: "List messages from a Teams channel",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string", description: "Team ID" },
        channelId: { type: "string", description: "Channel ID" },
        top: { type: "number", default: 50, description: "Number of messages" },
      },
      required: ["teamId", "channelId"],
    },
  },
  {
    name: "reply_to_message",
    description: "Reply to an existing message in a channel",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string", description: "Team ID" },
        channelId: { type: "string", description: "Channel ID" },
        messageId: { type: "string", description: "Message ID to reply to" },
        content: { type: "string", description: "Reply content" },
        contentType: { type: "string", enum: ["text", "html"], default: "text" },
      },
      required: ["teamId", "channelId", "messageId", "content"],
    },
  },
  {
    name: "update_message",
    description: "Update an existing message in a channel",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string", description: "Team ID" },
        channelId: { type: "string", description: "Channel ID" },
        messageId: { type: "string", description: "Message ID to update" },
        content: { type: "string", description: "New message content" },
        contentType: { type: "string", enum: ["text", "html"], default: "text" },
      },
      required: ["teamId", "channelId", "messageId", "content"],
    },
  },
  {
    name: "delete_message",
    description: "Delete a message from a channel (soft delete)",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string", description: "Team ID" },
        channelId: { type: "string", description: "Channel ID" },
        messageId: { type: "string", description: "Message ID to delete" },
      },
      required: ["teamId", "channelId", "messageId"],
    },
  },

  // Team tools
  {
    name: "list_teams",
    description: "List all Teams the app has access to",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "OData filter query" },
        top: { type: "number", default: 100 },
      },
    },
  },
  {
    name: "get_team",
    description: "Get details of a specific team",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string", description: "Team ID" },
      },
      required: ["teamId"],
    },
  },
  {
    name: "create_team",
    description: "Create a new team",
    inputSchema: {
      type: "object",
      properties: {
        displayName: { type: "string", description: "Team display name" },
        description: { type: "string", description: "Team description" },
        visibility: { type: "string", enum: ["private", "public"], default: "private" },
        ownerUserId: { type: "string", description: "Owner user ID" },
      },
      required: ["displayName"],
    },
  },

  // Channel tools
  {
    name: "list_channels",
    description: "List all channels in a team",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string", description: "Team ID" },
        filter: { type: "string", description: "OData filter query" },
      },
      required: ["teamId"],
    },
  },
  {
    name: "create_channel",
    description: "Create a new channel in a team",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string", description: "Team ID" },
        displayName: { type: "string", description: "Channel name" },
        description: { type: "string", description: "Channel description" },
        membershipType: { type: "string", enum: ["standard", "private", "shared"], default: "standard" },
      },
      required: ["teamId", "displayName"],
    },
  },

  // Chat tools
  {
    name: "list_chats",
    description: "List chats for a user",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "User ID (optional, defaults to app context)" },
        top: { type: "number", default: 50 },
      },
    },
  },
  {
    name: "get_chat",
    description: "Get details of a specific chat",
    inputSchema: {
      type: "object",
      properties: {
        chatId: { type: "string", description: "Chat ID" },
      },
      required: ["chatId"],
    },
  },
  {
    name: "create_chat",
    description: "Create a new chat (one-on-one or group)",
    inputSchema: {
      type: "object",
      properties: {
        chatType: { type: "string", enum: ["oneOnOne", "group"], description: "Chat type" },
        members: { type: "array", items: { type: "string" }, description: "User IDs to add" },
        topic: { type: "string", description: "Chat topic (for group chats)" },
      },
      required: ["chatType", "members"],
    },
  },

  // Member tools
  {
    name: "list_members",
    description: "List members of a team or chat",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string", description: "Team ID (for team members)" },
        chatId: { type: "string", description: "Chat ID (for chat members)" },
      },
    },
  },
  {
    name: "add_member",
    description: "Add a member to a team or chat",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string", description: "Team ID" },
        chatId: { type: "string", description: "Chat ID" },
        userId: { type: "string", description: "User ID to add" },
        roles: { type: "array", items: { type: "string" }, description: "Roles (e.g., 'owner')" },
      },
      required: ["userId"],
    },
  },
  {
    name: "remove_member",
    description: "Remove a member from a team or chat",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string", description: "Team ID" },
        chatId: { type: "string", description: "Chat ID" },
        membershipId: { type: "string", description: "Membership ID to remove" },
      },
      required: ["membershipId"],
    },
  },

  // File tools
  {
    name: "upload_file",
    description: "Upload a file to a Teams channel",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string", description: "Team ID" },
        channelId: { type: "string", description: "Channel ID" },
        fileName: { type: "string", description: "File name" },
        content: { type: "string", description: "File content (base64 for binary)" },
        contentType: { type: "string", default: "application/octet-stream" },
      },
      required: ["teamId", "channelId", "fileName", "content"],
    },
  },

  // Meeting tools
  {
    name: "create_meeting",
    description: "Schedule a new Teams meeting",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Meeting subject" },
        startDateTime: { type: "string", description: "Start time (ISO 8601)" },
        endDateTime: { type: "string", description: "End time (ISO 8601)" },
        attendees: { type: "array", items: { type: "string" }, description: "Attendee emails" },
        isOnlineMeeting: { type: "boolean", default: true },
        onlineMeetingProvider: { type: "string", enum: ["teamsForBusiness", "skypeForBusiness", "skypeForConsumer"], default: "teamsForBusiness" },
      },
      required: ["subject", "startDateTime", "endDateTime"],
    },
  },
  {
    name: "list_meetings",
    description: "List scheduled meetings/events",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "User ID (optional)" },
        startDateTime: { type: "string", description: "Filter start time" },
        endDateTime: { type: "string", description: "Filter end time" },
        top: { type: "number", default: 50 },
      },
    },
  },

  // Presence tools
  {
    name: "get_presence",
    description: "Get a user's presence status (availability)",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "User ID" },
      },
      required: ["userId"],
    },
  },
];

// ============================================================================
// Tool Implementations
// ============================================================================

async function sendMessage(params: z.infer<typeof SendMessageSchema>): Promise<unknown> {
  const messageBody = {
    body: {
      contentType: params.contentType,
      content: params.content,
    },
    importance: params.importance,
  };

  if (params.chatId) {
    // Send to chat
    const result = await graphRequest("POST", `/chats/${params.chatId}/messages`, messageBody);
    return {
      success: true,
      type: "chat",
      chatId: params.chatId,
      message: result,
    };
  } else if (params.teamId && params.channelId) {
    // Send to channel
    const result = await graphRequest(
      "POST",
      `/teams/${params.teamId}/channels/${params.channelId}/messages`,
      messageBody
    );
    return {
      success: true,
      type: "channel",
      teamId: params.teamId,
      channelId: params.channelId,
      message: result,
    };
  } else {
    throw new Error("Must provide either chatId or both teamId and channelId");
  }
}

async function listMessages(params: z.infer<typeof ListMessagesSchema>): Promise<unknown> {
  const query = params.top ? `?$top=${params.top}` : "";
  const result = await graphRequest(
    "GET",
    `/teams/${params.teamId}/channels/${params.channelId}/messages${query}`
  ) as { value: unknown[] };

  return {
    success: true,
    messages: result.value?.map((m: any) => ({
      id: m.id,
      content: m.body?.content,
      contentType: m.body?.contentType,
      from: m.from?.user?.displayName || m.from?.application?.displayName,
      createdDateTime: m.createdDateTime,
      importance: m.importance,
      webUrl: m.webUrl,
    })) || [],
  };
}

async function replyToMessage(params: z.infer<typeof ReplyToMessageSchema>): Promise<unknown> {
  const result = await graphRequest(
    "POST",
    `/teams/${params.teamId}/channels/${params.channelId}/messages/${params.messageId}/replies`,
    {
      body: {
        contentType: params.contentType,
        content: params.content,
      },
    }
  );

  return {
    success: true,
    reply: result,
  };
}

async function updateMessage(params: z.infer<typeof UpdateMessageSchema>): Promise<unknown> {
  const result = await graphRequest(
    "PATCH",
    `/teams/${params.teamId}/channels/${params.channelId}/messages/${params.messageId}`,
    {
      body: {
        contentType: params.contentType,
        content: params.content,
      },
    }
  );

  return {
    success: true,
    message: result,
  };
}

async function deleteMessage(params: z.infer<typeof DeleteMessageSchema>): Promise<unknown> {
  // Soft delete by setting body to empty
  await graphRequest(
    "DELETE",
    `/teams/${params.teamId}/channels/${params.channelId}/messages/${params.messageId}`
  );

  return {
    success: true,
    deleted: true,
    messageId: params.messageId,
  };
}

async function listTeams(params: z.infer<typeof ListTeamsSchema>): Promise<unknown> {
  let query = "?$filter=resourceProvisioningOptions/Any(x:x eq 'Team')";
  if (params.filter) {
    query += ` and ${params.filter}`;
  }
  if (params.top) {
    query += `&$top=${params.top}`;
  }

  const result = await graphRequest("GET", `/groups${query}`) as { value: unknown[] };

  return {
    success: true,
    teams: result.value?.map((t: any) => ({
      id: t.id,
      displayName: t.displayName,
      description: t.description,
      visibility: t.visibility,
      createdDateTime: t.createdDateTime,
    })) || [],
  };
}

async function getTeam(params: z.infer<typeof GetTeamSchema>): Promise<unknown> {
  const result = await graphRequest("GET", `/teams/${params.teamId}`);
  return {
    success: true,
    team: result,
  };
}

async function createTeam(params: z.infer<typeof CreateTeamSchema>): Promise<unknown> {
  const teamPayload: Record<string, unknown> = {
    "template@odata.bind": "https://graph.microsoft.com/v1.0/teamsTemplates('standard')",
    displayName: params.displayName,
    description: params.description || "",
    visibility: params.visibility,
  };

  if (params.ownerUserId) {
    teamPayload.members = [
      {
        "@odata.type": "#microsoft.graph.aadUserConversationMember",
        roles: ["owner"],
        "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${params.ownerUserId}')`,
      },
    ];
  }

  const result = await graphRequest("POST", "/teams", teamPayload);

  return {
    success: true,
    message: "Team creation initiated. Team provisioning may take a few moments.",
    team: result,
  };
}

async function listChannels(params: z.infer<typeof ListChannelsSchema>): Promise<unknown> {
  let path = `/teams/${params.teamId}/channels`;
  if (params.filter) {
    path += `?$filter=${encodeURIComponent(params.filter)}`;
  }

  const result = await graphRequest("GET", path) as { value: unknown[] };

  return {
    success: true,
    channels: result.value?.map((c: any) => ({
      id: c.id,
      displayName: c.displayName,
      description: c.description,
      membershipType: c.membershipType,
      webUrl: c.webUrl,
    })) || [],
  };
}

async function createChannel(params: z.infer<typeof CreateChannelSchema>): Promise<unknown> {
  const result = await graphRequest("POST", `/teams/${params.teamId}/channels`, {
    displayName: params.displayName,
    description: params.description || "",
    membershipType: params.membershipType,
  });

  return {
    success: true,
    channel: result,
  };
}

async function listChats(params: z.infer<typeof ListChatsSchema>): Promise<unknown> {
  const userPath = params.userId ? `/users/${params.userId}` : "/me";
  const query = params.top ? `?$top=${params.top}` : "";

  const result = await graphRequest("GET", `${userPath}/chats${query}`) as { value: unknown[] };

  return {
    success: true,
    chats: result.value?.map((c: any) => ({
      id: c.id,
      chatType: c.chatType,
      topic: c.topic,
      createdDateTime: c.createdDateTime,
      lastUpdatedDateTime: c.lastUpdatedDateTime,
    })) || [],
  };
}

async function getChat(params: z.infer<typeof GetChatSchema>): Promise<unknown> {
  const result = await graphRequest("GET", `/chats/${params.chatId}`);
  return {
    success: true,
    chat: result,
  };
}

async function createChat(params: z.infer<typeof CreateChatSchema>): Promise<unknown> {
  const members = params.members.map((userId) => ({
    "@odata.type": "#microsoft.graph.aadUserConversationMember",
    roles: ["owner"],
    "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${userId}')`,
  }));

  const chatPayload: Record<string, unknown> = {
    chatType: params.chatType,
    members,
  };

  if (params.topic && params.chatType === "group") {
    chatPayload.topic = params.topic;
  }

  const result = await graphRequest("POST", "/chats", chatPayload);

  return {
    success: true,
    chat: result,
  };
}

async function listMembers(params: z.infer<typeof ListMembersSchema>): Promise<unknown> {
  let path: string;
  if (params.teamId) {
    path = `/teams/${params.teamId}/members`;
  } else if (params.chatId) {
    path = `/chats/${params.chatId}/members`;
  } else {
    throw new Error("Must provide either teamId or chatId");
  }

  const result = await graphRequest("GET", path) as { value: unknown[] };

  return {
    success: true,
    members: result.value?.map((m: any) => ({
      id: m.id,
      displayName: m.displayName,
      email: m.email,
      roles: m.roles,
      userId: m.userId,
    })) || [],
  };
}

async function addMember(params: z.infer<typeof AddMemberSchema>): Promise<unknown> {
  let path: string;
  if (params.teamId) {
    path = `/teams/${params.teamId}/members`;
  } else if (params.chatId) {
    path = `/chats/${params.chatId}/members`;
  } else {
    throw new Error("Must provide either teamId or chatId");
  }

  const memberPayload = {
    "@odata.type": "#microsoft.graph.aadUserConversationMember",
    roles: params.roles || [],
    "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${params.userId}')`,
  };

  const result = await graphRequest("POST", path, memberPayload);

  return {
    success: true,
    member: result,
  };
}

async function removeMember(params: z.infer<typeof RemoveMemberSchema>): Promise<unknown> {
  let path: string;
  if (params.teamId) {
    path = `/teams/${params.teamId}/members/${params.membershipId}`;
  } else if (params.chatId) {
    path = `/chats/${params.chatId}/members/${params.membershipId}`;
  } else {
    throw new Error("Must provide either teamId or chatId");
  }

  await graphRequest("DELETE", path);

  return {
    success: true,
    removed: true,
    membershipId: params.membershipId,
  };
}

async function uploadFile(params: z.infer<typeof UploadFileSchema>): Promise<unknown> {
  // First, get the channel's files folder (SharePoint)
  const driveInfo = await graphRequest(
    "GET",
    `/teams/${params.teamId}/channels/${params.channelId}/filesFolder`
  ) as { id: string; parentReference: { driveId: string } };

  const driveId = driveInfo.parentReference?.driveId;
  const folderId = driveInfo.id;

  if (!driveId || !folderId) {
    throw new Error("Could not determine channel files location");
  }

  // Decode base64 content if needed
  let fileContent: Buffer | string = params.content;
  try {
    fileContent = Buffer.from(params.content, "base64");
  } catch {
    // Content is already plain text
  }

  // Upload file to SharePoint
  const result = await graphRequest(
    "PUT",
    `/drives/${driveId}/items/${folderId}:/${encodeURIComponent(params.fileName)}:/content`,
    fileContent,
    params.contentType
  );

  return {
    success: true,
    file: result,
  };
}

async function createMeeting(params: z.infer<typeof CreateMeetingSchema>): Promise<unknown> {
  const eventPayload: Record<string, unknown> = {
    subject: params.subject,
    start: {
      dateTime: params.startDateTime,
      timeZone: "UTC",
    },
    end: {
      dateTime: params.endDateTime,
      timeZone: "UTC",
    },
    isOnlineMeeting: params.isOnlineMeeting,
    onlineMeetingProvider: params.onlineMeetingProvider,
  };

  if (params.attendees && params.attendees.length > 0) {
    eventPayload.attendees = params.attendees.map((email) => ({
      emailAddress: { address: email },
      type: "required",
    }));
  }

  const result = await graphRequest("POST", "/me/events", eventPayload);

  return {
    success: true,
    meeting: result,
  };
}

async function listMeetings(params: z.infer<typeof ListMeetingsSchema>): Promise<unknown> {
  const userPath = params.userId ? `/users/${params.userId}` : "/me";

  let query = `?$filter=isOnlineMeeting eq true&$top=${params.top || 50}`;

  if (params.startDateTime) {
    query += `&$filter=start/dateTime ge '${params.startDateTime}'`;
  }
  if (params.endDateTime) {
    query += ` and end/dateTime le '${params.endDateTime}'`;
  }

  const result = await graphRequest("GET", `${userPath}/events${query}`) as { value: unknown[] };

  return {
    success: true,
    meetings: result.value?.map((e: any) => ({
      id: e.id,
      subject: e.subject,
      start: e.start,
      end: e.end,
      isOnlineMeeting: e.isOnlineMeeting,
      onlineMeetingUrl: e.onlineMeeting?.joinUrl,
      organizer: e.organizer?.emailAddress?.address,
      attendees: e.attendees?.map((a: any) => a.emailAddress?.address),
    })) || [],
  };
}

async function getPresence(params: z.infer<typeof GetPresenceSchema>): Promise<unknown> {
  const result = await graphRequest("GET", `/users/${params.userId}/presence`);

  return {
    success: true,
    presence: result,
  };
}

// ============================================================================
// Server Setup
// ============================================================================

const server = new Server(
  {
    name: "teams-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      // Message tools
      case "send_message":
        result = await sendMessage(SendMessageSchema.parse(args));
        break;
      case "list_messages":
        result = await listMessages(ListMessagesSchema.parse(args));
        break;
      case "reply_to_message":
        result = await replyToMessage(ReplyToMessageSchema.parse(args));
        break;
      case "update_message":
        result = await updateMessage(UpdateMessageSchema.parse(args));
        break;
      case "delete_message":
        result = await deleteMessage(DeleteMessageSchema.parse(args));
        break;

      // Team tools
      case "list_teams":
        result = await listTeams(ListTeamsSchema.parse(args));
        break;
      case "get_team":
        result = await getTeam(GetTeamSchema.parse(args));
        break;
      case "create_team":
        result = await createTeam(CreateTeamSchema.parse(args));
        break;

      // Channel tools
      case "list_channels":
        result = await listChannels(ListChannelsSchema.parse(args));
        break;
      case "create_channel":
        result = await createChannel(CreateChannelSchema.parse(args));
        break;

      // Chat tools
      case "list_chats":
        result = await listChats(ListChatsSchema.parse(args));
        break;
      case "get_chat":
        result = await getChat(GetChatSchema.parse(args));
        break;
      case "create_chat":
        result = await createChat(CreateChatSchema.parse(args));
        break;

      // Member tools
      case "list_members":
        result = await listMembers(ListMembersSchema.parse(args));
        break;
      case "add_member":
        result = await addMember(AddMemberSchema.parse(args));
        break;
      case "remove_member":
        result = await removeMember(RemoveMemberSchema.parse(args));
        break;

      // File tools
      case "upload_file":
        result = await uploadFile(UploadFileSchema.parse(args));
        break;

      // Meeting tools
      case "create_meeting":
        result = await createMeeting(CreateMeetingSchema.parse(args));
        break;
      case "list_meetings":
        result = await listMeetings(ListMeetingsSchema.parse(args));
        break;

      // Presence tools
      case "get_presence":
        result = await getPresence(GetPresenceSchema.parse(args));
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

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Microsoft Teams MCP Server started");
}

main().catch(console.error);
