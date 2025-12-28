/**
 * SendGrid MCP Server - Transactional email and marketing campaigns for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import sgMail from "@sendgrid/mail";
import sgClient from "@sendgrid/client";

const config = {
  apiKey: process.env.SENDGRID_API_KEY || "",
  defaultFrom: process.env.SENDGRID_FROM_EMAIL || "",
  defaultFromName: process.env.SENDGRID_FROM_NAME || "",
};

sgMail.setApiKey(config.apiKey);
sgClient.setApiKey(config.apiKey);

const TOOLS: Tool[] = [
  // Email Sending
  { name: "send_email", description: "Send a transactional email.", inputSchema: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, text: { type: "string" }, html: { type: "string" }, from: { type: "string" }, fromName: { type: "string" }, replyTo: { type: "string" }, cc: { type: "array", items: { type: "string" } }, bcc: { type: "array", items: { type: "string" } }, attachments: { type: "array", items: { type: "object" } }, templateId: { type: "string" }, dynamicTemplateData: { type: "object" } }, required: ["to", "subject"] } },
  { name: "send_bulk_email", description: "Send emails to multiple recipients.", inputSchema: { type: "object", properties: { personalizations: { type: "array", items: { type: "object" } }, subject: { type: "string" }, text: { type: "string" }, html: { type: "string" }, from: { type: "string" }, templateId: { type: "string" } }, required: ["personalizations"] } },
  // Templates
  { name: "list_templates", description: "List email templates.", inputSchema: { type: "object", properties: { generations: { type: "string", enum: ["legacy", "dynamic"] }, pageSize: { type: "number" } } } },
  { name: "get_template", description: "Get template details.", inputSchema: { type: "object", properties: { templateId: { type: "string" } }, required: ["templateId"] } },
  { name: "create_template", description: "Create a new template.", inputSchema: { type: "object", properties: { name: { type: "string" }, generation: { type: "string", enum: ["legacy", "dynamic"] } }, required: ["name"] } },
  { name: "update_template", description: "Update a template.", inputSchema: { type: "object", properties: { templateId: { type: "string" }, name: { type: "string" } }, required: ["templateId", "name"] } },
  { name: "delete_template", description: "Delete a template.", inputSchema: { type: "object", properties: { templateId: { type: "string" } }, required: ["templateId"] } },
  { name: "create_template_version", description: "Create a template version.", inputSchema: { type: "object", properties: { templateId: { type: "string" }, name: { type: "string" }, subject: { type: "string" }, htmlContent: { type: "string" }, plainContent: { type: "string" }, active: { type: "number" } }, required: ["templateId", "name", "subject", "htmlContent"] } },
  // Contacts
  { name: "add_contacts", description: "Add or update contacts.", inputSchema: { type: "object", properties: { contacts: { type: "array", items: { type: "object" } }, listIds: { type: "array", items: { type: "string" } } }, required: ["contacts"] } },
  { name: "search_contacts", description: "Search contacts.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "get_contact", description: "Get contact by ID.", inputSchema: { type: "object", properties: { contactId: { type: "string" } }, required: ["contactId"] } },
  { name: "delete_contacts", description: "Delete contacts.", inputSchema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } }, deleteAllContacts: { type: "boolean" } } } },
  // Lists
  { name: "list_contact_lists", description: "List contact lists.", inputSchema: { type: "object", properties: { pageSize: { type: "number" } } } },
  { name: "create_contact_list", description: "Create a contact list.", inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "delete_contact_list", description: "Delete a contact list.", inputSchema: { type: "object", properties: { listId: { type: "string" }, deleteContacts: { type: "boolean" } }, required: ["listId"] } },
  // Suppressions
  { name: "list_bounces", description: "List bounced emails.", inputSchema: { type: "object", properties: { startTime: { type: "number" }, endTime: { type: "number" } } } },
  { name: "list_spam_reports", description: "List spam reports.", inputSchema: { type: "object", properties: { startTime: { type: "number" }, endTime: { type: "number" } } } },
  { name: "list_unsubscribes", description: "List global unsubscribes.", inputSchema: { type: "object", properties: { startTime: { type: "number" }, endTime: { type: "number" } } } },
  // Stats
  { name: "get_stats", description: "Get email statistics.", inputSchema: { type: "object", properties: { startDate: { type: "string" }, endDate: { type: "string" }, aggregatedBy: { type: "string", enum: ["day", "week", "month"] } }, required: ["startDate"] } },
  // Sender Identity
  { name: "list_senders", description: "List verified senders.", inputSchema: { type: "object", properties: {} } },
  { name: "create_sender", description: "Create a verified sender.", inputSchema: { type: "object", properties: { nickname: { type: "string" }, from: { type: "object", properties: { email: { type: "string" }, name: { type: "string" } } }, replyTo: { type: "object" }, address: { type: "string" }, city: { type: "string" }, country: { type: "string" } }, required: ["nickname", "from", "address", "city", "country"] } },
];

async function sendEmail(params: { to: string; subject: string; text?: string; html?: string; from?: string; fromName?: string; replyTo?: string; cc?: string[]; bcc?: string[]; attachments?: any[]; templateId?: string; dynamicTemplateData?: any }): Promise<any> {
  const msg: any = {
    to: params.to,
    from: { email: params.from || config.defaultFrom, name: params.fromName || config.defaultFromName },
    subject: params.subject,
    text: params.text,
    html: params.html,
    replyTo: params.replyTo,
    cc: params.cc,
    bcc: params.bcc,
    attachments: params.attachments,
    templateId: params.templateId,
    dynamicTemplateData: params.dynamicTemplateData,
  };
  const [response] = await sgMail.send(msg);
  return { statusCode: response.statusCode, messageId: response.headers["x-message-id"], sent: true };
}

async function sendBulkEmail(params: { personalizations: any[]; subject?: string; text?: string; html?: string; from?: string; templateId?: string }): Promise<any> {
  const msg: any = {
    personalizations: params.personalizations,
    from: params.from || config.defaultFrom,
    subject: params.subject,
    text: params.text,
    html: params.html,
    templateId: params.templateId,
  };
  const [response] = await sgMail.send(msg);
  return { statusCode: response.statusCode, sent: true, recipientCount: params.personalizations.length };
}

async function listTemplates(params: { generations?: string; pageSize?: number }): Promise<any> {
  const [, body] = await sgClient.request({
    url: "/v3/templates",
    method: "GET",
    qs: { generations: params.generations || "dynamic", page_size: params.pageSize || 50 },
  });
  return { templates: (body as any).templates || [] };
}

async function getTemplate(params: { templateId: string }): Promise<any> {
  const [, body] = await sgClient.request({ url: `/v3/templates/${params.templateId}`, method: "GET" });
  return body;
}

async function createTemplate(params: { name: string; generation?: string }): Promise<any> {
  const [, body] = await sgClient.request({
    url: "/v3/templates",
    method: "POST",
    body: { name: params.name, generation: params.generation || "dynamic" },
  });
  return body;
}

async function updateTemplate(params: { templateId: string; name: string }): Promise<any> {
  const [, body] = await sgClient.request({
    url: `/v3/templates/${params.templateId}`,
    method: "PATCH",
    body: { name: params.name },
  });
  return body;
}

async function deleteTemplate(params: { templateId: string }): Promise<any> {
  await sgClient.request({ url: `/v3/templates/${params.templateId}`, method: "DELETE" });
  return { deleted: true, templateId: params.templateId };
}

async function createTemplateVersion(params: { templateId: string; name: string; subject: string; htmlContent: string; plainContent?: string; active?: number }): Promise<any> {
  const [, body] = await sgClient.request({
    url: `/v3/templates/${params.templateId}/versions`,
    method: "POST",
    body: { name: params.name, subject: params.subject, html_content: params.htmlContent, plain_content: params.plainContent, active: params.active || 1 },
  });
  return body;
}

async function addContacts(params: { contacts: any[]; listIds?: string[] }): Promise<any> {
  const [, body] = await sgClient.request({
    url: "/v3/marketing/contacts",
    method: "PUT",
    body: { contacts: params.contacts, list_ids: params.listIds },
  });
  return body;
}

async function searchContacts(params: { query: string }): Promise<any> {
  const [, body] = await sgClient.request({
    url: "/v3/marketing/contacts/search",
    method: "POST",
    body: { query: params.query },
  });
  return body;
}

async function getContact(params: { contactId: string }): Promise<any> {
  const [, body] = await sgClient.request({ url: `/v3/marketing/contacts/${params.contactId}`, method: "GET" });
  return body;
}

async function deleteContacts(params: { ids?: string[]; deleteAllContacts?: boolean }): Promise<any> {
  const qs: any = {};
  if (params.ids) qs.ids = params.ids.join(",");
  if (params.deleteAllContacts) qs.delete_all_contacts = "true";
  const [, body] = await sgClient.request({ url: "/v3/marketing/contacts", method: "DELETE", qs });
  return body;
}

async function listContactLists(params: { pageSize?: number }): Promise<any> {
  const [, body] = await sgClient.request({
    url: "/v3/marketing/lists",
    method: "GET",
    qs: { page_size: params.pageSize || 50 },
  });
  return body;
}

async function createContactList(params: { name: string }): Promise<any> {
  const [, body] = await sgClient.request({
    url: "/v3/marketing/lists",
    method: "POST",
    body: { name: params.name },
  });
  return body;
}

async function deleteContactList(params: { listId: string; deleteContacts?: boolean }): Promise<any> {
  await sgClient.request({
    url: `/v3/marketing/lists/${params.listId}`,
    method: "DELETE",
    qs: { delete_contacts: params.deleteContacts?.toString() },
  });
  return { deleted: true, listId: params.listId };
}

async function listBounces(params: { startTime?: number; endTime?: number }): Promise<any> {
  const qs: any = {};
  if (params.startTime) qs.start_time = params.startTime;
  if (params.endTime) qs.end_time = params.endTime;
  const [, body] = await sgClient.request({ url: "/v3/suppression/bounces", method: "GET", qs });
  return { bounces: body };
}

async function listSpamReports(params: { startTime?: number; endTime?: number }): Promise<any> {
  const qs: any = {};
  if (params.startTime) qs.start_time = params.startTime;
  if (params.endTime) qs.end_time = params.endTime;
  const [, body] = await sgClient.request({ url: "/v3/suppression/spam_reports", method: "GET", qs });
  return { spamReports: body };
}

async function listUnsubscribes(params: { startTime?: number; endTime?: number }): Promise<any> {
  const qs: any = {};
  if (params.startTime) qs.start_time = params.startTime;
  if (params.endTime) qs.end_time = params.endTime;
  const [, body] = await sgClient.request({ url: "/v3/suppression/unsubscribes", method: "GET", qs });
  return { unsubscribes: body };
}

async function getStats(params: { startDate: string; endDate?: string; aggregatedBy?: string }): Promise<any> {
  const [, body] = await sgClient.request({
    url: "/v3/stats",
    method: "GET",
    qs: { start_date: params.startDate, end_date: params.endDate, aggregated_by: params.aggregatedBy || "day" },
  });
  return { stats: body };
}

async function listSenders(): Promise<any> {
  const [, body] = await sgClient.request({ url: "/v3/verified_senders", method: "GET" });
  return body;
}

async function createSender(params: { nickname: string; from: { email: string; name?: string }; replyTo?: { email: string; name?: string }; address: string; city: string; country: string }): Promise<any> {
  const [, body] = await sgClient.request({
    url: "/v3/verified_senders",
    method: "POST",
    body: {
      nickname: params.nickname,
      from_email: params.from.email,
      from_name: params.from.name,
      reply_to: params.replyTo?.email,
      reply_to_name: params.replyTo?.name,
      address: params.address,
      city: params.city,
      country: params.country,
    },
  });
  return body;
}

const server = new Server({ name: "sendgrid-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "send_email": result = await sendEmail(args as any); break;
      case "send_bulk_email": result = await sendBulkEmail(args as any); break;
      case "list_templates": result = await listTemplates(args as any); break;
      case "get_template": result = await getTemplate(args as any); break;
      case "create_template": result = await createTemplate(args as any); break;
      case "update_template": result = await updateTemplate(args as any); break;
      case "delete_template": result = await deleteTemplate(args as any); break;
      case "create_template_version": result = await createTemplateVersion(args as any); break;
      case "add_contacts": result = await addContacts(args as any); break;
      case "search_contacts": result = await searchContacts(args as any); break;
      case "get_contact": result = await getContact(args as any); break;
      case "delete_contacts": result = await deleteContacts(args as any); break;
      case "list_contact_lists": result = await listContactLists(args as any); break;
      case "create_contact_list": result = await createContactList(args as any); break;
      case "delete_contact_list": result = await deleteContactList(args as any); break;
      case "list_bounces": result = await listBounces(args as any); break;
      case "list_spam_reports": result = await listSpamReports(args as any); break;
      case "list_unsubscribes": result = await listUnsubscribes(args as any); break;
      case "get_stats": result = await getStats(args as any); break;
      case "list_senders": result = await listSenders(); break;
      case "create_sender": result = await createSender(args as any); break;
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
  console.error("SendGrid MCP Server running on stdio");
}

main().catch(console.error);
