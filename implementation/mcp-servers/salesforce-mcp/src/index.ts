/**
 * Salesforce MCP Server - CRM and sales automation for KOSMOS agents
 *
 * Provides comprehensive Salesforce integration including:
 * - SOQL queries and SOSL searches
 * - Record CRUD operations
 * - Object metadata and schema
 * - Account, Contact, Opportunity, Lead, Case management
 * - Report execution
 * - API limits monitoring
 *
 * Authentication: Uses OAuth2 with username/password flow.
 * Environment variables: SF_CLIENT_ID, SF_CLIENT_SECRET, SF_USERNAME, SF_PASSWORD, SF_INSTANCE_URL
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
  clientId: process.env.SF_CLIENT_ID || "",
  clientSecret: process.env.SF_CLIENT_SECRET || "",
  username: process.env.SF_USERNAME || "",
  password: process.env.SF_PASSWORD || "",
  instanceUrl: process.env.SF_INSTANCE_URL || "https://login.salesforce.com",
  apiVersion: process.env.SF_API_VERSION || "v59.0",
};

// Token management
let accessToken: string = "";
let instanceUrl: string = "";
let tokenExpiry: number = 0;

// =============================================================================
// OAuth2 Token Management
// =============================================================================

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 minute buffer)
  if (accessToken && instanceUrl && Date.now() < tokenExpiry - 300000) {
    return accessToken;
  }

  const tokenUrl = `${config.instanceUrl}/services/oauth2/token`;

  const params = new URLSearchParams({
    grant_type: "password",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    username: config.username,
    password: config.password,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to authenticate with Salesforce: ${error}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  instanceUrl = data.instance_url;
  // Salesforce tokens typically last 2 hours
  tokenExpiry = Date.now() + 7200000;

  return accessToken;
}

// =============================================================================
// Salesforce API Request Helper
// =============================================================================

async function sfRequest(
  method: string,
  endpoint: string,
  body?: any
): Promise<any> {
  const token = await getAccessToken();

  const url = `${instanceUrl}/services/data/${config.apiVersion}${endpoint}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  // Handle 204 No Content
  if (response.status === 204) {
    return { success: true };
  }

  const responseText = await response.text();

  if (!response.ok) {
    let errorMessage = responseText;
    try {
      const errorJson = JSON.parse(responseText);
      if (Array.isArray(errorJson)) {
        errorMessage = errorJson.map((e: any) => e.message || e.errorCode).join(", ");
      } else if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      // Keep original text
    }
    throw new Error(`Salesforce API error (${response.status}): ${errorMessage}`);
  }

  return responseText ? JSON.parse(responseText) : { success: true };
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Query and Search
  {
    name: "query",
    description: "Execute a SOQL query to retrieve Salesforce records.",
    inputSchema: {
      type: "object",
      properties: {
        soql: {
          type: "string",
          description: "The SOQL query to execute (e.g., 'SELECT Id, Name FROM Account LIMIT 10')",
        },
      },
      required: ["soql"],
    },
  },
  {
    name: "search",
    description: "Execute a SOSL search across multiple objects.",
    inputSchema: {
      type: "object",
      properties: {
        sosl: {
          type: "string",
          description: "The SOSL search query (e.g., 'FIND {Acme} IN ALL FIELDS RETURNING Account(Id, Name), Contact(Id, Name)')",
        },
      },
      required: ["sosl"],
    },
  },
  // Generic Record Operations
  {
    name: "get_record",
    description: "Get a single record by ID.",
    inputSchema: {
      type: "object",
      properties: {
        objectType: {
          type: "string",
          description: "The Salesforce object type (e.g., Account, Contact, Opportunity)",
        },
        recordId: {
          type: "string",
          description: "The 15 or 18 character Salesforce record ID",
        },
        fields: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of fields to retrieve (returns all accessible fields if not specified)",
        },
      },
      required: ["objectType", "recordId"],
    },
  },
  {
    name: "create_record",
    description: "Create a new record in Salesforce.",
    inputSchema: {
      type: "object",
      properties: {
        objectType: {
          type: "string",
          description: "The Salesforce object type (e.g., Account, Contact, Opportunity)",
        },
        data: {
          type: "object",
          description: "The field values for the new record",
        },
      },
      required: ["objectType", "data"],
    },
  },
  {
    name: "update_record",
    description: "Update an existing record in Salesforce.",
    inputSchema: {
      type: "object",
      properties: {
        objectType: {
          type: "string",
          description: "The Salesforce object type",
        },
        recordId: {
          type: "string",
          description: "The record ID to update",
        },
        data: {
          type: "object",
          description: "The field values to update",
        },
      },
      required: ["objectType", "recordId", "data"],
    },
  },
  {
    name: "delete_record",
    description: "Delete a record from Salesforce.",
    inputSchema: {
      type: "object",
      properties: {
        objectType: {
          type: "string",
          description: "The Salesforce object type",
        },
        recordId: {
          type: "string",
          description: "The record ID to delete",
        },
      },
      required: ["objectType", "recordId"],
    },
  },
  // Metadata
  {
    name: "describe_object",
    description: "Get metadata about a Salesforce object including fields, relationships, and picklist values.",
    inputSchema: {
      type: "object",
      properties: {
        objectType: {
          type: "string",
          description: "The Salesforce object type to describe",
        },
      },
      required: ["objectType"],
    },
  },
  {
    name: "list_objects",
    description: "List all available Salesforce objects in the org.",
    inputSchema: {
      type: "object",
      properties: {
        includeCustom: {
          type: "boolean",
          description: "Include custom objects (default true)",
        },
        includeStandard: {
          type: "boolean",
          description: "Include standard objects (default true)",
        },
      },
    },
  },
  // Limits
  {
    name: "get_limits",
    description: "Get current API limits and usage for the Salesforce org.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  // Account Operations
  {
    name: "list_accounts",
    description: "List accounts with optional filtering.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of accounts to return (default 100)",
        },
        nameContains: {
          type: "string",
          description: "Filter accounts where name contains this string",
        },
        type: {
          type: "string",
          description: "Filter by account type",
        },
        industry: {
          type: "string",
          description: "Filter by industry",
        },
        fields: {
          type: "array",
          items: { type: "string" },
          description: "Additional fields to include in results",
        },
      },
    },
  },
  {
    name: "get_account",
    description: "Get detailed account information by ID.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: {
          type: "string",
          description: "The Account record ID",
        },
        includeContacts: {
          type: "boolean",
          description: "Include related contacts (default false)",
        },
        includeOpportunities: {
          type: "boolean",
          description: "Include related opportunities (default false)",
        },
      },
      required: ["accountId"],
    },
  },
  // Contact Operations
  {
    name: "list_contacts",
    description: "List contacts with optional filtering.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of contacts to return (default 100)",
        },
        accountId: {
          type: "string",
          description: "Filter by account ID",
        },
        nameContains: {
          type: "string",
          description: "Filter contacts where name contains this string",
        },
        email: {
          type: "string",
          description: "Filter by email address",
        },
        fields: {
          type: "array",
          items: { type: "string" },
          description: "Additional fields to include in results",
        },
      },
    },
  },
  {
    name: "get_contact",
    description: "Get detailed contact information by ID.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: {
          type: "string",
          description: "The Contact record ID",
        },
      },
      required: ["contactId"],
    },
  },
  // Opportunity Operations
  {
    name: "list_opportunities",
    description: "List opportunities with optional filtering.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of opportunities to return (default 100)",
        },
        accountId: {
          type: "string",
          description: "Filter by account ID",
        },
        stageName: {
          type: "string",
          description: "Filter by stage name",
        },
        isClosed: {
          type: "boolean",
          description: "Filter by closed status",
        },
        isWon: {
          type: "boolean",
          description: "Filter by won status",
        },
        closeDateAfter: {
          type: "string",
          description: "Filter opportunities with close date after this date (YYYY-MM-DD)",
        },
        closeDateBefore: {
          type: "string",
          description: "Filter opportunities with close date before this date (YYYY-MM-DD)",
        },
        fields: {
          type: "array",
          items: { type: "string" },
          description: "Additional fields to include in results",
        },
      },
    },
  },
  {
    name: "get_opportunity",
    description: "Get detailed opportunity information by ID.",
    inputSchema: {
      type: "object",
      properties: {
        opportunityId: {
          type: "string",
          description: "The Opportunity record ID",
        },
        includeLineItems: {
          type: "boolean",
          description: "Include opportunity line items (default false)",
        },
        includeContactRoles: {
          type: "boolean",
          description: "Include contact roles (default false)",
        },
      },
      required: ["opportunityId"],
    },
  },
  // Lead Operations
  {
    name: "list_leads",
    description: "List leads with optional filtering.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of leads to return (default 100)",
        },
        status: {
          type: "string",
          description: "Filter by lead status",
        },
        isConverted: {
          type: "boolean",
          description: "Filter by conversion status",
        },
        source: {
          type: "string",
          description: "Filter by lead source",
        },
        nameContains: {
          type: "string",
          description: "Filter leads where name contains this string",
        },
        fields: {
          type: "array",
          items: { type: "string" },
          description: "Additional fields to include in results",
        },
      },
    },
  },
  {
    name: "convert_lead",
    description: "Convert a lead to an account, contact, and optionally an opportunity.",
    inputSchema: {
      type: "object",
      properties: {
        leadId: {
          type: "string",
          description: "The Lead record ID to convert",
        },
        accountId: {
          type: "string",
          description: "Existing account ID to link to (creates new account if not provided)",
        },
        contactId: {
          type: "string",
          description: "Existing contact ID to link to (creates new contact if not provided)",
        },
        createOpportunity: {
          type: "boolean",
          description: "Create an opportunity from the lead (default true)",
        },
        opportunityName: {
          type: "string",
          description: "Name for the new opportunity (defaults to lead company name)",
        },
        ownerId: {
          type: "string",
          description: "User ID to assign as owner",
        },
        convertedStatus: {
          type: "string",
          description: "Lead status to set after conversion",
        },
      },
      required: ["leadId"],
    },
  },
  // Case Operations
  {
    name: "list_cases",
    description: "List cases with optional filtering.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of cases to return (default 100)",
        },
        accountId: {
          type: "string",
          description: "Filter by account ID",
        },
        contactId: {
          type: "string",
          description: "Filter by contact ID",
        },
        status: {
          type: "string",
          description: "Filter by case status",
        },
        priority: {
          type: "string",
          description: "Filter by priority",
        },
        isClosed: {
          type: "boolean",
          description: "Filter by closed status",
        },
        fields: {
          type: "array",
          items: { type: "string" },
          description: "Additional fields to include in results",
        },
      },
    },
  },
  {
    name: "create_case",
    description: "Create a new support case.",
    inputSchema: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "Case subject/title",
        },
        description: {
          type: "string",
          description: "Case description",
        },
        accountId: {
          type: "string",
          description: "Account ID to associate with the case",
        },
        contactId: {
          type: "string",
          description: "Contact ID for the case",
        },
        status: {
          type: "string",
          description: "Initial status (default: New)",
        },
        priority: {
          type: "string",
          description: "Case priority (Low, Medium, High)",
        },
        origin: {
          type: "string",
          description: "Case origin (Phone, Email, Web)",
        },
        type: {
          type: "string",
          description: "Case type",
        },
        reason: {
          type: "string",
          description: "Case reason",
        },
        ownerId: {
          type: "string",
          description: "User or Queue ID to assign as owner",
        },
      },
      required: ["subject"],
    },
  },
  // Reports
  {
    name: "run_report",
    description: "Execute a Salesforce report and return the results.",
    inputSchema: {
      type: "object",
      properties: {
        reportId: {
          type: "string",
          description: "The Report ID to execute",
        },
        filters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              column: { type: "string" },
              operator: { type: "string" },
              value: { type: "string" },
            },
          },
          description: "Optional filters to apply to the report",
        },
        includeDetails: {
          type: "boolean",
          description: "Include detail rows in results (default true)",
        },
      },
      required: ["reportId"],
    },
  },
];

// =============================================================================
// Tool Implementations
// =============================================================================

// Query and Search
async function query(params: { soql: string }): Promise<any> {
  const encodedQuery = encodeURIComponent(params.soql);
  const result = await sfRequest("GET", `/query/?q=${encodedQuery}`);
  return {
    totalSize: result.totalSize,
    done: result.done,
    records: result.records?.map((r: any) => {
      const { attributes, ...rest } = r;
      return rest;
    }) || [],
    nextRecordsUrl: result.nextRecordsUrl,
  };
}

async function search(params: { sosl: string }): Promise<any> {
  const encodedSearch = encodeURIComponent(params.sosl);
  const result = await sfRequest("GET", `/search/?q=${encodedSearch}`);
  return {
    searchRecords: result.searchRecords?.map((r: any) => {
      const { attributes, ...rest } = r;
      return { type: r.attributes?.type, ...rest };
    }) || [],
  };
}

// Generic Record Operations
async function getRecord(params: {
  objectType: string;
  recordId: string;
  fields?: string[];
}): Promise<any> {
  let endpoint = `/sobjects/${params.objectType}/${params.recordId}`;
  if (params.fields && params.fields.length > 0) {
    endpoint += `?fields=${params.fields.join(",")}`;
  }
  const result = await sfRequest("GET", endpoint);
  const { attributes, ...rest } = result;
  return rest;
}

async function createRecord(params: {
  objectType: string;
  data: Record<string, any>;
}): Promise<any> {
  const result = await sfRequest("POST", `/sobjects/${params.objectType}`, params.data);
  return {
    id: result.id,
    success: result.success,
    errors: result.errors,
  };
}

async function updateRecord(params: {
  objectType: string;
  recordId: string;
  data: Record<string, any>;
}): Promise<any> {
  await sfRequest("PATCH", `/sobjects/${params.objectType}/${params.recordId}`, params.data);
  return {
    id: params.recordId,
    success: true,
  };
}

async function deleteRecord(params: {
  objectType: string;
  recordId: string;
}): Promise<any> {
  await sfRequest("DELETE", `/sobjects/${params.objectType}/${params.recordId}`);
  return {
    id: params.recordId,
    deleted: true,
  };
}

// Metadata
async function describeObject(params: { objectType: string }): Promise<any> {
  const result = await sfRequest("GET", `/sobjects/${params.objectType}/describe`);
  return {
    name: result.name,
    label: result.label,
    labelPlural: result.labelPlural,
    keyPrefix: result.keyPrefix,
    custom: result.custom,
    createable: result.createable,
    updateable: result.updateable,
    deletable: result.deletable,
    queryable: result.queryable,
    searchable: result.searchable,
    fields: result.fields?.map((f: any) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      length: f.length,
      nillable: f.nillable,
      createable: f.createable,
      updateable: f.updateable,
      required: !f.nillable && f.createable && !f.defaultedOnCreate,
      picklistValues: f.picklistValues?.length > 0 ? f.picklistValues.map((p: any) => ({
        value: p.value,
        label: p.label,
        active: p.active,
        defaultValue: p.defaultValue,
      })) : undefined,
      referenceTo: f.referenceTo?.length > 0 ? f.referenceTo : undefined,
    })),
    recordTypeInfos: result.recordTypeInfos?.map((rt: any) => ({
      recordTypeId: rt.recordTypeId,
      name: rt.name,
      available: rt.available,
      defaultRecordTypeMapping: rt.defaultRecordTypeMapping,
    })),
  };
}

async function listObjects(params: {
  includeCustom?: boolean;
  includeStandard?: boolean;
}): Promise<any> {
  const result = await sfRequest("GET", "/sobjects");
  const includeCustom = params.includeCustom !== false;
  const includeStandard = params.includeStandard !== false;

  const objects = result.sobjects
    ?.filter((o: any) => {
      if (o.custom && !includeCustom) return false;
      if (!o.custom && !includeStandard) return false;
      return true;
    })
    ?.map((o: any) => ({
      name: o.name,
      label: o.label,
      labelPlural: o.labelPlural,
      keyPrefix: o.keyPrefix,
      custom: o.custom,
      createable: o.createable,
      updateable: o.updateable,
      deletable: o.deletable,
      queryable: o.queryable,
      searchable: o.searchable,
    })) || [];

  return {
    count: objects.length,
    objects,
  };
}

// Limits
async function getLimits(): Promise<any> {
  const result = await sfRequest("GET", "/limits");
  const limits: Record<string, any> = {};

  for (const [key, value] of Object.entries(result)) {
    const v = value as any;
    if (v && typeof v === "object" && "Max" in v && "Remaining" in v) {
      limits[key] = {
        max: v.Max,
        remaining: v.Remaining,
        used: v.Max - v.Remaining,
        percentUsed: Math.round(((v.Max - v.Remaining) / v.Max) * 100),
      };
    }
  }

  return limits;
}

// Account Operations
async function listAccounts(params: {
  limit?: number;
  nameContains?: string;
  type?: string;
  industry?: string;
  fields?: string[];
}): Promise<any> {
  const baseFields = ["Id", "Name", "Type", "Industry", "Phone", "Website", "BillingCity", "BillingState", "OwnerId"];
  const allFields = [...new Set([...baseFields, ...(params.fields || [])])];

  const conditions: string[] = [];
  if (params.nameContains) {
    conditions.push(`Name LIKE '%${params.nameContains.replace(/'/g, "\\'")}%'`);
  }
  if (params.type) {
    conditions.push(`Type = '${params.type.replace(/'/g, "\\'")}'`);
  }
  if (params.industry) {
    conditions.push(`Industry = '${params.industry.replace(/'/g, "\\'")}'`);
  }

  let soql = `SELECT ${allFields.join(", ")} FROM Account`;
  if (conditions.length > 0) {
    soql += ` WHERE ${conditions.join(" AND ")}`;
  }
  soql += ` ORDER BY Name LIMIT ${params.limit || 100}`;

  return query({ soql });
}

async function getAccount(params: {
  accountId: string;
  includeContacts?: boolean;
  includeOpportunities?: boolean;
}): Promise<any> {
  const account = await getRecord({
    objectType: "Account",
    recordId: params.accountId,
  });

  const result: any = { account };

  if (params.includeContacts) {
    const contacts = await query({
      soql: `SELECT Id, Name, Email, Phone, Title FROM Contact WHERE AccountId = '${params.accountId}' ORDER BY Name`,
    });
    result.contacts = contacts.records;
  }

  if (params.includeOpportunities) {
    const opportunities = await query({
      soql: `SELECT Id, Name, StageName, Amount, CloseDate, IsClosed, IsWon FROM Opportunity WHERE AccountId = '${params.accountId}' ORDER BY CloseDate DESC`,
    });
    result.opportunities = opportunities.records;
  }

  return result;
}

// Contact Operations
async function listContacts(params: {
  limit?: number;
  accountId?: string;
  nameContains?: string;
  email?: string;
  fields?: string[];
}): Promise<any> {
  const baseFields = ["Id", "Name", "FirstName", "LastName", "Email", "Phone", "Title", "AccountId", "Account.Name"];
  const allFields = [...new Set([...baseFields, ...(params.fields || [])])];

  const conditions: string[] = [];
  if (params.accountId) {
    conditions.push(`AccountId = '${params.accountId}'`);
  }
  if (params.nameContains) {
    conditions.push(`Name LIKE '%${params.nameContains.replace(/'/g, "\\'")}%'`);
  }
  if (params.email) {
    conditions.push(`Email = '${params.email.replace(/'/g, "\\'")}'`);
  }

  let soql = `SELECT ${allFields.join(", ")} FROM Contact`;
  if (conditions.length > 0) {
    soql += ` WHERE ${conditions.join(" AND ")}`;
  }
  soql += ` ORDER BY Name LIMIT ${params.limit || 100}`;

  return query({ soql });
}

async function getContact(params: { contactId: string }): Promise<any> {
  return getRecord({
    objectType: "Contact",
    recordId: params.contactId,
  });
}

// Opportunity Operations
async function listOpportunities(params: {
  limit?: number;
  accountId?: string;
  stageName?: string;
  isClosed?: boolean;
  isWon?: boolean;
  closeDateAfter?: string;
  closeDateBefore?: string;
  fields?: string[];
}): Promise<any> {
  const baseFields = ["Id", "Name", "AccountId", "Account.Name", "StageName", "Amount", "CloseDate", "Probability", "IsClosed", "IsWon", "OwnerId"];
  const allFields = [...new Set([...baseFields, ...(params.fields || [])])];

  const conditions: string[] = [];
  if (params.accountId) {
    conditions.push(`AccountId = '${params.accountId}'`);
  }
  if (params.stageName) {
    conditions.push(`StageName = '${params.stageName.replace(/'/g, "\\'")}'`);
  }
  if (params.isClosed !== undefined) {
    conditions.push(`IsClosed = ${params.isClosed}`);
  }
  if (params.isWon !== undefined) {
    conditions.push(`IsWon = ${params.isWon}`);
  }
  if (params.closeDateAfter) {
    conditions.push(`CloseDate >= ${params.closeDateAfter}`);
  }
  if (params.closeDateBefore) {
    conditions.push(`CloseDate <= ${params.closeDateBefore}`);
  }

  let soql = `SELECT ${allFields.join(", ")} FROM Opportunity`;
  if (conditions.length > 0) {
    soql += ` WHERE ${conditions.join(" AND ")}`;
  }
  soql += ` ORDER BY CloseDate DESC LIMIT ${params.limit || 100}`;

  return query({ soql });
}

async function getOpportunity(params: {
  opportunityId: string;
  includeLineItems?: boolean;
  includeContactRoles?: boolean;
}): Promise<any> {
  const opportunity = await getRecord({
    objectType: "Opportunity",
    recordId: params.opportunityId,
  });

  const result: any = { opportunity };

  if (params.includeLineItems) {
    const lineItems = await query({
      soql: `SELECT Id, Name, Quantity, UnitPrice, TotalPrice, Product2.Name FROM OpportunityLineItem WHERE OpportunityId = '${params.opportunityId}'`,
    });
    result.lineItems = lineItems.records;
  }

  if (params.includeContactRoles) {
    const contactRoles = await query({
      soql: `SELECT Id, ContactId, Contact.Name, Role, IsPrimary FROM OpportunityContactRole WHERE OpportunityId = '${params.opportunityId}'`,
    });
    result.contactRoles = contactRoles.records;
  }

  return result;
}

// Lead Operations
async function listLeads(params: {
  limit?: number;
  status?: string;
  isConverted?: boolean;
  source?: string;
  nameContains?: string;
  fields?: string[];
}): Promise<any> {
  const baseFields = ["Id", "Name", "FirstName", "LastName", "Email", "Phone", "Company", "Title", "Status", "LeadSource", "IsConverted", "OwnerId"];
  const allFields = [...new Set([...baseFields, ...(params.fields || [])])];

  const conditions: string[] = [];
  if (params.status) {
    conditions.push(`Status = '${params.status.replace(/'/g, "\\'")}'`);
  }
  if (params.isConverted !== undefined) {
    conditions.push(`IsConverted = ${params.isConverted}`);
  }
  if (params.source) {
    conditions.push(`LeadSource = '${params.source.replace(/'/g, "\\'")}'`);
  }
  if (params.nameContains) {
    conditions.push(`Name LIKE '%${params.nameContains.replace(/'/g, "\\'")}%'`);
  }

  let soql = `SELECT ${allFields.join(", ")} FROM Lead`;
  if (conditions.length > 0) {
    soql += ` WHERE ${conditions.join(" AND ")}`;
  }
  soql += ` ORDER BY CreatedDate DESC LIMIT ${params.limit || 100}`;

  return query({ soql });
}

async function convertLead(params: {
  leadId: string;
  accountId?: string;
  contactId?: string;
  createOpportunity?: boolean;
  opportunityName?: string;
  ownerId?: string;
  convertedStatus?: string;
}): Promise<any> {
  const leadConvert: any = {
    leadId: params.leadId,
    convertedStatus: params.convertedStatus || "Closed - Converted",
    doNotCreateOpportunity: params.createOpportunity === false,
  };

  if (params.accountId) {
    leadConvert.accountId = params.accountId;
  }
  if (params.contactId) {
    leadConvert.contactId = params.contactId;
  }
  if (params.opportunityName) {
    leadConvert.opportunityName = params.opportunityName;
  }
  if (params.ownerId) {
    leadConvert.ownerId = params.ownerId;
  }

  // Use the composite API for lead conversion
  const result = await sfRequest("POST", "/actions/standard/convertLead", {
    inputs: [leadConvert],
  });

  if (result && result[0]) {
    return {
      success: result[0].isSuccess,
      accountId: result[0].outputValues?.accountId,
      contactId: result[0].outputValues?.contactId,
      opportunityId: result[0].outputValues?.opportunityId,
      errors: result[0].errors,
    };
  }

  return result;
}

// Case Operations
async function listCases(params: {
  limit?: number;
  accountId?: string;
  contactId?: string;
  status?: string;
  priority?: string;
  isClosed?: boolean;
  fields?: string[];
}): Promise<any> {
  const baseFields = ["Id", "CaseNumber", "Subject", "Status", "Priority", "Origin", "Type", "AccountId", "Account.Name", "ContactId", "Contact.Name", "IsClosed", "CreatedDate", "OwnerId"];
  const allFields = [...new Set([...baseFields, ...(params.fields || [])])];

  const conditions: string[] = [];
  if (params.accountId) {
    conditions.push(`AccountId = '${params.accountId}'`);
  }
  if (params.contactId) {
    conditions.push(`ContactId = '${params.contactId}'`);
  }
  if (params.status) {
    conditions.push(`Status = '${params.status.replace(/'/g, "\\'")}'`);
  }
  if (params.priority) {
    conditions.push(`Priority = '${params.priority.replace(/'/g, "\\'")}'`);
  }
  if (params.isClosed !== undefined) {
    conditions.push(`IsClosed = ${params.isClosed}`);
  }

  let soql = `SELECT ${allFields.join(", ")} FROM Case`;
  if (conditions.length > 0) {
    soql += ` WHERE ${conditions.join(" AND ")}`;
  }
  soql += ` ORDER BY CreatedDate DESC LIMIT ${params.limit || 100}`;

  return query({ soql });
}

async function createCase(params: {
  subject: string;
  description?: string;
  accountId?: string;
  contactId?: string;
  status?: string;
  priority?: string;
  origin?: string;
  type?: string;
  reason?: string;
  ownerId?: string;
}): Promise<any> {
  const caseData: Record<string, any> = {
    Subject: params.subject,
  };

  if (params.description) caseData.Description = params.description;
  if (params.accountId) caseData.AccountId = params.accountId;
  if (params.contactId) caseData.ContactId = params.contactId;
  if (params.status) caseData.Status = params.status;
  if (params.priority) caseData.Priority = params.priority;
  if (params.origin) caseData.Origin = params.origin;
  if (params.type) caseData.Type = params.type;
  if (params.reason) caseData.Reason = params.reason;
  if (params.ownerId) caseData.OwnerId = params.ownerId;

  return createRecord({
    objectType: "Case",
    data: caseData,
  });
}

// Reports
async function runReport(params: {
  reportId: string;
  filters?: Array<{
    column: string;
    operator: string;
    value: string;
  }>;
  includeDetails?: boolean;
}): Promise<any> {
  const reportMetadata: any = {
    reportMetadata: {
      reportFilters: params.filters?.map((f) => ({
        column: f.column,
        operator: f.operator,
        value: f.value,
      })) || [],
    },
  };

  if (params.includeDetails === false) {
    reportMetadata.reportMetadata.detailColumns = [];
  }

  const result = await sfRequest("POST", `/analytics/reports/${params.reportId}`, reportMetadata);

  return {
    reportId: result.reportMetadata?.id,
    name: result.reportMetadata?.name,
    reportFormat: result.reportMetadata?.reportFormat,
    factMap: result.factMap,
    groupingsDown: result.groupingsDown,
    groupingsAcross: result.groupingsAcross,
    aggregates: result.aggregates,
    hasDetailRows: result.hasDetailRows,
    allData: result.allData,
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  { name: "salesforce-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // Query and Search
      case "query": result = await query(args as any); break;
      case "search": result = await search(args as any); break;

      // Generic Record Operations
      case "get_record": result = await getRecord(args as any); break;
      case "create_record": result = await createRecord(args as any); break;
      case "update_record": result = await updateRecord(args as any); break;
      case "delete_record": result = await deleteRecord(args as any); break;

      // Metadata
      case "describe_object": result = await describeObject(args as any); break;
      case "list_objects": result = await listObjects(args as any); break;

      // Limits
      case "get_limits": result = await getLimits(); break;

      // Account Operations
      case "list_accounts": result = await listAccounts(args as any); break;
      case "get_account": result = await getAccount(args as any); break;

      // Contact Operations
      case "list_contacts": result = await listContacts(args as any); break;
      case "get_contact": result = await getContact(args as any); break;

      // Opportunity Operations
      case "list_opportunities": result = await listOpportunities(args as any); break;
      case "get_opportunity": result = await getOpportunity(args as any); break;

      // Lead Operations
      case "list_leads": result = await listLeads(args as any); break;
      case "convert_lead": result = await convertLead(args as any); break;

      // Case Operations
      case "list_cases": result = await listCases(args as any); break;
      case "create_case": result = await createCase(args as any); break;

      // Reports
      case "run_report": result = await runReport(args as any); break;

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
  console.error("Salesforce MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
