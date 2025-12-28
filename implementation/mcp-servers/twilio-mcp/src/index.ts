/**
 * Twilio MCP Server - SMS, Voice, and WhatsApp messaging for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import Twilio from "twilio";

const config = {
  accountSid: process.env.TWILIO_ACCOUNT_SID || "",
  authToken: process.env.TWILIO_AUTH_TOKEN || "",
  defaultFrom: process.env.TWILIO_PHONE_NUMBER || "",
  defaultWhatsAppFrom: process.env.TWILIO_WHATSAPP_NUMBER || "",
};

const client = Twilio(config.accountSid, config.authToken);

const TOOLS: Tool[] = [
  // SMS
  { name: "send_sms", description: "Send an SMS message.", inputSchema: { type: "object", properties: { to: { type: "string" }, body: { type: "string" }, from: { type: "string" }, mediaUrl: { type: "array", items: { type: "string" } } }, required: ["to", "body"] } },
  { name: "list_messages", description: "List SMS messages.", inputSchema: { type: "object", properties: { to: { type: "string" }, from: { type: "string" }, dateSent: { type: "string" }, limit: { type: "number" } } } },
  { name: "get_message", description: "Get message details.", inputSchema: { type: "object", properties: { messageSid: { type: "string" } }, required: ["messageSid"] } },
  // Voice Calls
  { name: "make_call", description: "Make a voice call.", inputSchema: { type: "object", properties: { to: { type: "string" }, from: { type: "string" }, url: { type: "string", description: "TwiML URL for call instructions" }, twiml: { type: "string", description: "TwiML instructions" }, record: { type: "boolean" }, timeout: { type: "number" } }, required: ["to"] } },
  { name: "list_calls", description: "List voice calls.", inputSchema: { type: "object", properties: { to: { type: "string" }, from: { type: "string" }, status: { type: "string" }, limit: { type: "number" } } } },
  { name: "get_call", description: "Get call details.", inputSchema: { type: "object", properties: { callSid: { type: "string" } }, required: ["callSid"] } },
  { name: "update_call", description: "Update an in-progress call.", inputSchema: { type: "object", properties: { callSid: { type: "string" }, url: { type: "string" }, twiml: { type: "string" }, status: { type: "string", enum: ["canceled", "completed"] } }, required: ["callSid"] } },
  // WhatsApp
  { name: "send_whatsapp", description: "Send a WhatsApp message.", inputSchema: { type: "object", properties: { to: { type: "string" }, body: { type: "string" }, from: { type: "string" }, mediaUrl: { type: "array", items: { type: "string" } } }, required: ["to", "body"] } },
  // Phone Numbers
  { name: "list_phone_numbers", description: "List available phone numbers.", inputSchema: { type: "object", properties: { limit: { type: "number" } } } },
  { name: "search_available_numbers", description: "Search for available phone numbers to purchase.", inputSchema: { type: "object", properties: { countryCode: { type: "string" }, areaCode: { type: "string" }, contains: { type: "string" }, smsEnabled: { type: "boolean" }, voiceEnabled: { type: "boolean" }, limit: { type: "number" } }, required: ["countryCode"] } },
  { name: "buy_phone_number", description: "Purchase a phone number.", inputSchema: { type: "object", properties: { phoneNumber: { type: "string" }, friendlyName: { type: "string" }, smsUrl: { type: "string" }, voiceUrl: { type: "string" } }, required: ["phoneNumber"] } },
  // Recordings
  { name: "list_recordings", description: "List call recordings.", inputSchema: { type: "object", properties: { callSid: { type: "string" }, limit: { type: "number" } } } },
  { name: "get_recording", description: "Get recording details.", inputSchema: { type: "object", properties: { recordingSid: { type: "string" } }, required: ["recordingSid"] } },
  { name: "delete_recording", description: "Delete a recording.", inputSchema: { type: "object", properties: { recordingSid: { type: "string" } }, required: ["recordingSid"] } },
  // Verify (2FA)
  { name: "send_verification", description: "Send a verification code.", inputSchema: { type: "object", properties: { to: { type: "string" }, channel: { type: "string", enum: ["sms", "call", "email", "whatsapp"] }, serviceSid: { type: "string" } }, required: ["to", "channel", "serviceSid"] } },
  { name: "check_verification", description: "Check a verification code.", inputSchema: { type: "object", properties: { to: { type: "string" }, code: { type: "string" }, serviceSid: { type: "string" } }, required: ["to", "code", "serviceSid"] } },
  // Account
  { name: "get_account_balance", description: "Get account balance.", inputSchema: { type: "object", properties: {} } },
  { name: "get_usage", description: "Get usage records.", inputSchema: { type: "object", properties: { category: { type: "string" }, startDate: { type: "string" }, endDate: { type: "string" } } } },
];

async function sendSms(params: { to: string; body: string; from?: string; mediaUrl?: string[] }): Promise<any> {
  const message = await client.messages.create({
    to: params.to,
    from: params.from || config.defaultFrom,
    body: params.body,
    mediaUrl: params.mediaUrl,
  });
  return { sid: message.sid, to: message.to, status: message.status, dateCreated: message.dateCreated };
}

async function listMessages(params: { to?: string; from?: string; dateSent?: string; limit?: number }): Promise<any> {
  const messages = await client.messages.list({
    to: params.to,
    from: params.from,
    dateSent: params.dateSent ? new Date(params.dateSent) : undefined,
    limit: params.limit || 20,
  });
  return { messages: messages.map(m => ({ sid: m.sid, to: m.to, from: m.from, body: m.body?.slice(0, 100), status: m.status, dateCreated: m.dateCreated })) };
}

async function getMessage(params: { messageSid: string }): Promise<any> {
  const message = await client.messages(params.messageSid).fetch();
  return { sid: message.sid, to: message.to, from: message.from, body: message.body, status: message.status, dateCreated: message.dateCreated, dateSent: message.dateSent };
}

async function makeCall(params: { to: string; from?: string; url?: string; twiml?: string; record?: boolean; timeout?: number }): Promise<any> {
  const callParams: any = {
    to: params.to,
    from: params.from || config.defaultFrom,
    record: params.record,
    timeout: params.timeout,
  };
  if (params.url) callParams.url = params.url;
  if (params.twiml) callParams.twiml = params.twiml;
  const call = await client.calls.create(callParams);
  return { sid: call.sid, to: call.to, from: call.from, status: call.status, direction: call.direction };
}

async function listCalls(params: { to?: string; from?: string; status?: string; limit?: number }): Promise<any> {
  const calls = await client.calls.list({
    to: params.to,
    from: params.from,
    status: params.status as any,
    limit: params.limit || 20,
  });
  return { calls: calls.map(c => ({ sid: c.sid, to: c.to, from: c.from, status: c.status, duration: c.duration, direction: c.direction })) };
}

async function getCall(params: { callSid: string }): Promise<any> {
  const call = await client.calls(params.callSid).fetch();
  return { sid: call.sid, to: call.to, from: call.from, status: call.status, duration: call.duration, direction: call.direction, startTime: call.startTime, endTime: call.endTime };
}

async function updateCall(params: { callSid: string; url?: string; twiml?: string; status?: string }): Promise<any> {
  const updateParams: any = {};
  if (params.url) updateParams.url = params.url;
  if (params.twiml) updateParams.twiml = params.twiml;
  if (params.status) updateParams.status = params.status;
  const call = await client.calls(params.callSid).update(updateParams);
  return { sid: call.sid, status: call.status, updated: true };
}

async function sendWhatsapp(params: { to: string; body: string; from?: string; mediaUrl?: string[] }): Promise<any> {
  const to = params.to.startsWith("whatsapp:") ? params.to : `whatsapp:${params.to}`;
  const from = params.from || config.defaultWhatsAppFrom || `whatsapp:${config.defaultFrom}`;
  const message = await client.messages.create({
    to,
    from: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    body: params.body,
    mediaUrl: params.mediaUrl,
  });
  return { sid: message.sid, to: message.to, status: message.status };
}

async function listPhoneNumbers(params: { limit?: number }): Promise<any> {
  const numbers = await client.incomingPhoneNumbers.list({ limit: params.limit || 20 });
  return { phoneNumbers: numbers.map(n => ({ sid: n.sid, phoneNumber: n.phoneNumber, friendlyName: n.friendlyName, capabilities: n.capabilities })) };
}

async function searchAvailableNumbers(params: { countryCode: string; areaCode?: string; contains?: string; smsEnabled?: boolean; voiceEnabled?: boolean; limit?: number }): Promise<any> {
  const search = client.availablePhoneNumbers(params.countryCode).local;
  const numbers = await search.list({
    areaCode: params.areaCode ? parseInt(params.areaCode) : undefined,
    contains: params.contains,
    smsEnabled: params.smsEnabled,
    voiceEnabled: params.voiceEnabled,
    limit: params.limit || 10,
  });
  return { numbers: numbers.map(n => ({ phoneNumber: n.phoneNumber, friendlyName: n.friendlyName, capabilities: n.capabilities, region: n.region })) };
}

async function buyPhoneNumber(params: { phoneNumber: string; friendlyName?: string; smsUrl?: string; voiceUrl?: string }): Promise<any> {
  const number = await client.incomingPhoneNumbers.create({
    phoneNumber: params.phoneNumber,
    friendlyName: params.friendlyName,
    smsUrl: params.smsUrl,
    voiceUrl: params.voiceUrl,
  });
  return { sid: number.sid, phoneNumber: number.phoneNumber, friendlyName: number.friendlyName };
}

async function listRecordings(params: { callSid?: string; limit?: number }): Promise<any> {
  const recordings = await client.recordings.list({ callSid: params.callSid, limit: params.limit || 20 });
  return { recordings: recordings.map(r => ({ sid: r.sid, callSid: r.callSid, duration: r.duration, dateCreated: r.dateCreated })) };
}

async function getRecording(params: { recordingSid: string }): Promise<any> {
  const recording = await client.recordings(params.recordingSid).fetch();
  return { sid: recording.sid, callSid: recording.callSid, duration: recording.duration, dateCreated: recording.dateCreated, mediaUrl: recording.uri };
}

async function deleteRecording(params: { recordingSid: string }): Promise<any> {
  await client.recordings(params.recordingSid).remove();
  return { sid: params.recordingSid, deleted: true };
}

async function sendVerification(params: { to: string; channel: string; serviceSid: string }): Promise<any> {
  const verification = await client.verify.v2.services(params.serviceSid).verifications.create({
    to: params.to,
    channel: params.channel,
  });
  return { sid: verification.sid, to: verification.to, channel: verification.channel, status: verification.status };
}

async function checkVerification(params: { to: string; code: string; serviceSid: string }): Promise<any> {
  const check = await client.verify.v2.services(params.serviceSid).verificationChecks.create({
    to: params.to,
    code: params.code,
  });
  return { sid: check.sid, to: check.to, status: check.status, valid: check.status === "approved" };
}

async function getAccountBalance(): Promise<any> {
  const balance = await client.balance.fetch();
  return { balance: balance.balance, currency: balance.currency };
}

async function getUsage(params: { category?: string; startDate?: string; endDate?: string }): Promise<any> {
  const records = await client.usage.records.list({
    category: params.category as any,
    startDate: params.startDate ? new Date(params.startDate) : undefined,
    endDate: params.endDate ? new Date(params.endDate) : undefined,
  });
  return { records: records.map(r => ({ category: r.category, description: r.description, count: r.count, usage: r.usage, price: r.price })) };
}

const server = new Server({ name: "twilio-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "send_sms": result = await sendSms(args as any); break;
      case "list_messages": result = await listMessages(args as any); break;
      case "get_message": result = await getMessage(args as any); break;
      case "make_call": result = await makeCall(args as any); break;
      case "list_calls": result = await listCalls(args as any); break;
      case "get_call": result = await getCall(args as any); break;
      case "update_call": result = await updateCall(args as any); break;
      case "send_whatsapp": result = await sendWhatsapp(args as any); break;
      case "list_phone_numbers": result = await listPhoneNumbers(args as any); break;
      case "search_available_numbers": result = await searchAvailableNumbers(args as any); break;
      case "buy_phone_number": result = await buyPhoneNumber(args as any); break;
      case "list_recordings": result = await listRecordings(args as any); break;
      case "get_recording": result = await getRecording(args as any); break;
      case "delete_recording": result = await deleteRecording(args as any); break;
      case "send_verification": result = await sendVerification(args as any); break;
      case "check_verification": result = await checkVerification(args as any); break;
      case "get_account_balance": result = await getAccountBalance(); break;
      case "get_usage": result = await getUsage(args as any); break;
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
  console.error("Twilio MCP Server running on stdio");
}

main().catch(console.error);
