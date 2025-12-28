/**
 * HubSpot MCP Server
 *
 * Provides HubSpot CRM operations for KOSMOS agents.
 * Features:
 * - Contact management (CRUD)
 * - Company management
 * - Deal management
 * - Ticket management
 * - Pipeline operations
 * - Owner management
 * - Engagement creation (notes, emails, calls)
 * - Form management and submissions
 * - CRM search
 *
 * Authentication: Uses HubSpot Access Token (OAuth or Private App).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN || "",
  baseUrl: "https://api.hubapi.com",
};

// =============================================================================
// HTTP Client Helper
// =============================================================================

async function hubspotRequest<T>(
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    params?: Record<string, string | number | undefined>;
  } = {}
): Promise<T> {
  const { method = "GET", body, params } = options;

  let url = `${config.baseUrl}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.accessToken}`,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HubSpot API error (${response.status}): ${errorText}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Contact operations
  {
    name: "list_contacts",
    description: "List contacts with optional filters and pagination.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (1-100, default 10)" },
        after: { type: "string", description: "Pagination cursor" },
        properties: {
          type: "array",
          items: { type: "string" },
          description: "Properties to include (e.g., ['email', 'firstname', 'lastname'])",
        },
      },
    },
  },
  {
    name: "get_contact",
    description: "Get a contact by ID.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "Contact ID" },
        properties: {
          type: "array",
          items: { type: "string" },
          description: "Properties to include",
        },
      },
      required: ["contactId"],
    },
  },
  {
    name: "create_contact",
    description: "Create a new contact.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Contact email (required)" },
        firstname: { type: "string", description: "First name" },
        lastname: { type: "string", description: "Last name" },
        phone: { type: "string", description: "Phone number" },
        company: { type: "string", description: "Company name" },
        website: { type: "string", description: "Website URL" },
        lifecyclestage: {
          type: "string",
          enum: ["subscriber", "lead", "marketingqualifiedlead", "salesqualifiedlead", "opportunity", "customer", "evangelist", "other"],
          description: "Lifecycle stage",
        },
        properties: { type: "object", description: "Additional custom properties" },
      },
      required: ["email"],
    },
  },
  {
    name: "update_contact",
    description: "Update an existing contact.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "Contact ID" },
        email: { type: "string", description: "Email" },
        firstname: { type: "string", description: "First name" },
        lastname: { type: "string", description: "Last name" },
        phone: { type: "string", description: "Phone number" },
        company: { type: "string", description: "Company name" },
        lifecyclestage: { type: "string", description: "Lifecycle stage" },
        properties: { type: "object", description: "Additional custom properties" },
      },
      required: ["contactId"],
    },
  },
  {
    name: "delete_contact",
    description: "Delete a contact by ID.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "Contact ID" },
      },
      required: ["contactId"],
    },
  },
  // Company operations
  {
    name: "list_companies",
    description: "List companies with optional filters and pagination.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (1-100, default 10)" },
        after: { type: "string", description: "Pagination cursor" },
        properties: {
          type: "array",
          items: { type: "string" },
          description: "Properties to include (e.g., ['name', 'domain', 'industry'])",
        },
      },
    },
  },
  {
    name: "get_company",
    description: "Get a company by ID.",
    inputSchema: {
      type: "object",
      properties: {
        companyId: { type: "string", description: "Company ID" },
        properties: {
          type: "array",
          items: { type: "string" },
          description: "Properties to include",
        },
      },
      required: ["companyId"],
    },
  },
  {
    name: "create_company",
    description: "Create a new company.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Company name (required)" },
        domain: { type: "string", description: "Company domain" },
        industry: { type: "string", description: "Industry" },
        phone: { type: "string", description: "Phone number" },
        city: { type: "string", description: "City" },
        state: { type: "string", description: "State/Region" },
        country: { type: "string", description: "Country" },
        description: { type: "string", description: "Company description" },
        properties: { type: "object", description: "Additional custom properties" },
      },
      required: ["name"],
    },
  },
  // Deal operations
  {
    name: "list_deals",
    description: "List deals with optional filters and pagination.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (1-100, default 10)" },
        after: { type: "string", description: "Pagination cursor" },
        properties: {
          type: "array",
          items: { type: "string" },
          description: "Properties to include (e.g., ['dealname', 'amount', 'dealstage'])",
        },
      },
    },
  },
  {
    name: "get_deal",
    description: "Get a deal by ID.",
    inputSchema: {
      type: "object",
      properties: {
        dealId: { type: "string", description: "Deal ID" },
        properties: {
          type: "array",
          items: { type: "string" },
          description: "Properties to include",
        },
      },
      required: ["dealId"],
    },
  },
  {
    name: "create_deal",
    description: "Create a new deal.",
    inputSchema: {
      type: "object",
      properties: {
        dealname: { type: "string", description: "Deal name (required)" },
        amount: { type: "number", description: "Deal amount" },
        dealstage: { type: "string", description: "Deal stage ID" },
        pipeline: { type: "string", description: "Pipeline ID" },
        closedate: { type: "string", description: "Expected close date (ISO 8601)" },
        hubspot_owner_id: { type: "string", description: "Owner ID" },
        properties: { type: "object", description: "Additional custom properties" },
      },
      required: ["dealname"],
    },
  },
  {
    name: "update_deal",
    description: "Update an existing deal.",
    inputSchema: {
      type: "object",
      properties: {
        dealId: { type: "string", description: "Deal ID" },
        dealname: { type: "string", description: "Deal name" },
        amount: { type: "number", description: "Deal amount" },
        dealstage: { type: "string", description: "Deal stage ID" },
        closedate: { type: "string", description: "Expected close date (ISO 8601)" },
        hubspot_owner_id: { type: "string", description: "Owner ID" },
        properties: { type: "object", description: "Additional custom properties" },
      },
      required: ["dealId"],
    },
  },
  // Ticket operations
  {
    name: "list_tickets",
    description: "List tickets with optional filters and pagination.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (1-100, default 10)" },
        after: { type: "string", description: "Pagination cursor" },
        properties: {
          type: "array",
          items: { type: "string" },
          description: "Properties to include (e.g., ['subject', 'hs_pipeline_stage', 'hs_ticket_priority'])",
        },
      },
    },
  },
  {
    name: "create_ticket",
    description: "Create a new ticket.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Ticket subject (required)" },
        content: { type: "string", description: "Ticket content/description" },
        hs_pipeline: { type: "string", description: "Pipeline ID" },
        hs_pipeline_stage: { type: "string", description: "Pipeline stage ID" },
        hs_ticket_priority: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH"],
          description: "Ticket priority",
        },
        hubspot_owner_id: { type: "string", description: "Owner ID" },
        properties: { type: "object", description: "Additional custom properties" },
      },
      required: ["subject"],
    },
  },
  // Search operation
  {
    name: "search_crm",
    description: "Search CRM objects (contacts, companies, deals, tickets).",
    inputSchema: {
      type: "object",
      properties: {
        objectType: {
          type: "string",
          enum: ["contacts", "companies", "deals", "tickets"],
          description: "Object type to search",
        },
        query: { type: "string", description: "Search query string" },
        filterGroups: {
          type: "array",
          description: "Filter groups for advanced filtering",
          items: {
            type: "object",
            properties: {
              filters: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    propertyName: { type: "string" },
                    operator: {
                      type: "string",
                      enum: ["EQ", "NEQ", "LT", "LTE", "GT", "GTE", "CONTAINS_TOKEN", "NOT_CONTAINS_TOKEN"],
                    },
                    value: { type: "string" },
                  },
                },
              },
            },
          },
        },
        properties: {
          type: "array",
          items: { type: "string" },
          description: "Properties to include in results",
        },
        limit: { type: "number", description: "Max results (1-100, default 10)" },
        after: { type: "string", description: "Pagination cursor" },
      },
      required: ["objectType"],
    },
  },
  // Pipeline operations
  {
    name: "list_pipelines",
    description: "List pipelines for a given object type.",
    inputSchema: {
      type: "object",
      properties: {
        objectType: {
          type: "string",
          enum: ["deals", "tickets"],
          description: "Object type (deals or tickets)",
        },
      },
      required: ["objectType"],
    },
  },
  {
    name: "get_pipeline",
    description: "Get pipeline details including stages.",
    inputSchema: {
      type: "object",
      properties: {
        objectType: {
          type: "string",
          enum: ["deals", "tickets"],
          description: "Object type (deals or tickets)",
        },
        pipelineId: { type: "string", description: "Pipeline ID" },
      },
      required: ["objectType", "pipelineId"],
    },
  },
  // Owner operations
  {
    name: "list_owners",
    description: "List all owners in the HubSpot account.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Filter by email" },
        limit: { type: "number", description: "Max results (default 100)" },
        after: { type: "string", description: "Pagination cursor" },
      },
    },
  },
  // Engagement operations
  {
    name: "create_engagement",
    description: "Create an engagement (note, email, call, meeting, task).",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["NOTE", "EMAIL", "CALL", "MEETING", "TASK"],
          description: "Engagement type",
        },
        contactIds: {
          type: "array",
          items: { type: "string" },
          description: "Associated contact IDs",
        },
        companyIds: {
          type: "array",
          items: { type: "string" },
          description: "Associated company IDs",
        },
        dealIds: {
          type: "array",
          items: { type: "string" },
          description: "Associated deal IDs",
        },
        ticketIds: {
          type: "array",
          items: { type: "string" },
          description: "Associated ticket IDs",
        },
        ownerId: { type: "string", description: "Owner ID" },
        timestamp: { type: "string", description: "Timestamp (ISO 8601, defaults to now)" },
        // Note specific
        body: { type: "string", description: "Note body (for NOTE type)" },
        // Email specific
        subject: { type: "string", description: "Email subject (for EMAIL type)" },
        html: { type: "string", description: "Email HTML body (for EMAIL type)" },
        text: { type: "string", description: "Email text body (for EMAIL type)" },
        from: { type: "string", description: "From email address" },
        to: { type: "string", description: "To email address" },
        // Call specific
        toNumber: { type: "string", description: "To phone number (for CALL type)" },
        fromNumber: { type: "string", description: "From phone number (for CALL type)" },
        durationMilliseconds: { type: "number", description: "Call duration in ms (for CALL type)" },
        status: {
          type: "string",
          enum: ["COMPLETED", "BUSY", "NO_ANSWER", "FAILED", "CONNECTING", "CALLING_CRM_USER", "IN_PROGRESS"],
          description: "Call status",
        },
        recordingUrl: { type: "string", description: "Recording URL (for CALL type)" },
      },
      required: ["type"],
    },
  },
  // Form operations
  {
    name: "list_forms",
    description: "List all forms in the HubSpot account.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (default 50)" },
        after: { type: "string", description: "Pagination cursor" },
        formTypes: {
          type: "array",
          items: { type: "string" },
          description: "Filter by form types",
        },
      },
    },
  },
  {
    name: "get_form_submissions",
    description: "Get submissions for a specific form.",
    inputSchema: {
      type: "object",
      properties: {
        formId: { type: "string", description: "Form ID (GUID)" },
        limit: { type: "number", description: "Max results (default 50)" },
        after: { type: "string", description: "Pagination cursor" },
      },
      required: ["formId"],
    },
  },
];

// =============================================================================
// Tool Implementations
// =============================================================================

// Contact operations
async function listContacts(params: {
  limit?: number;
  after?: string;
  properties?: string[];
}): Promise<any> {
  const queryParams: Record<string, string | number | undefined> = {
    limit: params.limit || 10,
    after: params.after,
  };

  if (params.properties && params.properties.length > 0) {
    queryParams.properties = params.properties.join(",");
  }

  const response = await hubspotRequest<any>("/crm/v3/objects/contacts", {
    params: queryParams,
  });

  return {
    contacts: response.results.map((c: any) => ({
      id: c.id,
      properties: c.properties,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    paging: response.paging,
  };
}

async function getContact(params: {
  contactId: string;
  properties?: string[];
}): Promise<any> {
  const queryParams: Record<string, string | number | undefined> = {};

  if (params.properties && params.properties.length > 0) {
    queryParams.properties = params.properties.join(",");
  }

  const response = await hubspotRequest<any>(
    `/crm/v3/objects/contacts/${params.contactId}`,
    { params: queryParams }
  );

  return {
    id: response.id,
    properties: response.properties,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
}

async function createContact(params: {
  email: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  company?: string;
  website?: string;
  lifecyclestage?: string;
  properties?: Record<string, string>;
}): Promise<any> {
  const { properties: customProps, ...standardProps } = params;
  const allProperties = { ...standardProps, ...customProps };

  const response = await hubspotRequest<any>("/crm/v3/objects/contacts", {
    method: "POST",
    body: { properties: allProperties },
  });

  return {
    id: response.id,
    properties: response.properties,
    createdAt: response.createdAt,
    created: true,
  };
}

async function updateContact(params: {
  contactId: string;
  email?: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  company?: string;
  lifecyclestage?: string;
  properties?: Record<string, string>;
}): Promise<any> {
  const { contactId, properties: customProps, ...standardProps } = params;

  // Remove undefined values
  const cleanProps = Object.fromEntries(
    Object.entries(standardProps).filter(([_, v]) => v !== undefined)
  );
  const allProperties = { ...cleanProps, ...customProps };

  const response = await hubspotRequest<any>(
    `/crm/v3/objects/contacts/${contactId}`,
    {
      method: "PATCH",
      body: { properties: allProperties },
    }
  );

  return {
    id: response.id,
    properties: response.properties,
    updatedAt: response.updatedAt,
    updated: true,
  };
}

async function deleteContact(params: { contactId: string }): Promise<any> {
  await hubspotRequest<any>(`/crm/v3/objects/contacts/${params.contactId}`, {
    method: "DELETE",
  });

  return { id: params.contactId, deleted: true };
}

// Company operations
async function listCompanies(params: {
  limit?: number;
  after?: string;
  properties?: string[];
}): Promise<any> {
  const queryParams: Record<string, string | number | undefined> = {
    limit: params.limit || 10,
    after: params.after,
  };

  if (params.properties && params.properties.length > 0) {
    queryParams.properties = params.properties.join(",");
  }

  const response = await hubspotRequest<any>("/crm/v3/objects/companies", {
    params: queryParams,
  });

  return {
    companies: response.results.map((c: any) => ({
      id: c.id,
      properties: c.properties,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    paging: response.paging,
  };
}

async function getCompany(params: {
  companyId: string;
  properties?: string[];
}): Promise<any> {
  const queryParams: Record<string, string | number | undefined> = {};

  if (params.properties && params.properties.length > 0) {
    queryParams.properties = params.properties.join(",");
  }

  const response = await hubspotRequest<any>(
    `/crm/v3/objects/companies/${params.companyId}`,
    { params: queryParams }
  );

  return {
    id: response.id,
    properties: response.properties,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
}

async function createCompany(params: {
  name: string;
  domain?: string;
  industry?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  description?: string;
  properties?: Record<string, string>;
}): Promise<any> {
  const { properties: customProps, ...standardProps } = params;
  const allProperties = { ...standardProps, ...customProps };

  const response = await hubspotRequest<any>("/crm/v3/objects/companies", {
    method: "POST",
    body: { properties: allProperties },
  });

  return {
    id: response.id,
    properties: response.properties,
    createdAt: response.createdAt,
    created: true,
  };
}

// Deal operations
async function listDeals(params: {
  limit?: number;
  after?: string;
  properties?: string[];
}): Promise<any> {
  const queryParams: Record<string, string | number | undefined> = {
    limit: params.limit || 10,
    after: params.after,
  };

  if (params.properties && params.properties.length > 0) {
    queryParams.properties = params.properties.join(",");
  }

  const response = await hubspotRequest<any>("/crm/v3/objects/deals", {
    params: queryParams,
  });

  return {
    deals: response.results.map((d: any) => ({
      id: d.id,
      properties: d.properties,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
    paging: response.paging,
  };
}

async function getDeal(params: {
  dealId: string;
  properties?: string[];
}): Promise<any> {
  const queryParams: Record<string, string | number | undefined> = {};

  if (params.properties && params.properties.length > 0) {
    queryParams.properties = params.properties.join(",");
  }

  const response = await hubspotRequest<any>(
    `/crm/v3/objects/deals/${params.dealId}`,
    { params: queryParams }
  );

  return {
    id: response.id,
    properties: response.properties,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
}

async function createDeal(params: {
  dealname: string;
  amount?: number;
  dealstage?: string;
  pipeline?: string;
  closedate?: string;
  hubspot_owner_id?: string;
  properties?: Record<string, string>;
}): Promise<any> {
  const { properties: customProps, ...standardProps } = params;

  // Convert amount to string as HubSpot expects
  const processedProps: Record<string, any> = { ...standardProps };
  if (processedProps.amount !== undefined) {
    processedProps.amount = String(processedProps.amount);
  }

  const allProperties = { ...processedProps, ...customProps };

  const response = await hubspotRequest<any>("/crm/v3/objects/deals", {
    method: "POST",
    body: { properties: allProperties },
  });

  return {
    id: response.id,
    properties: response.properties,
    createdAt: response.createdAt,
    created: true,
  };
}

async function updateDeal(params: {
  dealId: string;
  dealname?: string;
  amount?: number;
  dealstage?: string;
  closedate?: string;
  hubspot_owner_id?: string;
  properties?: Record<string, string>;
}): Promise<any> {
  const { dealId, properties: customProps, ...standardProps } = params;

  // Remove undefined values and convert amount
  const cleanProps = Object.fromEntries(
    Object.entries(standardProps).filter(([_, v]) => v !== undefined)
  );
  if (cleanProps.amount !== undefined) {
    cleanProps.amount = String(cleanProps.amount);
  }

  const allProperties = { ...cleanProps, ...customProps };

  const response = await hubspotRequest<any>(`/crm/v3/objects/deals/${dealId}`, {
    method: "PATCH",
    body: { properties: allProperties },
  });

  return {
    id: response.id,
    properties: response.properties,
    updatedAt: response.updatedAt,
    updated: true,
  };
}

// Ticket operations
async function listTickets(params: {
  limit?: number;
  after?: string;
  properties?: string[];
}): Promise<any> {
  const queryParams: Record<string, string | number | undefined> = {
    limit: params.limit || 10,
    after: params.after,
  };

  if (params.properties && params.properties.length > 0) {
    queryParams.properties = params.properties.join(",");
  }

  const response = await hubspotRequest<any>("/crm/v3/objects/tickets", {
    params: queryParams,
  });

  return {
    tickets: response.results.map((t: any) => ({
      id: t.id,
      properties: t.properties,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
    paging: response.paging,
  };
}

async function createTicket(params: {
  subject: string;
  content?: string;
  hs_pipeline?: string;
  hs_pipeline_stage?: string;
  hs_ticket_priority?: string;
  hubspot_owner_id?: string;
  properties?: Record<string, string>;
}): Promise<any> {
  const { properties: customProps, ...standardProps } = params;
  const allProperties = { ...standardProps, ...customProps };

  const response = await hubspotRequest<any>("/crm/v3/objects/tickets", {
    method: "POST",
    body: { properties: allProperties },
  });

  return {
    id: response.id,
    properties: response.properties,
    createdAt: response.createdAt,
    created: true,
  };
}

// Search operation
async function searchCRM(params: {
  objectType: string;
  query?: string;
  filterGroups?: any[];
  properties?: string[];
  limit?: number;
  after?: string;
}): Promise<any> {
  const body: any = {
    limit: params.limit || 10,
  };

  if (params.query) {
    body.query = params.query;
  }

  if (params.filterGroups && params.filterGroups.length > 0) {
    body.filterGroups = params.filterGroups;
  }

  if (params.properties && params.properties.length > 0) {
    body.properties = params.properties;
  }

  if (params.after) {
    body.after = params.after;
  }

  const response = await hubspotRequest<any>(
    `/crm/v3/objects/${params.objectType}/search`,
    { method: "POST", body }
  );

  return {
    total: response.total,
    results: response.results.map((r: any) => ({
      id: r.id,
      properties: r.properties,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    paging: response.paging,
  };
}

// Pipeline operations
async function listPipelines(params: { objectType: string }): Promise<any> {
  const response = await hubspotRequest<any>(
    `/crm/v3/pipelines/${params.objectType}`
  );

  return {
    pipelines: response.results.map((p: any) => ({
      id: p.id,
      label: p.label,
      displayOrder: p.displayOrder,
      stages: p.stages.map((s: any) => ({
        id: s.id,
        label: s.label,
        displayOrder: s.displayOrder,
        metadata: s.metadata,
      })),
    })),
  };
}

async function getPipeline(params: {
  objectType: string;
  pipelineId: string;
}): Promise<any> {
  const response = await hubspotRequest<any>(
    `/crm/v3/pipelines/${params.objectType}/${params.pipelineId}`
  );

  return {
    id: response.id,
    label: response.label,
    displayOrder: response.displayOrder,
    stages: response.stages.map((s: any) => ({
      id: s.id,
      label: s.label,
      displayOrder: s.displayOrder,
      metadata: s.metadata,
    })),
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
}

// Owner operations
async function listOwners(params: {
  email?: string;
  limit?: number;
  after?: string;
}): Promise<any> {
  const queryParams: Record<string, string | number | undefined> = {
    limit: params.limit || 100,
    after: params.after,
    email: params.email,
  };

  const response = await hubspotRequest<any>("/crm/v3/owners", {
    params: queryParams,
  });

  return {
    owners: response.results.map((o: any) => ({
      id: o.id,
      email: o.email,
      firstName: o.firstName,
      lastName: o.lastName,
      userId: o.userId,
      teams: o.teams,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    })),
    paging: response.paging,
  };
}

// Engagement operations
async function createEngagement(params: {
  type: string;
  contactIds?: string[];
  companyIds?: string[];
  dealIds?: string[];
  ticketIds?: string[];
  ownerId?: string;
  timestamp?: string;
  // Note
  body?: string;
  // Email
  subject?: string;
  html?: string;
  text?: string;
  from?: string;
  to?: string;
  // Call
  toNumber?: string;
  fromNumber?: string;
  durationMilliseconds?: number;
  status?: string;
  recordingUrl?: string;
}): Promise<any> {
  const engagement: any = {
    type: params.type,
    timestamp: params.timestamp
      ? new Date(params.timestamp).getTime()
      : Date.now(),
  };

  if (params.ownerId) {
    engagement.ownerId = params.ownerId;
  }

  // Build associations
  const associations: any = {};
  if (params.contactIds && params.contactIds.length > 0) {
    associations.contactIds = params.contactIds;
  }
  if (params.companyIds && params.companyIds.length > 0) {
    associations.companyIds = params.companyIds;
  }
  if (params.dealIds && params.dealIds.length > 0) {
    associations.dealIds = params.dealIds;
  }
  if (params.ticketIds && params.ticketIds.length > 0) {
    associations.ticketIds = params.ticketIds;
  }

  // Build metadata based on type
  let metadata: any = {};

  switch (params.type) {
    case "NOTE":
      metadata = {
        body: params.body || "",
      };
      break;
    case "EMAIL":
      metadata = {
        subject: params.subject || "",
        html: params.html,
        text: params.text,
        from: params.from ? { email: params.from } : undefined,
        to: params.to ? [{ email: params.to }] : undefined,
      };
      break;
    case "CALL":
      metadata = {
        toNumber: params.toNumber,
        fromNumber: params.fromNumber,
        durationMilliseconds: params.durationMilliseconds,
        status: params.status || "COMPLETED",
        recordingUrl: params.recordingUrl,
      };
      break;
    case "MEETING":
      metadata = {
        body: params.body || "",
        startTime: engagement.timestamp,
        endTime: engagement.timestamp,
      };
      break;
    case "TASK":
      metadata = {
        body: params.body || "",
        subject: params.subject || "",
        status: "NOT_STARTED",
      };
      break;
  }

  const response = await hubspotRequest<any>("/engagements/v1/engagements", {
    method: "POST",
    body: {
      engagement,
      associations,
      metadata,
    },
  });

  return {
    id: response.engagement.id,
    type: response.engagement.type,
    createdAt: new Date(response.engagement.createdAt).toISOString(),
    associations: response.associations,
    created: true,
  };
}

// Form operations
async function listForms(params: {
  limit?: number;
  after?: string;
  formTypes?: string[];
}): Promise<any> {
  const queryParams: Record<string, string | number | undefined> = {
    limit: params.limit || 50,
    after: params.after,
  };

  if (params.formTypes && params.formTypes.length > 0) {
    queryParams.formTypes = params.formTypes.join(",");
  }

  const response = await hubspotRequest<any>("/marketing/v3/forms", {
    params: queryParams,
  });

  return {
    forms: response.results.map((f: any) => ({
      id: f.id,
      name: f.name,
      formType: f.formType,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      archived: f.archived,
      fieldGroups: f.fieldGroups,
    })),
    paging: response.paging,
  };
}

async function getFormSubmissions(params: {
  formId: string;
  limit?: number;
  after?: string;
}): Promise<any> {
  const queryParams: Record<string, string | number | undefined> = {
    limit: params.limit || 50,
    after: params.after,
  };

  const response = await hubspotRequest<any>(
    `/form-integrations/v1/submissions/forms/${params.formId}`,
    { params: queryParams }
  );

  return {
    submissions: response.results.map((s: any) => ({
      submittedAt: s.submittedAt,
      values: s.values,
      pageUrl: s.pageUrl,
    })),
    paging: response.paging,
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  { name: "hubspot-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // Contact operations
      case "list_contacts":
        result = await listContacts(args as any);
        break;
      case "get_contact":
        result = await getContact(args as any);
        break;
      case "create_contact":
        result = await createContact(args as any);
        break;
      case "update_contact":
        result = await updateContact(args as any);
        break;
      case "delete_contact":
        result = await deleteContact(args as any);
        break;

      // Company operations
      case "list_companies":
        result = await listCompanies(args as any);
        break;
      case "get_company":
        result = await getCompany(args as any);
        break;
      case "create_company":
        result = await createCompany(args as any);
        break;

      // Deal operations
      case "list_deals":
        result = await listDeals(args as any);
        break;
      case "get_deal":
        result = await getDeal(args as any);
        break;
      case "create_deal":
        result = await createDeal(args as any);
        break;
      case "update_deal":
        result = await updateDeal(args as any);
        break;

      // Ticket operations
      case "list_tickets":
        result = await listTickets(args as any);
        break;
      case "create_ticket":
        result = await createTicket(args as any);
        break;

      // Search
      case "search_crm":
        result = await searchCRM(args as any);
        break;

      // Pipeline operations
      case "list_pipelines":
        result = await listPipelines(args as any);
        break;
      case "get_pipeline":
        result = await getPipeline(args as any);
        break;

      // Owner operations
      case "list_owners":
        result = await listOwners(args as any);
        break;

      // Engagement operations
      case "create_engagement":
        result = await createEngagement(args as any);
        break;

      // Form operations
      case "list_forms":
        result = await listForms(args as any);
        break;
      case "get_form_submissions":
        result = await getFormSubmissions(args as any);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: any) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: error.message }) }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("HubSpot MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
