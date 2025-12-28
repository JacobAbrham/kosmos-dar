/**
 * WhatsApp Business MCP Server
 *
 * Provides WhatsApp messaging capabilities for KOSMOS agents.
 * Features:
 * - Send text, media, and template messages
 * - Receive and process incoming messages
 * - Manage contacts and groups
 * - Handle message status updates
 * - Support for WhatsApp Business API
 *
 * Authentication: Uses WhatsApp Business API credentials or whatsapp-web.js session.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  // WhatsApp Business API config
  apiUrl: process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v18.0",
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "",
  // Alternative: whatsapp-web.js session
  useWebClient: process.env.WHATSAPP_USE_WEB_CLIENT === "true",
};

// Message store for recent messages (in production, use Redis/DB)
const messageStore: Map<string, any[]> = new Map();

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  {
    name: "send_message",
    description: "Send a text message to a WhatsApp number.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient phone number with country code (e.g., +1234567890)",
        },
        message: {
          type: "string",
          description: "Text message to send",
        },
        previewUrl: {
          type: "boolean",
          description: "Enable URL preview in message",
        },
      },
      required: ["to", "message"],
    },
  },
  {
    name: "send_template",
    description: "Send a pre-approved template message (required for initiating conversations).",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient phone number with country code",
        },
        templateName: {
          type: "string",
          description: "Name of the approved template",
        },
        languageCode: {
          type: "string",
          description: "Template language code (e.g., 'en_US')",
        },
        components: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["header", "body", "button"] },
              parameters: { type: "array" },
            },
          },
          description: "Template parameter components",
        },
      },
      required: ["to", "templateName", "languageCode"],
    },
  },
  {
    name: "send_media",
    description: "Send media (image, video, document, audio) via WhatsApp.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient phone number with country code",
        },
        type: {
          type: "string",
          enum: ["image", "video", "document", "audio", "sticker"],
          description: "Type of media to send",
        },
        url: {
          type: "string",
          description: "Public URL of the media file",
        },
        caption: {
          type: "string",
          description: "Caption for image/video (optional)",
        },
        filename: {
          type: "string",
          description: "Filename for documents (optional)",
        },
      },
      required: ["to", "type", "url"],
    },
  },
  {
    name: "send_location",
    description: "Send a location message.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient phone number with country code",
        },
        latitude: {
          type: "number",
          description: "Latitude coordinate",
        },
        longitude: {
          type: "number",
          description: "Longitude coordinate",
        },
        name: {
          type: "string",
          description: "Location name",
        },
        address: {
          type: "string",
          description: "Location address",
        },
      },
      required: ["to", "latitude", "longitude"],
    },
  },
  {
    name: "send_contact",
    description: "Send contact information.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient phone number with country code",
        },
        contacts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "object",
                properties: {
                  formatted_name: { type: "string" },
                  first_name: { type: "string" },
                  last_name: { type: "string" },
                },
              },
              phones: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    phone: { type: "string" },
                    type: { type: "string" },
                  },
                },
              },
              emails: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    email: { type: "string" },
                    type: { type: "string" },
                  },
                },
              },
            },
          },
          description: "Array of contact objects",
        },
      },
      required: ["to", "contacts"],
    },
  },
  {
    name: "send_interactive",
    description: "Send an interactive message with buttons or lists.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient phone number with country code",
        },
        type: {
          type: "string",
          enum: ["button", "list", "product", "product_list"],
          description: "Type of interactive message",
        },
        header: {
          type: "object",
          description: "Optional header (text, image, video, or document)",
        },
        body: {
          type: "string",
          description: "Message body text",
        },
        footer: {
          type: "string",
          description: "Optional footer text",
        },
        buttons: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
            },
          },
          description: "Reply buttons (max 3 for button type)",
        },
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              rows: { type: "array" },
            },
          },
          description: "List sections (for list type)",
        },
      },
      required: ["to", "type", "body"],
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
    name: "get_media",
    description: "Download media from a received message.",
    inputSchema: {
      type: "object",
      properties: {
        mediaId: {
          type: "string",
          description: "Media ID from the received message",
        },
      },
      required: ["mediaId"],
    },
  },
  {
    name: "get_profile",
    description: "Get WhatsApp business profile information.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "update_profile",
    description: "Update WhatsApp business profile.",
    inputSchema: {
      type: "object",
      properties: {
        about: {
          type: "string",
          description: "About/status text",
        },
        address: {
          type: "string",
          description: "Business address",
        },
        description: {
          type: "string",
          description: "Business description",
        },
        email: {
          type: "string",
          description: "Business email",
        },
        websites: {
          type: "array",
          items: { type: "string" },
          description: "Business websites (max 2)",
        },
        vertical: {
          type: "string",
          description: "Business category/vertical",
        },
      },
    },
  },
  {
    name: "get_messages",
    description: "Get recent messages for a contact (from local store).",
    inputSchema: {
      type: "object",
      properties: {
        phoneNumber: {
          type: "string",
          description: "Phone number to get messages for",
        },
        limit: {
          type: "number",
          description: "Maximum messages to return (default: 50)",
        },
      },
      required: ["phoneNumber"],
    },
  },
  {
    name: "create_group",
    description: "Create a WhatsApp group (whatsapp-web.js only).",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Group name",
        },
        participants: {
          type: "array",
          items: { type: "string" },
          description: "Array of phone numbers to add",
        },
      },
      required: ["name", "participants"],
    },
  },
];

// =============================================================================
// API Helper
// =============================================================================

async function callWhatsAppAPI(
  endpoint: string,
  method: string = "GET",
  body?: any
): Promise<any> {
  const url = `${config.apiUrl}/${config.phoneNumberId}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      "Authorization": `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

// =============================================================================
// Tool Implementations
// =============================================================================

async function sendMessage(params: {
  to: string;
  message: string;
  previewUrl?: boolean;
}): Promise<any> {
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to.replace(/\D/g, ""), // Remove non-digits
    type: "text",
    text: {
      preview_url: params.previewUrl || false,
      body: params.message,
    },
  };

  const result = await callWhatsAppAPI("/messages", "POST", body);

  // Store in local message store
  const messages = messageStore.get(params.to) || [];
  messages.push({
    id: result.messages?.[0]?.id,
    from: "self",
    to: params.to,
    type: "text",
    text: params.message,
    timestamp: new Date().toISOString(),
    status: "sent",
  });
  messageStore.set(params.to, messages);

  return {
    messageId: result.messages?.[0]?.id,
    to: params.to,
    status: "sent",
  };
}

async function sendTemplate(params: {
  to: string;
  templateName: string;
  languageCode: string;
  components?: any[];
}): Promise<any> {
  const body: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to.replace(/\D/g, ""),
    type: "template",
    template: {
      name: params.templateName,
      language: {
        code: params.languageCode,
      },
    },
  };

  if (params.components) {
    body.template.components = params.components;
  }

  const result = await callWhatsAppAPI("/messages", "POST", body);

  return {
    messageId: result.messages?.[0]?.id,
    to: params.to,
    template: params.templateName,
    status: "sent",
  };
}

async function sendMedia(params: {
  to: string;
  type: string;
  url: string;
  caption?: string;
  filename?: string;
}): Promise<any> {
  const mediaObject: any = {
    link: params.url,
  };

  if (params.caption && ["image", "video"].includes(params.type)) {
    mediaObject.caption = params.caption;
  }

  if (params.filename && params.type === "document") {
    mediaObject.filename = params.filename;
  }

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to.replace(/\D/g, ""),
    type: params.type,
    [params.type]: mediaObject,
  };

  const result = await callWhatsAppAPI("/messages", "POST", body);

  return {
    messageId: result.messages?.[0]?.id,
    to: params.to,
    type: params.type,
    status: "sent",
  };
}

async function sendLocation(params: {
  to: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}): Promise<any> {
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to.replace(/\D/g, ""),
    type: "location",
    location: {
      latitude: params.latitude,
      longitude: params.longitude,
      name: params.name,
      address: params.address,
    },
  };

  const result = await callWhatsAppAPI("/messages", "POST", body);

  return {
    messageId: result.messages?.[0]?.id,
    to: params.to,
    type: "location",
    status: "sent",
  };
}

async function sendContact(params: {
  to: string;
  contacts: any[];
}): Promise<any> {
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to.replace(/\D/g, ""),
    type: "contacts",
    contacts: params.contacts,
  };

  const result = await callWhatsAppAPI("/messages", "POST", body);

  return {
    messageId: result.messages?.[0]?.id,
    to: params.to,
    type: "contacts",
    contactCount: params.contacts.length,
    status: "sent",
  };
}

async function sendInteractive(params: {
  to: string;
  type: string;
  header?: any;
  body: string;
  footer?: string;
  buttons?: any[];
  sections?: any[];
}): Promise<any> {
  const interactive: any = {
    type: params.type,
    body: { text: params.body },
  };

  if (params.header) {
    interactive.header = params.header;
  }

  if (params.footer) {
    interactive.footer = { text: params.footer };
  }

  if (params.type === "button" && params.buttons) {
    interactive.action = {
      buttons: params.buttons.map((btn, idx) => ({
        type: "reply",
        reply: {
          id: btn.id || `btn_${idx}`,
          title: btn.title,
        },
      })),
    };
  }

  if (params.type === "list" && params.sections) {
    interactive.action = {
      button: "Options",
      sections: params.sections,
    };
  }

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to.replace(/\D/g, ""),
    type: "interactive",
    interactive,
  };

  const result = await callWhatsAppAPI("/messages", "POST", body);

  return {
    messageId: result.messages?.[0]?.id,
    to: params.to,
    type: "interactive",
    interactiveType: params.type,
    status: "sent",
  };
}

async function markRead(params: { messageId: string }): Promise<any> {
  const body = {
    messaging_product: "whatsapp",
    status: "read",
    message_id: params.messageId,
  };

  await callWhatsAppAPI("/messages", "POST", body);

  return {
    messageId: params.messageId,
    marked: "read",
  };
}

async function getMedia(params: { mediaId: string }): Promise<any> {
  // First get the media URL
  const mediaInfo = await callWhatsAppAPI(`/${params.mediaId}`, "GET");

  // Download the media
  const mediaResponse = await fetch(mediaInfo.url, {
    headers: {
      "Authorization": `Bearer ${config.accessToken}`,
    },
  });

  const buffer = await mediaResponse.arrayBuffer();

  return {
    mediaId: params.mediaId,
    mimeType: mediaInfo.mime_type,
    size: mediaInfo.file_size,
    sha256: mediaInfo.sha256,
    url: mediaInfo.url,
    data: Buffer.from(buffer).toString("base64"),
  };
}

async function getProfile(): Promise<any> {
  const result = await callWhatsAppAPI("/whatsapp_business_profile", "GET");
  return result.data?.[0] || {};
}

async function updateProfile(params: {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  websites?: string[];
  vertical?: string;
}): Promise<any> {
  const body: any = {
    messaging_product: "whatsapp",
  };

  if (params.about) body.about = params.about;
  if (params.address) body.address = params.address;
  if (params.description) body.description = params.description;
  if (params.email) body.email = params.email;
  if (params.websites) body.websites = params.websites;
  if (params.vertical) body.vertical = params.vertical;

  await callWhatsAppAPI("/whatsapp_business_profile", "POST", body);

  return {
    updated: true,
    fields: Object.keys(params),
  };
}

async function getMessages(params: {
  phoneNumber: string;
  limit?: number;
}): Promise<any> {
  const messages = messageStore.get(params.phoneNumber) || [];
  const limit = params.limit || 50;

  return {
    phoneNumber: params.phoneNumber,
    messages: messages.slice(-limit),
    count: Math.min(messages.length, limit),
    total: messages.length,
  };
}

async function createGroup(params: {
  name: string;
  participants: string[];
}): Promise<any> {
  if (!config.useWebClient) {
    throw new Error("Group creation requires whatsapp-web.js client mode");
  }

  // This would use whatsapp-web.js client
  // For now, return a placeholder
  return {
    error: "whatsapp-web.js client not initialized",
    hint: "Set WHATSAPP_USE_WEB_CLIENT=true and restart",
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "whatsapp-mcp",
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
      case "send_message":
        result = await sendMessage(args as any);
        break;
      case "send_template":
        result = await sendTemplate(args as any);
        break;
      case "send_media":
        result = await sendMedia(args as any);
        break;
      case "send_location":
        result = await sendLocation(args as any);
        break;
      case "send_contact":
        result = await sendContact(args as any);
        break;
      case "send_interactive":
        result = await sendInteractive(args as any);
        break;
      case "mark_read":
        result = await markRead(args as any);
        break;
      case "get_media":
        result = await getMedia(args as any);
        break;
      case "get_profile":
        result = await getProfile();
        break;
      case "update_profile":
        result = await updateProfile(args as any);
        break;
      case "get_messages":
        result = await getMessages(args as any);
        break;
      case "create_group":
        result = await createGroup(args as any);
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("WhatsApp MCP Server running on stdio");
  console.error(`API Mode: ${config.useWebClient ? "whatsapp-web.js" : "Business API"}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
