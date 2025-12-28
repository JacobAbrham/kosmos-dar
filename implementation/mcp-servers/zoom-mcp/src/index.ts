/**
 * Zoom MCP Server - Zoom meetings integration for KOSMOS
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  accountId: process.env.ZOOM_ACCOUNT_ID || "",
  clientId: process.env.ZOOM_CLIENT_ID || "",
  clientSecret: process.env.ZOOM_CLIENT_SECRET || "",
  apiUrl: "https://api.zoom.us/v2",
};

let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${config.accountId}`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) throw new Error("Zoom authentication failed");

  const data = await res.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken!;
}

async function zoomRequest(method: string, path: string, body?: any): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
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
  // Meetings
  { name: "list_meetings", description: "List user meetings.", inputSchema: { type: "object", properties: { userId: { type: "string" }, type: { type: "string", enum: ["scheduled", "live", "upcoming"] } } } },
  { name: "get_meeting", description: "Get meeting details.", inputSchema: { type: "object", properties: { meetingId: { type: "string" } }, required: ["meetingId"] } },
  { name: "create_meeting", description: "Create a meeting.", inputSchema: { type: "object", properties: { userId: { type: "string" }, topic: { type: "string" }, type: { type: "number" }, startTime: { type: "string" }, duration: { type: "number" }, timezone: { type: "string" }, agenda: { type: "string" }, password: { type: "string" } }, required: ["topic"] } },
  { name: "update_meeting", description: "Update a meeting.", inputSchema: { type: "object", properties: { meetingId: { type: "string" }, topic: { type: "string" }, startTime: { type: "string" }, duration: { type: "number" } }, required: ["meetingId"] } },
  { name: "delete_meeting", description: "Delete a meeting.", inputSchema: { type: "object", properties: { meetingId: { type: "string" } }, required: ["meetingId"] } },
  { name: "end_meeting", description: "End a live meeting.", inputSchema: { type: "object", properties: { meetingId: { type: "string" } }, required: ["meetingId"] } },
  // Participants
  { name: "list_participants", description: "List meeting participants.", inputSchema: { type: "object", properties: { meetingId: { type: "string" } }, required: ["meetingId"] } },
  // Registrants
  { name: "list_registrants", description: "List meeting registrants.", inputSchema: { type: "object", properties: { meetingId: { type: "string" } }, required: ["meetingId"] } },
  { name: "add_registrant", description: "Add meeting registrant.", inputSchema: { type: "object", properties: { meetingId: { type: "string" }, email: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" } }, required: ["meetingId", "email", "firstName"] } },
  // Recordings
  { name: "list_recordings", description: "List user recordings.", inputSchema: { type: "object", properties: { userId: { type: "string" }, from: { type: "string" }, to: { type: "string" } } } },
  { name: "get_recording", description: "Get meeting recordings.", inputSchema: { type: "object", properties: { meetingId: { type: "string" } }, required: ["meetingId"] } },
  { name: "delete_recording", description: "Delete recording.", inputSchema: { type: "object", properties: { meetingId: { type: "string" }, action: { type: "string", enum: ["trash", "delete"] } }, required: ["meetingId"] } },
  // Users
  { name: "list_users", description: "List users.", inputSchema: { type: "object", properties: { status: { type: "string" }, pageSize: { type: "number" } } } },
  { name: "get_user", description: "Get user details.", inputSchema: { type: "object", properties: { userId: { type: "string" } }, required: ["userId"] } },
  { name: "create_user", description: "Create a user.", inputSchema: { type: "object", properties: { email: { type: "string" }, type: { type: "number" }, firstName: { type: "string" }, lastName: { type: "string" } }, required: ["email", "type"] } },
  // Webinars
  { name: "list_webinars", description: "List user webinars.", inputSchema: { type: "object", properties: { userId: { type: "string" } } } },
  { name: "get_webinar", description: "Get webinar details.", inputSchema: { type: "object", properties: { webinarId: { type: "string" } }, required: ["webinarId"] } },
  { name: "create_webinar", description: "Create a webinar.", inputSchema: { type: "object", properties: { userId: { type: "string" }, topic: { type: "string" }, startTime: { type: "string" }, duration: { type: "number" } }, required: ["topic"] } },
  // Reports
  { name: "get_daily_report", description: "Get daily usage report.", inputSchema: { type: "object", properties: { year: { type: "number" }, month: { type: "number" } } } },
  { name: "get_meeting_report", description: "Get meeting report.", inputSchema: { type: "object", properties: { meetingId: { type: "string" } }, required: ["meetingId"] } },
];

async function listMeetings(params: { userId?: string; type?: string }): Promise<any> {
  const userId = params.userId || "me";
  const query = params.type ? `?type=${params.type}` : "";
  const result = await zoomRequest("GET", `/users/${userId}/meetings${query}`);
  return { meetings: result.meetings?.map((m: any) => ({ id: m.id, topic: m.topic, startTime: m.start_time, duration: m.duration, joinUrl: m.join_url })) };
}

async function getMeeting(params: { meetingId: string }): Promise<any> {
  return zoomRequest("GET", `/meetings/${params.meetingId}`);
}

async function createMeeting(params: { userId?: string; topic: string; type?: number; startTime?: string; duration?: number; timezone?: string; agenda?: string; password?: string }): Promise<any> {
  const userId = params.userId || "me";
  return zoomRequest("POST", `/users/${userId}/meetings`, {
    topic: params.topic,
    type: params.type || 2,
    start_time: params.startTime,
    duration: params.duration || 60,
    timezone: params.timezone,
    agenda: params.agenda,
    password: params.password,
  });
}

async function updateMeeting(params: { meetingId: string; topic?: string; startTime?: string; duration?: number }): Promise<any> {
  return zoomRequest("PATCH", `/meetings/${params.meetingId}`, { topic: params.topic, start_time: params.startTime, duration: params.duration });
}

async function deleteMeeting(params: { meetingId: string }): Promise<any> {
  await zoomRequest("DELETE", `/meetings/${params.meetingId}`);
  return { deleted: true };
}

async function endMeeting(params: { meetingId: string }): Promise<any> {
  return zoomRequest("PUT", `/meetings/${params.meetingId}/status`, { action: "end" });
}

async function listParticipants(params: { meetingId: string }): Promise<any> {
  const result = await zoomRequest("GET", `/past_meetings/${params.meetingId}/participants`);
  return { participants: result.participants };
}

async function listRegistrants(params: { meetingId: string }): Promise<any> {
  const result = await zoomRequest("GET", `/meetings/${params.meetingId}/registrants`);
  return { registrants: result.registrants };
}

async function addRegistrant(params: { meetingId: string; email: string; firstName: string; lastName?: string }): Promise<any> {
  return zoomRequest("POST", `/meetings/${params.meetingId}/registrants`, { email: params.email, first_name: params.firstName, last_name: params.lastName });
}

async function listRecordings(params: { userId?: string; from?: string; to?: string }): Promise<any> {
  const userId = params.userId || "me";
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  const result = await zoomRequest("GET", `/users/${userId}/recordings?${query.toString()}`);
  return { meetings: result.meetings };
}

async function getRecording(params: { meetingId: string }): Promise<any> {
  return zoomRequest("GET", `/meetings/${params.meetingId}/recordings`);
}

async function deleteRecording(params: { meetingId: string; action?: string }): Promise<any> {
  await zoomRequest("DELETE", `/meetings/${params.meetingId}/recordings?action=${params.action || "trash"}`);
  return { deleted: true };
}

async function listUsers(params: { status?: string; pageSize?: number }): Promise<any> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.pageSize) query.set("page_size", params.pageSize.toString());
  const result = await zoomRequest("GET", `/users?${query.toString()}`);
  return { users: result.users?.map((u: any) => ({ id: u.id, email: u.email, firstName: u.first_name, lastName: u.last_name, type: u.type, status: u.status })) };
}

async function getUser(params: { userId: string }): Promise<any> {
  return zoomRequest("GET", `/users/${params.userId}`);
}

async function createUser(params: { email: string; type: number; firstName?: string; lastName?: string }): Promise<any> {
  return zoomRequest("POST", "/users", {
    action: "create",
    user_info: { email: params.email, type: params.type, first_name: params.firstName, last_name: params.lastName },
  });
}

async function listWebinars(params: { userId?: string }): Promise<any> {
  const userId = params.userId || "me";
  const result = await zoomRequest("GET", `/users/${userId}/webinars`);
  return { webinars: result.webinars };
}

async function getWebinar(params: { webinarId: string }): Promise<any> {
  return zoomRequest("GET", `/webinars/${params.webinarId}`);
}

async function createWebinar(params: { userId?: string; topic: string; startTime?: string; duration?: number }): Promise<any> {
  const userId = params.userId || "me";
  return zoomRequest("POST", `/users/${userId}/webinars`, { topic: params.topic, start_time: params.startTime, duration: params.duration });
}

async function getDailyReport(params: { year?: number; month?: number }): Promise<any> {
  const year = params.year || new Date().getFullYear();
  const month = params.month || new Date().getMonth() + 1;
  return zoomRequest("GET", `/report/daily?year=${year}&month=${month}`);
}

async function getMeetingReport(params: { meetingId: string }): Promise<any> {
  return zoomRequest("GET", `/report/meetings/${params.meetingId}`);
}

const server = new Server({ name: "zoom-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "list_meetings": result = await listMeetings(args as any); break;
      case "get_meeting": result = await getMeeting(args as any); break;
      case "create_meeting": result = await createMeeting(args as any); break;
      case "update_meeting": result = await updateMeeting(args as any); break;
      case "delete_meeting": result = await deleteMeeting(args as any); break;
      case "end_meeting": result = await endMeeting(args as any); break;
      case "list_participants": result = await listParticipants(args as any); break;
      case "list_registrants": result = await listRegistrants(args as any); break;
      case "add_registrant": result = await addRegistrant(args as any); break;
      case "list_recordings": result = await listRecordings(args as any); break;
      case "get_recording": result = await getRecording(args as any); break;
      case "delete_recording": result = await deleteRecording(args as any); break;
      case "list_users": result = await listUsers(args as any); break;
      case "get_user": result = await getUser(args as any); break;
      case "create_user": result = await createUser(args as any); break;
      case "list_webinars": result = await listWebinars(args as any); break;
      case "get_webinar": result = await getWebinar(args as any); break;
      case "create_webinar": result = await createWebinar(args as any); break;
      case "get_daily_report": result = await getDailyReport(args as any); break;
      case "get_meeting_report": result = await getMeetingReport(args as any); break;
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
  console.error("Zoom MCP Server running on stdio");
}

main().catch(console.error);
