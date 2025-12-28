/**
 * Discord MCP Server - Discord bot operations for KOSMOS
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  token: process.env.DISCORD_BOT_TOKEN || "",
  apiUrl: "https://discord.com/api/v10",
};

async function discordRequest(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${config.token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || res.statusText);
  }

  return res.status === 204 ? {} : res.json();
}

const TOOLS: Tool[] = [
  // Guilds (Servers)
  { name: "list_guilds", description: "List all guilds the bot is in.", inputSchema: { type: "object", properties: {} } },
  { name: "get_guild", description: "Get guild details.", inputSchema: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } },
  { name: "get_guild_channels", description: "Get guild channels.", inputSchema: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } },
  { name: "get_guild_members", description: "Get guild members.", inputSchema: { type: "object", properties: { guildId: { type: "string" }, limit: { type: "number" } }, required: ["guildId"] } },
  { name: "get_guild_roles", description: "Get guild roles.", inputSchema: { type: "object", properties: { guildId: { type: "string" } }, required: ["guildId"] } },
  // Channels
  { name: "get_channel", description: "Get channel details.", inputSchema: { type: "object", properties: { channelId: { type: "string" } }, required: ["channelId"] } },
  { name: "create_channel", description: "Create a channel.", inputSchema: { type: "object", properties: { guildId: { type: "string" }, name: { type: "string" }, type: { type: "number" }, parentId: { type: "string" } }, required: ["guildId", "name"] } },
  { name: "delete_channel", description: "Delete a channel.", inputSchema: { type: "object", properties: { channelId: { type: "string" } }, required: ["channelId"] } },
  // Messages
  { name: "get_messages", description: "Get messages from a channel.", inputSchema: { type: "object", properties: { channelId: { type: "string" }, limit: { type: "number" }, before: { type: "string" }, after: { type: "string" } }, required: ["channelId"] } },
  { name: "send_message", description: "Send a message to a channel.", inputSchema: { type: "object", properties: { channelId: { type: "string" }, content: { type: "string" }, embeds: { type: "array" } }, required: ["channelId", "content"] } },
  { name: "edit_message", description: "Edit a message.", inputSchema: { type: "object", properties: { channelId: { type: "string" }, messageId: { type: "string" }, content: { type: "string" } }, required: ["channelId", "messageId", "content"] } },
  { name: "delete_message", description: "Delete a message.", inputSchema: { type: "object", properties: { channelId: { type: "string" }, messageId: { type: "string" } }, required: ["channelId", "messageId"] } },
  { name: "add_reaction", description: "Add a reaction to a message.", inputSchema: { type: "object", properties: { channelId: { type: "string" }, messageId: { type: "string" }, emoji: { type: "string" } }, required: ["channelId", "messageId", "emoji"] } },
  // Users
  { name: "get_user", description: "Get user details.", inputSchema: { type: "object", properties: { userId: { type: "string" } }, required: ["userId"] } },
  { name: "get_current_user", description: "Get current bot user.", inputSchema: { type: "object", properties: {} } },
  { name: "create_dm", description: "Create a DM channel.", inputSchema: { type: "object", properties: { userId: { type: "string" } }, required: ["userId"] } },
  // Threads
  { name: "create_thread", description: "Create a thread.", inputSchema: { type: "object", properties: { channelId: { type: "string" }, name: { type: "string" }, messageId: { type: "string" }, autoArchiveDuration: { type: "number" } }, required: ["channelId", "name"] } },
  { name: "list_threads", description: "List active threads in a channel.", inputSchema: { type: "object", properties: { channelId: { type: "string" } }, required: ["channelId"] } },
  // Webhooks
  { name: "list_webhooks", description: "List webhooks in a channel.", inputSchema: { type: "object", properties: { channelId: { type: "string" } }, required: ["channelId"] } },
  { name: "create_webhook", description: "Create a webhook.", inputSchema: { type: "object", properties: { channelId: { type: "string" }, name: { type: "string" } }, required: ["channelId", "name"] } },
  { name: "execute_webhook", description: "Execute a webhook.", inputSchema: { type: "object", properties: { webhookId: { type: "string" }, webhookToken: { type: "string" }, content: { type: "string" }, username: { type: "string" }, embeds: { type: "array" } }, required: ["webhookId", "webhookToken", "content"] } },
  // Moderation
  { name: "ban_member", description: "Ban a member.", inputSchema: { type: "object", properties: { guildId: { type: "string" }, userId: { type: "string" }, reason: { type: "string" }, deleteMessageDays: { type: "number" } }, required: ["guildId", "userId"] } },
  { name: "kick_member", description: "Kick a member.", inputSchema: { type: "object", properties: { guildId: { type: "string" }, userId: { type: "string" }, reason: { type: "string" } }, required: ["guildId", "userId"] } },
  { name: "timeout_member", description: "Timeout a member.", inputSchema: { type: "object", properties: { guildId: { type: "string" }, userId: { type: "string" }, duration: { type: "number", description: "Duration in seconds" } }, required: ["guildId", "userId", "duration"] } },
];

async function listGuilds(): Promise<any> {
  const result = await discordRequest("GET", "/users/@me/guilds");
  return { guilds: result.map((g: any) => ({ id: g.id, name: g.name, icon: g.icon, owner: g.owner })) };
}

async function getGuild(params: { guildId: string }): Promise<any> {
  return discordRequest("GET", `/guilds/${params.guildId}`);
}

async function getGuildChannels(params: { guildId: string }): Promise<any> {
  const result = await discordRequest("GET", `/guilds/${params.guildId}/channels`);
  return { channels: result.map((c: any) => ({ id: c.id, name: c.name, type: c.type, parentId: c.parent_id })) };
}

async function getGuildMembers(params: { guildId: string; limit?: number }): Promise<any> {
  const result = await discordRequest("GET", `/guilds/${params.guildId}/members?limit=${params.limit || 100}`);
  return { members: result.map((m: any) => ({ id: m.user?.id, username: m.user?.username, nick: m.nick, roles: m.roles })) };
}

async function getGuildRoles(params: { guildId: string }): Promise<any> {
  const result = await discordRequest("GET", `/guilds/${params.guildId}/roles`);
  return { roles: result.map((r: any) => ({ id: r.id, name: r.name, color: r.color, position: r.position })) };
}

async function getChannel(params: { channelId: string }): Promise<any> {
  return discordRequest("GET", `/channels/${params.channelId}`);
}

async function createChannel(params: { guildId: string; name: string; type?: number; parentId?: string }): Promise<any> {
  return discordRequest("POST", `/guilds/${params.guildId}/channels`, { name: params.name, type: params.type || 0, parent_id: params.parentId });
}

async function deleteChannel(params: { channelId: string }): Promise<any> {
  await discordRequest("DELETE", `/channels/${params.channelId}`);
  return { deleted: true };
}

async function getMessages(params: { channelId: string; limit?: number; before?: string; after?: string }): Promise<any> {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", params.limit.toString());
  if (params.before) query.set("before", params.before);
  if (params.after) query.set("after", params.after);
  const result = await discordRequest("GET", `/channels/${params.channelId}/messages?${query.toString()}`);
  return { messages: result.map((m: any) => ({ id: m.id, content: m.content, author: m.author?.username, timestamp: m.timestamp })) };
}

async function sendMessage(params: { channelId: string; content: string; embeds?: any[] }): Promise<any> {
  return discordRequest("POST", `/channels/${params.channelId}/messages`, { content: params.content, embeds: params.embeds });
}

async function editMessage(params: { channelId: string; messageId: string; content: string }): Promise<any> {
  return discordRequest("PATCH", `/channels/${params.channelId}/messages/${params.messageId}`, { content: params.content });
}

async function deleteMessage(params: { channelId: string; messageId: string }): Promise<any> {
  await discordRequest("DELETE", `/channels/${params.channelId}/messages/${params.messageId}`);
  return { deleted: true };
}

async function addReaction(params: { channelId: string; messageId: string; emoji: string }): Promise<any> {
  await discordRequest("PUT", `/channels/${params.channelId}/messages/${params.messageId}/reactions/${encodeURIComponent(params.emoji)}/@me`);
  return { added: true };
}

async function getUser(params: { userId: string }): Promise<any> {
  return discordRequest("GET", `/users/${params.userId}`);
}

async function getCurrentUser(): Promise<any> {
  return discordRequest("GET", "/users/@me");
}

async function createDM(params: { userId: string }): Promise<any> {
  return discordRequest("POST", "/users/@me/channels", { recipient_id: params.userId });
}

async function createThread(params: { channelId: string; name: string; messageId?: string; autoArchiveDuration?: number }): Promise<any> {
  if (params.messageId) {
    return discordRequest("POST", `/channels/${params.channelId}/messages/${params.messageId}/threads`, { name: params.name, auto_archive_duration: params.autoArchiveDuration || 1440 });
  }
  return discordRequest("POST", `/channels/${params.channelId}/threads`, { name: params.name, auto_archive_duration: params.autoArchiveDuration || 1440, type: 11 });
}

async function listThreads(params: { channelId: string }): Promise<any> {
  const result = await discordRequest("GET", `/channels/${params.channelId}/threads/active`);
  return { threads: result.threads?.map((t: any) => ({ id: t.id, name: t.name, archived: t.thread_metadata?.archived })) || [] };
}

async function listWebhooks(params: { channelId: string }): Promise<any> {
  const result = await discordRequest("GET", `/channels/${params.channelId}/webhooks`);
  return { webhooks: result.map((w: any) => ({ id: w.id, name: w.name, token: w.token })) };
}

async function createWebhook(params: { channelId: string; name: string }): Promise<any> {
  return discordRequest("POST", `/channels/${params.channelId}/webhooks`, { name: params.name });
}

async function executeWebhook(params: { webhookId: string; webhookToken: string; content: string; username?: string; embeds?: any[] }): Promise<any> {
  return discordRequest("POST", `/webhooks/${params.webhookId}/${params.webhookToken}`, { content: params.content, username: params.username, embeds: params.embeds });
}

async function banMember(params: { guildId: string; userId: string; reason?: string; deleteMessageDays?: number }): Promise<any> {
  await discordRequest("PUT", `/guilds/${params.guildId}/bans/${params.userId}`, { delete_message_days: params.deleteMessageDays || 0 });
  return { banned: true };
}

async function kickMember(params: { guildId: string; userId: string; reason?: string }): Promise<any> {
  await discordRequest("DELETE", `/guilds/${params.guildId}/members/${params.userId}`);
  return { kicked: true };
}

async function timeoutMember(params: { guildId: string; userId: string; duration: number }): Promise<any> {
  const timeout = new Date(Date.now() + params.duration * 1000).toISOString();
  return discordRequest("PATCH", `/guilds/${params.guildId}/members/${params.userId}`, { communication_disabled_until: timeout });
}

const server = new Server({ name: "discord-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "list_guilds": result = await listGuilds(); break;
      case "get_guild": result = await getGuild(args as any); break;
      case "get_guild_channels": result = await getGuildChannels(args as any); break;
      case "get_guild_members": result = await getGuildMembers(args as any); break;
      case "get_guild_roles": result = await getGuildRoles(args as any); break;
      case "get_channel": result = await getChannel(args as any); break;
      case "create_channel": result = await createChannel(args as any); break;
      case "delete_channel": result = await deleteChannel(args as any); break;
      case "get_messages": result = await getMessages(args as any); break;
      case "send_message": result = await sendMessage(args as any); break;
      case "edit_message": result = await editMessage(args as any); break;
      case "delete_message": result = await deleteMessage(args as any); break;
      case "add_reaction": result = await addReaction(args as any); break;
      case "get_user": result = await getUser(args as any); break;
      case "get_current_user": result = await getCurrentUser(); break;
      case "create_dm": result = await createDM(args as any); break;
      case "create_thread": result = await createThread(args as any); break;
      case "list_threads": result = await listThreads(args as any); break;
      case "list_webhooks": result = await listWebhooks(args as any); break;
      case "create_webhook": result = await createWebhook(args as any); break;
      case "execute_webhook": result = await executeWebhook(args as any); break;
      case "ban_member": result = await banMember(args as any); break;
      case "kick_member": result = await kickMember(args as any); break;
      case "timeout_member": result = await timeoutMember(args as any); break;
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
  console.error("Discord MCP Server running on stdio");
}

main().catch(console.error);
