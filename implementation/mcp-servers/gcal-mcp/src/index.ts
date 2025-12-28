/**
 * Google Calendar MCP Server
 *
 * Provides calendar operations for KOSMOS agents.
 * Features:
 * - List and search calendar events
 * - Create, update, and delete events
 * - Manage multiple calendars
 * - Check free/busy times
 * - Handle recurring events
 *
 * Authentication: Uses OAuth2 or Service Account credentials.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { google, calendar_v3 } from "googleapis";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN || "",
  serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "",
  defaultCalendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
};

// =============================================================================
// Google Calendar Client
// =============================================================================

let calendar: calendar_v3.Calendar;

async function initializeClient(): Promise<void> {
  let auth;

  if (config.serviceAccountKey) {
    // Service Account authentication
    const credentials = JSON.parse(config.serviceAccountKey);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
  } else if (config.clientId && config.clientSecret && config.refreshToken) {
    // OAuth2 authentication
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret
    );
    oauth2Client.setCredentials({
      refresh_token: config.refreshToken,
    });
    auth = oauth2Client;
  } else {
    throw new Error(
      "No valid credentials. Set either GOOGLE_SERVICE_ACCOUNT_KEY or " +
      "GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN"
    );
  }

  calendar = google.calendar({ version: "v3", auth });
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  {
    name: "list_calendars",
    description: "List all calendars accessible to the authenticated user.",
    inputSchema: {
      type: "object",
      properties: {
        showHidden: {
          type: "boolean",
          description: "Include hidden calendars",
        },
        showDeleted: {
          type: "boolean",
          description: "Include deleted calendars",
        },
      },
    },
  },
  {
    name: "list_events",
    description: "List events from a calendar within a time range.",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: {
          type: "string",
          description: "Calendar ID (default: primary)",
        },
        timeMin: {
          type: "string",
          description: "Start of time range (ISO 8601 format)",
        },
        timeMax: {
          type: "string",
          description: "End of time range (ISO 8601 format)",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of events to return (default: 50)",
        },
        query: {
          type: "string",
          description: "Free text search query",
        },
        singleEvents: {
          type: "boolean",
          description: "Expand recurring events into instances (default: true)",
        },
        orderBy: {
          type: "string",
          enum: ["startTime", "updated"],
          description: "Order of events (default: startTime)",
        },
      },
    },
  },
  {
    name: "get_event",
    description: "Get details of a specific calendar event.",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: {
          type: "string",
          description: "Calendar ID (default: primary)",
        },
        eventId: {
          type: "string",
          description: "Event ID",
        },
      },
      required: ["eventId"],
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
        summary: {
          type: "string",
          description: "Event title",
        },
        description: {
          type: "string",
          description: "Event description",
        },
        location: {
          type: "string",
          description: "Event location",
        },
        start: {
          type: "string",
          description: "Start time (ISO 8601 format)",
        },
        end: {
          type: "string",
          description: "End time (ISO 8601 format)",
        },
        allDay: {
          type: "boolean",
          description: "Is this an all-day event?",
        },
        attendees: {
          type: "array",
          items: { type: "string" },
          description: "List of attendee email addresses",
        },
        recurrence: {
          type: "array",
          items: { type: "string" },
          description: "RRULE for recurring events (e.g., 'RRULE:FREQ=WEEKLY;COUNT=5')",
        },
        reminders: {
          type: "object",
          properties: {
            useDefault: { type: "boolean" },
            overrides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  method: { type: "string", enum: ["email", "popup"] },
                  minutes: { type: "number" },
                },
              },
            },
          },
          description: "Reminder settings",
        },
        conferenceData: {
          type: "boolean",
          description: "Create a Google Meet link",
        },
        visibility: {
          type: "string",
          enum: ["default", "public", "private", "confidential"],
          description: "Event visibility",
        },
        colorId: {
          type: "string",
          description: "Color ID (1-11)",
        },
      },
      required: ["summary", "start", "end"],
    },
  },
  {
    name: "update_event",
    description: "Update an existing calendar event.",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: {
          type: "string",
          description: "Calendar ID (default: primary)",
        },
        eventId: {
          type: "string",
          description: "Event ID to update",
        },
        summary: {
          type: "string",
          description: "New event title",
        },
        description: {
          type: "string",
          description: "New event description",
        },
        location: {
          type: "string",
          description: "New event location",
        },
        start: {
          type: "string",
          description: "New start time (ISO 8601)",
        },
        end: {
          type: "string",
          description: "New end time (ISO 8601)",
        },
        attendees: {
          type: "array",
          items: { type: "string" },
          description: "Updated list of attendee emails",
        },
        colorId: {
          type: "string",
          description: "New color ID",
        },
      },
      required: ["eventId"],
    },
  },
  {
    name: "delete_event",
    description: "Delete a calendar event.",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: {
          type: "string",
          description: "Calendar ID (default: primary)",
        },
        eventId: {
          type: "string",
          description: "Event ID to delete",
        },
        sendUpdates: {
          type: "string",
          enum: ["all", "externalOnly", "none"],
          description: "Who should receive cancellation notifications",
        },
      },
      required: ["eventId"],
    },
  },
  {
    name: "quick_add",
    description: "Create an event using natural language (e.g., 'Meeting with John tomorrow at 3pm').",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: {
          type: "string",
          description: "Calendar ID (default: primary)",
        },
        text: {
          type: "string",
          description: "Natural language event description",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "get_freebusy",
    description: "Check free/busy times for one or more calendars.",
    inputSchema: {
      type: "object",
      properties: {
        timeMin: {
          type: "string",
          description: "Start of time range (ISO 8601)",
        },
        timeMax: {
          type: "string",
          description: "End of time range (ISO 8601)",
        },
        calendarIds: {
          type: "array",
          items: { type: "string" },
          description: "Calendar IDs to check (default: primary)",
        },
        groupExpansionMax: {
          type: "number",
          description: "Max number of group members to expand",
        },
      },
      required: ["timeMin", "timeMax"],
    },
  },
  {
    name: "find_available_slots",
    description: "Find available time slots across calendars for scheduling.",
    inputSchema: {
      type: "object",
      properties: {
        timeMin: {
          type: "string",
          description: "Start of search range (ISO 8601)",
        },
        timeMax: {
          type: "string",
          description: "End of search range (ISO 8601)",
        },
        durationMinutes: {
          type: "number",
          description: "Required slot duration in minutes",
        },
        calendarIds: {
          type: "array",
          items: { type: "string" },
          description: "Calendar IDs to check for conflicts",
        },
        workingHoursStart: {
          type: "number",
          description: "Working hours start (0-23, default: 9)",
        },
        workingHoursEnd: {
          type: "number",
          description: "Working hours end (0-23, default: 17)",
        },
        maxSlots: {
          type: "number",
          description: "Maximum slots to return (default: 5)",
        },
      },
      required: ["timeMin", "timeMax", "durationMinutes"],
    },
  },
  {
    name: "respond_to_event",
    description: "Respond to an event invitation (accept, decline, tentative).",
    inputSchema: {
      type: "object",
      properties: {
        calendarId: {
          type: "string",
          description: "Calendar ID (default: primary)",
        },
        eventId: {
          type: "string",
          description: "Event ID",
        },
        response: {
          type: "string",
          enum: ["accepted", "declined", "tentative"],
          description: "Response to the invitation",
        },
      },
      required: ["eventId", "response"],
    },
  },
];

// =============================================================================
// Tool Implementations
// =============================================================================

async function listCalendars(params: {
  showHidden?: boolean;
  showDeleted?: boolean;
}): Promise<any> {
  const response = await calendar.calendarList.list({
    showHidden: params.showHidden,
    showDeleted: params.showDeleted,
  });

  return {
    calendars: response.data.items?.map(cal => ({
      id: cal.id,
      summary: cal.summary,
      description: cal.description,
      primary: cal.primary,
      accessRole: cal.accessRole,
      backgroundColor: cal.backgroundColor,
      foregroundColor: cal.foregroundColor,
      timeZone: cal.timeZone,
    })) || [],
  };
}

async function listEvents(params: {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  query?: string;
  singleEvents?: boolean;
  orderBy?: string;
}): Promise<any> {
  const calendarId = params.calendarId || config.defaultCalendarId;

  const response = await calendar.events.list({
    calendarId,
    timeMin: params.timeMin || new Date().toISOString(),
    timeMax: params.timeMax,
    maxResults: params.maxResults || 50,
    q: params.query,
    singleEvents: params.singleEvents !== false,
    orderBy: (params.orderBy as any) || "startTime",
  });

  return {
    calendarId,
    events: response.data.items?.map(formatEvent) || [],
    nextPageToken: response.data.nextPageToken,
  };
}

async function getEvent(params: {
  calendarId?: string;
  eventId: string;
}): Promise<any> {
  const calendarId = params.calendarId || config.defaultCalendarId;

  const response = await calendar.events.get({
    calendarId,
    eventId: params.eventId,
  });

  return formatEvent(response.data);
}

async function createEvent(params: {
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay?: boolean;
  attendees?: string[];
  recurrence?: string[];
  reminders?: any;
  conferenceData?: boolean;
  visibility?: string;
  colorId?: string;
}): Promise<any> {
  const calendarId = params.calendarId || config.defaultCalendarId;

  const eventData: calendar_v3.Schema$Event = {
    summary: params.summary,
    description: params.description,
    location: params.location,
    visibility: params.visibility as any,
    colorId: params.colorId,
    recurrence: params.recurrence,
    reminders: params.reminders,
  };

  if (params.allDay) {
    eventData.start = { date: params.start.split("T")[0] };
    eventData.end = { date: params.end.split("T")[0] };
  } else {
    eventData.start = { dateTime: params.start };
    eventData.end = { dateTime: params.end };
  }

  if (params.attendees) {
    eventData.attendees = params.attendees.map(email => ({ email }));
  }

  const requestParams: calendar_v3.Params$Resource$Events$Insert = {
    calendarId,
    requestBody: eventData,
  };

  if (params.conferenceData) {
    requestParams.conferenceDataVersion = 1;
    eventData.conferenceData = {
      createRequest: {
        requestId: `kosmos-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const response = await calendar.events.insert(requestParams);

  return formatEvent(response.data);
}

async function updateEvent(params: {
  calendarId?: string;
  eventId: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: string;
  end?: string;
  attendees?: string[];
  colorId?: string;
}): Promise<any> {
  const calendarId = params.calendarId || config.defaultCalendarId;

  // Get existing event first
  const existing = await calendar.events.get({
    calendarId,
    eventId: params.eventId,
  });

  const eventData: calendar_v3.Schema$Event = {
    ...existing.data,
    summary: params.summary || existing.data.summary,
    description: params.description ?? existing.data.description,
    location: params.location ?? existing.data.location,
    colorId: params.colorId ?? existing.data.colorId,
  };

  if (params.start) {
    eventData.start = { dateTime: params.start };
  }
  if (params.end) {
    eventData.end = { dateTime: params.end };
  }
  if (params.attendees) {
    eventData.attendees = params.attendees.map(email => ({ email }));
  }

  const response = await calendar.events.update({
    calendarId,
    eventId: params.eventId,
    requestBody: eventData,
  });

  return formatEvent(response.data);
}

async function deleteEvent(params: {
  calendarId?: string;
  eventId: string;
  sendUpdates?: string;
}): Promise<any> {
  const calendarId = params.calendarId || config.defaultCalendarId;

  await calendar.events.delete({
    calendarId,
    eventId: params.eventId,
    sendUpdates: (params.sendUpdates as any) || "all",
  });

  return {
    deleted: true,
    eventId: params.eventId,
    calendarId,
  };
}

async function quickAdd(params: {
  calendarId?: string;
  text: string;
}): Promise<any> {
  const calendarId = params.calendarId || config.defaultCalendarId;

  const response = await calendar.events.quickAdd({
    calendarId,
    text: params.text,
  });

  return formatEvent(response.data);
}

async function getFreeBusy(params: {
  timeMin: string;
  timeMax: string;
  calendarIds?: string[];
  groupExpansionMax?: number;
}): Promise<any> {
  const calendarIds = params.calendarIds || [config.defaultCalendarId];

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      items: calendarIds.map(id => ({ id })),
      groupExpansionMax: params.groupExpansionMax,
    },
  });

  const result: any = {
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    calendars: {},
  };

  for (const [calId, data] of Object.entries(response.data.calendars || {})) {
    result.calendars[calId] = {
      busy: data.busy || [],
      errors: data.errors,
    };
  }

  return result;
}

async function findAvailableSlots(params: {
  timeMin: string;
  timeMax: string;
  durationMinutes: number;
  calendarIds?: string[];
  workingHoursStart?: number;
  workingHoursEnd?: number;
  maxSlots?: number;
}): Promise<any> {
  const calendarIds = params.calendarIds || [config.defaultCalendarId];
  const workStart = params.workingHoursStart ?? 9;
  const workEnd = params.workingHoursEnd ?? 17;
  const maxSlots = params.maxSlots || 5;

  // Get free/busy info
  const freeBusy = await getFreeBusy({
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    calendarIds,
  });

  // Merge all busy times
  const allBusy: { start: Date; end: Date }[] = [];
  for (const calData of Object.values(freeBusy.calendars)) {
    for (const busy of (calData as any).busy || []) {
      allBusy.push({
        start: new Date(busy.start),
        end: new Date(busy.end),
      });
    }
  }

  // Sort busy periods
  allBusy.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Find available slots
  const slots: { start: string; end: string }[] = [];
  const duration = params.durationMinutes * 60 * 1000;
  const rangeStart = new Date(params.timeMin);
  const rangeEnd = new Date(params.timeMax);

  let current = new Date(rangeStart);

  while (current < rangeEnd && slots.length < maxSlots) {
    // Align to working hours
    const hour = current.getHours();
    if (hour < workStart) {
      current.setHours(workStart, 0, 0, 0);
    } else if (hour >= workEnd) {
      current.setDate(current.getDate() + 1);
      current.setHours(workStart, 0, 0, 0);
      continue;
    }

    // Skip weekends
    const day = current.getDay();
    if (day === 0 || day === 6) {
      current.setDate(current.getDate() + 1);
      current.setHours(workStart, 0, 0, 0);
      continue;
    }

    const slotEnd = new Date(current.getTime() + duration);

    // Check if slot is within working hours
    if (slotEnd.getHours() > workEnd ||
        (slotEnd.getHours() === workEnd && slotEnd.getMinutes() > 0)) {
      current.setDate(current.getDate() + 1);
      current.setHours(workStart, 0, 0, 0);
      continue;
    }

    // Check if slot conflicts with any busy time
    const hasConflict = allBusy.some(busy =>
      (current >= busy.start && current < busy.end) ||
      (slotEnd > busy.start && slotEnd <= busy.end) ||
      (current <= busy.start && slotEnd >= busy.end)
    );

    if (!hasConflict) {
      slots.push({
        start: current.toISOString(),
        end: slotEnd.toISOString(),
      });
      current = new Date(slotEnd.getTime());
    } else {
      // Move to end of conflicting busy period
      const conflict = allBusy.find(busy =>
        (current >= busy.start && current < busy.end) ||
        (slotEnd > busy.start && slotEnd <= busy.end)
      );
      if (conflict) {
        current = new Date(conflict.end);
      } else {
        current = new Date(current.getTime() + 15 * 60 * 1000); // 15 min increment
      }
    }
  }

  return {
    durationMinutes: params.durationMinutes,
    workingHours: { start: workStart, end: workEnd },
    availableSlots: slots,
    count: slots.length,
  };
}

async function respondToEvent(params: {
  calendarId?: string;
  eventId: string;
  response: string;
}): Promise<any> {
  const calendarId = params.calendarId || config.defaultCalendarId;

  // Get the event
  const event = await calendar.events.get({
    calendarId,
    eventId: params.eventId,
  });

  // Find self in attendees and update response
  const selfEmail = (await calendar.calendarList.get({ calendarId })).data.id;

  const attendees = event.data.attendees?.map(att => {
    if (att.email === selfEmail || att.self) {
      return { ...att, responseStatus: params.response };
    }
    return att;
  });

  const response = await calendar.events.patch({
    calendarId,
    eventId: params.eventId,
    requestBody: { attendees },
  });

  return formatEvent(response.data);
}

function formatEvent(event: calendar_v3.Schema$Event): any {
  return {
    id: event.id,
    summary: event.summary,
    description: event.description,
    location: event.location,
    status: event.status,
    htmlLink: event.htmlLink,
    created: event.created,
    updated: event.updated,
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    allDay: !event.start?.dateTime,
    creator: event.creator,
    organizer: event.organizer,
    attendees: event.attendees?.map(att => ({
      email: att.email,
      displayName: att.displayName,
      responseStatus: att.responseStatus,
      self: att.self,
      organizer: att.organizer,
    })),
    conferenceData: event.conferenceData ? {
      type: event.conferenceData.conferenceSolution?.name,
      uri: event.conferenceData.entryPoints?.[0]?.uri,
    } : null,
    recurrence: event.recurrence,
    recurringEventId: event.recurringEventId,
    visibility: event.visibility,
    colorId: event.colorId,
    reminders: event.reminders,
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "gcal-mcp",
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
      case "list_calendars":
        result = await listCalendars(args as any);
        break;
      case "list_events":
        result = await listEvents(args as any);
        break;
      case "get_event":
        result = await getEvent(args as any);
        break;
      case "create_event":
        result = await createEvent(args as any);
        break;
      case "update_event":
        result = await updateEvent(args as any);
        break;
      case "delete_event":
        result = await deleteEvent(args as any);
        break;
      case "quick_add":
        result = await quickAdd(args as any);
        break;
      case "get_freebusy":
        result = await getFreeBusy(args as any);
        break;
      case "find_available_slots":
        result = await findAvailableSlots(args as any);
        break;
      case "respond_to_event":
        result = await respondToEvent(args as any);
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
  console.error("Google Calendar MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
