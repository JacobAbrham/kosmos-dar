/**
 * Xero MCP Server
 *
 * Provides Xero accounting operations for KOSMOS agents.
 * Features:
 * - Contact management
 * - Invoice operations
 * - Payment processing
 * - Chart of accounts
 * - Bank transactions
 * - Credit notes and purchase orders
 * - Financial reports (P&L, Balance Sheet, Trial Balance)
 * - Organisation management
 *
 * Authentication: Uses OAuth2 with refresh token flow.
 * Required environment variables:
 * - XERO_CLIENT_ID: OAuth2 client ID
 * - XERO_CLIENT_SECRET: OAuth2 client secret
 * - XERO_TENANT_ID: Xero tenant/organisation ID
 * - XERO_REFRESH_TOKEN: OAuth2 refresh token
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
  clientId: process.env.XERO_CLIENT_ID || "",
  clientSecret: process.env.XERO_CLIENT_SECRET || "",
  tenantId: process.env.XERO_TENANT_ID || "",
  refreshToken: process.env.XERO_REFRESH_TOKEN || "",
  tokenEndpoint: "https://identity.xero.com/connect/token",
  apiBaseUrl: "https://api.xero.com/api.xro/2.0",
};

// =============================================================================
// OAuth2 Token Management
// =============================================================================

let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (accessToken && Date.now() < tokenExpiry - 60000) {
    return accessToken;
  }

  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh access token: ${error}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;

  // Update refresh token if a new one is provided
  if (data.refresh_token) {
    config.refreshToken = data.refresh_token;
  }

  return accessToken!;
}

// =============================================================================
// Xero API Client
// =============================================================================

interface XeroRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  params?: Record<string, string | number | boolean | undefined>;
}

async function xeroRequest(endpoint: string, options: XeroRequestOptions = {}): Promise<any> {
  const token = await getAccessToken();
  const { method = "GET", body, params } = options;

  let url = `${config.apiBaseUrl}${endpoint}`;
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
    Authorization: `Bearer ${token}`,
    "Xero-Tenant-Id": config.tenantId,
    Accept: "application/json",
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Xero API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Contact operations
  {
    name: "list_contacts",
    description: "List contacts from Xero with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        where: { type: "string", description: "Filter expression (e.g., 'ContactStatus==\"ACTIVE\"')" },
        order: { type: "string", description: "Order by field (e.g., 'Name ASC')" },
        page: { type: "number", description: "Page number (1-based)" },
        includeArchived: { type: "boolean", description: "Include archived contacts" },
      },
    },
  },
  {
    name: "get_contact",
    description: "Get a specific contact by ID.",
    inputSchema: {
      type: "object",
      properties: {
        contactId: { type: "string", description: "Contact ID" },
      },
      required: ["contactId"],
    },
  },
  {
    name: "create_contact",
    description: "Create a new contact in Xero.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Contact name (required)" },
        firstName: { type: "string", description: "First name" },
        lastName: { type: "string", description: "Last name" },
        emailAddress: { type: "string", description: "Email address" },
        accountNumber: { type: "string", description: "Account number" },
        contactStatus: { type: "string", enum: ["ACTIVE", "ARCHIVED"], description: "Contact status" },
        phones: {
          type: "array",
          items: {
            type: "object",
            properties: {
              phoneType: { type: "string", enum: ["DEFAULT", "DDI", "MOBILE", "FAX"] },
              phoneNumber: { type: "string" },
              phoneAreaCode: { type: "string" },
              phoneCountryCode: { type: "string" },
            },
          },
          description: "Phone numbers",
        },
        addresses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              addressType: { type: "string", enum: ["POBOX", "STREET"] },
              addressLine1: { type: "string" },
              addressLine2: { type: "string" },
              addressLine3: { type: "string" },
              addressLine4: { type: "string" },
              city: { type: "string" },
              region: { type: "string" },
              postalCode: { type: "string" },
              country: { type: "string" },
            },
          },
          description: "Addresses",
        },
        taxNumber: { type: "string", description: "Tax number" },
        bankAccountDetails: { type: "string", description: "Bank account details" },
        isCustomer: { type: "boolean", description: "Is a customer" },
        isSupplier: { type: "boolean", description: "Is a supplier" },
        defaultCurrency: { type: "string", description: "Default currency code" },
      },
      required: ["name"],
    },
  },
  // Invoice operations
  {
    name: "list_invoices",
    description: "List invoices from Xero with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        where: { type: "string", description: "Filter expression" },
        order: { type: "string", description: "Order by field" },
        page: { type: "number", description: "Page number (1-based)" },
        statuses: {
          type: "array",
          items: { type: "string", enum: ["DRAFT", "SUBMITTED", "AUTHORISED", "PAID", "VOIDED", "DELETED"] },
          description: "Filter by statuses",
        },
        contactIds: {
          type: "array",
          items: { type: "string" },
          description: "Filter by contact IDs",
        },
        createdByMyApp: { type: "boolean", description: "Only invoices created by this app" },
      },
    },
  },
  {
    name: "get_invoice",
    description: "Get a specific invoice by ID.",
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: { type: "string", description: "Invoice ID" },
      },
      required: ["invoiceId"],
    },
  },
  {
    name: "create_invoice",
    description: "Create a new invoice in Xero.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["ACCREC", "ACCPAY"], description: "Invoice type (ACCREC=Accounts Receivable, ACCPAY=Accounts Payable)" },
        contactId: { type: "string", description: "Contact ID" },
        lineItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
              unitAmount: { type: "number" },
              accountCode: { type: "string" },
              taxType: { type: "string" },
              lineAmount: { type: "number" },
              itemCode: { type: "string" },
              tracking: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    option: { type: "string" },
                  },
                },
              },
            },
          },
          description: "Line items for the invoice",
        },
        date: { type: "string", description: "Invoice date (YYYY-MM-DD)" },
        dueDate: { type: "string", description: "Due date (YYYY-MM-DD)" },
        invoiceNumber: { type: "string", description: "Invoice number" },
        reference: { type: "string", description: "Reference" },
        status: { type: "string", enum: ["DRAFT", "SUBMITTED", "AUTHORISED"], description: "Invoice status" },
        currencyCode: { type: "string", description: "Currency code" },
        lineAmountTypes: { type: "string", enum: ["Exclusive", "Inclusive", "NoTax"], description: "Line amount type" },
      },
      required: ["type", "contactId", "lineItems"],
    },
  },
  {
    name: "update_invoice",
    description: "Update an existing invoice in Xero.",
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: { type: "string", description: "Invoice ID to update" },
        status: { type: "string", enum: ["DRAFT", "SUBMITTED", "AUTHORISED", "VOIDED"], description: "New status" },
        date: { type: "string", description: "Invoice date (YYYY-MM-DD)" },
        dueDate: { type: "string", description: "Due date (YYYY-MM-DD)" },
        reference: { type: "string", description: "Reference" },
        lineItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
              unitAmount: { type: "number" },
              accountCode: { type: "string" },
              taxType: { type: "string" },
              lineAmount: { type: "number" },
            },
          },
          description: "Updated line items",
        },
      },
      required: ["invoiceId"],
    },
  },
  // Payment operations
  {
    name: "list_payments",
    description: "List payments from Xero with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        where: { type: "string", description: "Filter expression" },
        order: { type: "string", description: "Order by field" },
        page: { type: "number", description: "Page number (1-based)" },
      },
    },
  },
  {
    name: "create_payment",
    description: "Create a payment in Xero.",
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: { type: "string", description: "Invoice ID to pay" },
        accountId: { type: "string", description: "Bank account ID" },
        amount: { type: "number", description: "Payment amount" },
        date: { type: "string", description: "Payment date (YYYY-MM-DD)" },
        reference: { type: "string", description: "Payment reference" },
        isReconciled: { type: "boolean", description: "Is reconciled" },
      },
      required: ["invoiceId", "accountId", "amount", "date"],
    },
  },
  // Account operations
  {
    name: "list_accounts",
    description: "List chart of accounts from Xero.",
    inputSchema: {
      type: "object",
      properties: {
        where: { type: "string", description: "Filter expression" },
        order: { type: "string", description: "Order by field" },
      },
    },
  },
  {
    name: "get_account",
    description: "Get a specific account by ID.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string", description: "Account ID" },
      },
      required: ["accountId"],
    },
  },
  // Bank Transaction operations
  {
    name: "list_bank_transactions",
    description: "List bank transactions from Xero.",
    inputSchema: {
      type: "object",
      properties: {
        where: { type: "string", description: "Filter expression" },
        order: { type: "string", description: "Order by field" },
        page: { type: "number", description: "Page number (1-based)" },
      },
    },
  },
  {
    name: "create_bank_transaction",
    description: "Create a bank transaction in Xero.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["RECEIVE", "RECEIVE-OVERPAYMENT", "RECEIVE-PREPAYMENT", "SPEND", "SPEND-OVERPAYMENT", "SPEND-PREPAYMENT"],
          description: "Transaction type",
        },
        contactId: { type: "string", description: "Contact ID" },
        bankAccountId: { type: "string", description: "Bank account ID" },
        lineItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
              unitAmount: { type: "number" },
              accountCode: { type: "string" },
              taxType: { type: "string" },
            },
          },
          description: "Line items",
        },
        date: { type: "string", description: "Transaction date (YYYY-MM-DD)" },
        reference: { type: "string", description: "Reference" },
        isReconciled: { type: "boolean", description: "Is reconciled" },
        url: { type: "string", description: "URL link" },
      },
      required: ["type", "contactId", "bankAccountId", "lineItems"],
    },
  },
  // Credit Note operations
  {
    name: "list_credit_notes",
    description: "List credit notes from Xero.",
    inputSchema: {
      type: "object",
      properties: {
        where: { type: "string", description: "Filter expression" },
        order: { type: "string", description: "Order by field" },
        page: { type: "number", description: "Page number (1-based)" },
      },
    },
  },
  // Purchase Order operations
  {
    name: "list_purchase_orders",
    description: "List purchase orders from Xero.",
    inputSchema: {
      type: "object",
      properties: {
        where: { type: "string", description: "Filter expression" },
        order: { type: "string", description: "Order by field" },
        page: { type: "number", description: "Page number (1-based)" },
        status: { type: "string", enum: ["DRAFT", "SUBMITTED", "AUTHORISED", "BILLED", "DELETED"], description: "Filter by status" },
      },
    },
  },
  // Report operations
  {
    name: "get_profit_loss",
    description: "Get Profit and Loss report from Xero.",
    inputSchema: {
      type: "object",
      properties: {
        fromDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
        toDate: { type: "string", description: "End date (YYYY-MM-DD)" },
        periods: { type: "number", description: "Number of periods" },
        timeframe: { type: "string", enum: ["MONTH", "QUARTER", "YEAR"], description: "Timeframe for comparison" },
        trackingCategoryId: { type: "string", description: "Tracking category ID" },
        trackingOptionId: { type: "string", description: "Tracking option ID" },
        standardLayout: { type: "boolean", description: "Use standard layout" },
        paymentsOnly: { type: "boolean", description: "Cash basis reporting" },
      },
    },
  },
  {
    name: "get_balance_sheet",
    description: "Get Balance Sheet report from Xero.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Report date (YYYY-MM-DD)" },
        periods: { type: "number", description: "Number of periods" },
        timeframe: { type: "string", enum: ["MONTH", "QUARTER", "YEAR"], description: "Timeframe for comparison" },
        trackingCategoryId: { type: "string", description: "Tracking category ID" },
        trackingOptionId: { type: "string", description: "Tracking option ID" },
        standardLayout: { type: "boolean", description: "Use standard layout" },
        paymentsOnly: { type: "boolean", description: "Cash basis reporting" },
      },
    },
  },
  {
    name: "get_trial_balance",
    description: "Get Trial Balance report from Xero.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Report date (YYYY-MM-DD)" },
        paymentsOnly: { type: "boolean", description: "Cash basis reporting" },
      },
    },
  },
  // Organisation operations
  {
    name: "list_organisations",
    description: "List organisations (tenants) available to the authenticated user.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_organisation",
    description: "Get details of the current organisation.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// =============================================================================
// Tool Implementations
// =============================================================================

// Contact operations
async function listContacts(params: {
  where?: string;
  order?: string;
  page?: number;
  includeArchived?: boolean;
}): Promise<any> {
  const queryParams: Record<string, string | number | boolean | undefined> = {};
  if (params.where) queryParams.where = params.where;
  if (params.order) queryParams.order = params.order;
  if (params.page) queryParams.page = params.page;
  if (params.includeArchived) queryParams.includeArchived = params.includeArchived;

  const response = await xeroRequest("/Contacts", { params: queryParams });

  return {
    contacts: response.Contacts?.map((c: any) => ({
      contactId: c.ContactID,
      name: c.Name,
      firstName: c.FirstName,
      lastName: c.LastName,
      emailAddress: c.EmailAddress,
      accountNumber: c.AccountNumber,
      contactStatus: c.ContactStatus,
      isCustomer: c.IsCustomer,
      isSupplier: c.IsSupplier,
      updatedDateUTC: c.UpdatedDateUTC,
    })) || [],
    pagination: response.pagination,
  };
}

async function getContact(params: { contactId: string }): Promise<any> {
  const response = await xeroRequest(`/Contacts/${params.contactId}`);
  const c = response.Contacts?.[0];

  if (!c) {
    throw new Error(`Contact not found: ${params.contactId}`);
  }

  return {
    contactId: c.ContactID,
    name: c.Name,
    firstName: c.FirstName,
    lastName: c.LastName,
    emailAddress: c.EmailAddress,
    accountNumber: c.AccountNumber,
    contactStatus: c.ContactStatus,
    phones: c.Phones,
    addresses: c.Addresses,
    taxNumber: c.TaxNumber,
    bankAccountDetails: c.BankAccountDetails,
    isCustomer: c.IsCustomer,
    isSupplier: c.IsSupplier,
    defaultCurrency: c.DefaultCurrency,
    updatedDateUTC: c.UpdatedDateUTC,
  };
}

async function createContact(params: {
  name: string;
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  accountNumber?: string;
  contactStatus?: string;
  phones?: any[];
  addresses?: any[];
  taxNumber?: string;
  bankAccountDetails?: string;
  isCustomer?: boolean;
  isSupplier?: boolean;
  defaultCurrency?: string;
}): Promise<any> {
  const contact: any = { Name: params.name };

  if (params.firstName) contact.FirstName = params.firstName;
  if (params.lastName) contact.LastName = params.lastName;
  if (params.emailAddress) contact.EmailAddress = params.emailAddress;
  if (params.accountNumber) contact.AccountNumber = params.accountNumber;
  if (params.contactStatus) contact.ContactStatus = params.contactStatus;
  if (params.phones) {
    contact.Phones = params.phones.map(p => ({
      PhoneType: p.phoneType,
      PhoneNumber: p.phoneNumber,
      PhoneAreaCode: p.phoneAreaCode,
      PhoneCountryCode: p.phoneCountryCode,
    }));
  }
  if (params.addresses) {
    contact.Addresses = params.addresses.map(a => ({
      AddressType: a.addressType,
      AddressLine1: a.addressLine1,
      AddressLine2: a.addressLine2,
      AddressLine3: a.addressLine3,
      AddressLine4: a.addressLine4,
      City: a.city,
      Region: a.region,
      PostalCode: a.postalCode,
      Country: a.country,
    }));
  }
  if (params.taxNumber) contact.TaxNumber = params.taxNumber;
  if (params.bankAccountDetails) contact.BankAccountDetails = params.bankAccountDetails;
  if (params.isCustomer !== undefined) contact.IsCustomer = params.isCustomer;
  if (params.isSupplier !== undefined) contact.IsSupplier = params.isSupplier;
  if (params.defaultCurrency) contact.DefaultCurrency = params.defaultCurrency;

  const response = await xeroRequest("/Contacts", {
    method: "POST",
    body: { Contacts: [contact] },
  });

  const c = response.Contacts?.[0];
  return {
    contactId: c?.ContactID,
    name: c?.Name,
    created: true,
  };
}

// Invoice operations
async function listInvoices(params: {
  where?: string;
  order?: string;
  page?: number;
  statuses?: string[];
  contactIds?: string[];
  createdByMyApp?: boolean;
}): Promise<any> {
  const queryParams: Record<string, string | number | boolean | undefined> = {};
  if (params.where) queryParams.where = params.where;
  if (params.order) queryParams.order = params.order;
  if (params.page) queryParams.page = params.page;
  if (params.statuses) queryParams.Statuses = params.statuses.join(",");
  if (params.contactIds) queryParams.ContactIDs = params.contactIds.join(",");
  if (params.createdByMyApp) queryParams.createdByMyApp = params.createdByMyApp;

  const response = await xeroRequest("/Invoices", { params: queryParams });

  return {
    invoices: response.Invoices?.map((inv: any) => ({
      invoiceId: inv.InvoiceID,
      invoiceNumber: inv.InvoiceNumber,
      type: inv.Type,
      status: inv.Status,
      contactName: inv.Contact?.Name,
      contactId: inv.Contact?.ContactID,
      date: inv.Date,
      dueDate: inv.DueDate,
      total: inv.Total,
      amountDue: inv.AmountDue,
      amountPaid: inv.AmountPaid,
      currencyCode: inv.CurrencyCode,
      updatedDateUTC: inv.UpdatedDateUTC,
    })) || [],
    pagination: response.pagination,
  };
}

async function getInvoice(params: { invoiceId: string }): Promise<any> {
  const response = await xeroRequest(`/Invoices/${params.invoiceId}`);
  const inv = response.Invoices?.[0];

  if (!inv) {
    throw new Error(`Invoice not found: ${params.invoiceId}`);
  }

  return {
    invoiceId: inv.InvoiceID,
    invoiceNumber: inv.InvoiceNumber,
    type: inv.Type,
    status: inv.Status,
    contact: {
      contactId: inv.Contact?.ContactID,
      name: inv.Contact?.Name,
    },
    date: inv.Date,
    dueDate: inv.DueDate,
    lineItems: inv.LineItems?.map((li: any) => ({
      description: li.Description,
      quantity: li.Quantity,
      unitAmount: li.UnitAmount,
      accountCode: li.AccountCode,
      taxType: li.TaxType,
      lineAmount: li.LineAmount,
      taxAmount: li.TaxAmount,
    })),
    subTotal: inv.SubTotal,
    totalTax: inv.TotalTax,
    total: inv.Total,
    amountDue: inv.AmountDue,
    amountPaid: inv.AmountPaid,
    currencyCode: inv.CurrencyCode,
    reference: inv.Reference,
    payments: inv.Payments?.map((p: any) => ({
      paymentId: p.PaymentID,
      amount: p.Amount,
      date: p.Date,
    })),
    updatedDateUTC: inv.UpdatedDateUTC,
  };
}

async function createInvoice(params: {
  type: string;
  contactId: string;
  lineItems: any[];
  date?: string;
  dueDate?: string;
  invoiceNumber?: string;
  reference?: string;
  status?: string;
  currencyCode?: string;
  lineAmountTypes?: string;
}): Promise<any> {
  const invoice: any = {
    Type: params.type,
    Contact: { ContactID: params.contactId },
    LineItems: params.lineItems.map(li => ({
      Description: li.description,
      Quantity: li.quantity,
      UnitAmount: li.unitAmount,
      AccountCode: li.accountCode,
      TaxType: li.taxType,
      LineAmount: li.lineAmount,
      ItemCode: li.itemCode,
      Tracking: li.tracking?.map((t: any) => ({
        Name: t.name,
        Option: t.option,
      })),
    })),
  };

  if (params.date) invoice.Date = params.date;
  if (params.dueDate) invoice.DueDate = params.dueDate;
  if (params.invoiceNumber) invoice.InvoiceNumber = params.invoiceNumber;
  if (params.reference) invoice.Reference = params.reference;
  if (params.status) invoice.Status = params.status;
  if (params.currencyCode) invoice.CurrencyCode = params.currencyCode;
  if (params.lineAmountTypes) invoice.LineAmountTypes = params.lineAmountTypes;

  const response = await xeroRequest("/Invoices", {
    method: "POST",
    body: { Invoices: [invoice] },
  });

  const inv = response.Invoices?.[0];
  return {
    invoiceId: inv?.InvoiceID,
    invoiceNumber: inv?.InvoiceNumber,
    status: inv?.Status,
    total: inv?.Total,
    created: true,
  };
}

async function updateInvoice(params: {
  invoiceId: string;
  status?: string;
  date?: string;
  dueDate?: string;
  reference?: string;
  lineItems?: any[];
}): Promise<any> {
  const invoice: any = { InvoiceID: params.invoiceId };

  if (params.status) invoice.Status = params.status;
  if (params.date) invoice.Date = params.date;
  if (params.dueDate) invoice.DueDate = params.dueDate;
  if (params.reference) invoice.Reference = params.reference;
  if (params.lineItems) {
    invoice.LineItems = params.lineItems.map(li => ({
      Description: li.description,
      Quantity: li.quantity,
      UnitAmount: li.unitAmount,
      AccountCode: li.accountCode,
      TaxType: li.taxType,
      LineAmount: li.lineAmount,
    }));
  }

  const response = await xeroRequest("/Invoices", {
    method: "POST",
    body: { Invoices: [invoice] },
  });

  const inv = response.Invoices?.[0];
  return {
    invoiceId: inv?.InvoiceID,
    invoiceNumber: inv?.InvoiceNumber,
    status: inv?.Status,
    updated: true,
  };
}

// Payment operations
async function listPayments(params: {
  where?: string;
  order?: string;
  page?: number;
}): Promise<any> {
  const queryParams: Record<string, string | number | boolean | undefined> = {};
  if (params.where) queryParams.where = params.where;
  if (params.order) queryParams.order = params.order;
  if (params.page) queryParams.page = params.page;

  const response = await xeroRequest("/Payments", { params: queryParams });

  return {
    payments: response.Payments?.map((p: any) => ({
      paymentId: p.PaymentID,
      date: p.Date,
      amount: p.Amount,
      reference: p.Reference,
      status: p.Status,
      paymentType: p.PaymentType,
      invoiceNumber: p.Invoice?.InvoiceNumber,
      invoiceId: p.Invoice?.InvoiceID,
      accountName: p.Account?.Name,
      accountId: p.Account?.AccountID,
      updatedDateUTC: p.UpdatedDateUTC,
    })) || [],
    pagination: response.pagination,
  };
}

async function createPayment(params: {
  invoiceId: string;
  accountId: string;
  amount: number;
  date: string;
  reference?: string;
  isReconciled?: boolean;
}): Promise<any> {
  const payment: any = {
    Invoice: { InvoiceID: params.invoiceId },
    Account: { AccountID: params.accountId },
    Amount: params.amount,
    Date: params.date,
  };

  if (params.reference) payment.Reference = params.reference;
  if (params.isReconciled !== undefined) payment.IsReconciled = params.isReconciled;

  const response = await xeroRequest("/Payments", {
    method: "PUT",
    body: { Payments: [payment] },
  });

  const p = response.Payments?.[0];
  return {
    paymentId: p?.PaymentID,
    amount: p?.Amount,
    status: p?.Status,
    created: true,
  };
}

// Account operations
async function listAccounts(params: {
  where?: string;
  order?: string;
}): Promise<any> {
  const queryParams: Record<string, string | number | boolean | undefined> = {};
  if (params.where) queryParams.where = params.where;
  if (params.order) queryParams.order = params.order;

  const response = await xeroRequest("/Accounts", { params: queryParams });

  return {
    accounts: response.Accounts?.map((a: any) => ({
      accountId: a.AccountID,
      code: a.Code,
      name: a.Name,
      type: a.Type,
      status: a.Status,
      taxType: a.TaxType,
      class: a.Class,
      enablePaymentsToAccount: a.EnablePaymentsToAccount,
      showInExpenseClaims: a.ShowInExpenseClaims,
      bankAccountNumber: a.BankAccountNumber,
      bankAccountType: a.BankAccountType,
      currencyCode: a.CurrencyCode,
      updatedDateUTC: a.UpdatedDateUTC,
    })) || [],
  };
}

async function getAccount(params: { accountId: string }): Promise<any> {
  const response = await xeroRequest(`/Accounts/${params.accountId}`);
  const a = response.Accounts?.[0];

  if (!a) {
    throw new Error(`Account not found: ${params.accountId}`);
  }

  return {
    accountId: a.AccountID,
    code: a.Code,
    name: a.Name,
    type: a.Type,
    status: a.Status,
    description: a.Description,
    taxType: a.TaxType,
    class: a.Class,
    enablePaymentsToAccount: a.EnablePaymentsToAccount,
    showInExpenseClaims: a.ShowInExpenseClaims,
    bankAccountNumber: a.BankAccountNumber,
    bankAccountType: a.BankAccountType,
    currencyCode: a.CurrencyCode,
    reportingCode: a.ReportingCode,
    reportingCodeName: a.ReportingCodeName,
    updatedDateUTC: a.UpdatedDateUTC,
  };
}

// Bank Transaction operations
async function listBankTransactions(params: {
  where?: string;
  order?: string;
  page?: number;
}): Promise<any> {
  const queryParams: Record<string, string | number | boolean | undefined> = {};
  if (params.where) queryParams.where = params.where;
  if (params.order) queryParams.order = params.order;
  if (params.page) queryParams.page = params.page;

  const response = await xeroRequest("/BankTransactions", { params: queryParams });

  return {
    bankTransactions: response.BankTransactions?.map((bt: any) => ({
      bankTransactionId: bt.BankTransactionID,
      type: bt.Type,
      status: bt.Status,
      contactName: bt.Contact?.Name,
      contactId: bt.Contact?.ContactID,
      date: bt.Date,
      total: bt.Total,
      reference: bt.Reference,
      isReconciled: bt.IsReconciled,
      bankAccountName: bt.BankAccount?.Name,
      bankAccountId: bt.BankAccount?.AccountID,
      updatedDateUTC: bt.UpdatedDateUTC,
    })) || [],
    pagination: response.pagination,
  };
}

async function createBankTransaction(params: {
  type: string;
  contactId: string;
  bankAccountId: string;
  lineItems: any[];
  date?: string;
  reference?: string;
  isReconciled?: boolean;
  url?: string;
}): Promise<any> {
  const transaction: any = {
    Type: params.type,
    Contact: { ContactID: params.contactId },
    BankAccount: { AccountID: params.bankAccountId },
    LineItems: params.lineItems.map(li => ({
      Description: li.description,
      Quantity: li.quantity,
      UnitAmount: li.unitAmount,
      AccountCode: li.accountCode,
      TaxType: li.taxType,
    })),
  };

  if (params.date) transaction.Date = params.date;
  if (params.reference) transaction.Reference = params.reference;
  if (params.isReconciled !== undefined) transaction.IsReconciled = params.isReconciled;
  if (params.url) transaction.Url = params.url;

  const response = await xeroRequest("/BankTransactions", {
    method: "PUT",
    body: { BankTransactions: [transaction] },
  });

  const bt = response.BankTransactions?.[0];
  return {
    bankTransactionId: bt?.BankTransactionID,
    type: bt?.Type,
    status: bt?.Status,
    total: bt?.Total,
    created: true,
  };
}

// Credit Note operations
async function listCreditNotes(params: {
  where?: string;
  order?: string;
  page?: number;
}): Promise<any> {
  const queryParams: Record<string, string | number | boolean | undefined> = {};
  if (params.where) queryParams.where = params.where;
  if (params.order) queryParams.order = params.order;
  if (params.page) queryParams.page = params.page;

  const response = await xeroRequest("/CreditNotes", { params: queryParams });

  return {
    creditNotes: response.CreditNotes?.map((cn: any) => ({
      creditNoteId: cn.CreditNoteID,
      creditNoteNumber: cn.CreditNoteNumber,
      type: cn.Type,
      status: cn.Status,
      contactName: cn.Contact?.Name,
      contactId: cn.Contact?.ContactID,
      date: cn.Date,
      total: cn.Total,
      remainingCredit: cn.RemainingCredit,
      currencyCode: cn.CurrencyCode,
      updatedDateUTC: cn.UpdatedDateUTC,
    })) || [],
    pagination: response.pagination,
  };
}

// Purchase Order operations
async function listPurchaseOrders(params: {
  where?: string;
  order?: string;
  page?: number;
  status?: string;
}): Promise<any> {
  const queryParams: Record<string, string | number | boolean | undefined> = {};
  if (params.where) queryParams.where = params.where;
  if (params.order) queryParams.order = params.order;
  if (params.page) queryParams.page = params.page;
  if (params.status) queryParams.Status = params.status;

  const response = await xeroRequest("/PurchaseOrders", { params: queryParams });

  return {
    purchaseOrders: response.PurchaseOrders?.map((po: any) => ({
      purchaseOrderId: po.PurchaseOrderID,
      purchaseOrderNumber: po.PurchaseOrderNumber,
      status: po.Status,
      contactName: po.Contact?.Name,
      contactId: po.Contact?.ContactID,
      date: po.Date,
      deliveryDate: po.DeliveryDate,
      total: po.Total,
      currencyCode: po.CurrencyCode,
      reference: po.Reference,
      updatedDateUTC: po.UpdatedDateUTC,
    })) || [],
    pagination: response.pagination,
  };
}

// Report operations
async function getProfitLoss(params: {
  fromDate?: string;
  toDate?: string;
  periods?: number;
  timeframe?: string;
  trackingCategoryId?: string;
  trackingOptionId?: string;
  standardLayout?: boolean;
  paymentsOnly?: boolean;
}): Promise<any> {
  const queryParams: Record<string, string | number | boolean | undefined> = {};
  if (params.fromDate) queryParams.fromDate = params.fromDate;
  if (params.toDate) queryParams.toDate = params.toDate;
  if (params.periods) queryParams.periods = params.periods;
  if (params.timeframe) queryParams.timeframe = params.timeframe;
  if (params.trackingCategoryId) queryParams.trackingCategoryID = params.trackingCategoryId;
  if (params.trackingOptionId) queryParams.trackingOptionID = params.trackingOptionId;
  if (params.standardLayout !== undefined) queryParams.standardLayout = params.standardLayout;
  if (params.paymentsOnly !== undefined) queryParams.paymentsOnly = params.paymentsOnly;

  const response = await xeroRequest("/Reports/ProfitAndLoss", { params: queryParams });

  return {
    reportName: response.Reports?.[0]?.ReportName,
    reportType: response.Reports?.[0]?.ReportType,
    reportDate: response.Reports?.[0]?.ReportDate,
    updatedDateUTC: response.Reports?.[0]?.UpdatedDateUTC,
    rows: response.Reports?.[0]?.Rows?.map((row: any) => ({
      rowType: row.RowType,
      title: row.Title,
      cells: row.Cells?.map((cell: any) => ({
        value: cell.Value,
        attributes: cell.Attributes,
      })),
      rows: row.Rows?.map((subRow: any) => ({
        rowType: subRow.RowType,
        cells: subRow.Cells?.map((cell: any) => ({
          value: cell.Value,
          attributes: cell.Attributes,
        })),
      })),
    })),
  };
}

async function getBalanceSheet(params: {
  date?: string;
  periods?: number;
  timeframe?: string;
  trackingCategoryId?: string;
  trackingOptionId?: string;
  standardLayout?: boolean;
  paymentsOnly?: boolean;
}): Promise<any> {
  const queryParams: Record<string, string | number | boolean | undefined> = {};
  if (params.date) queryParams.date = params.date;
  if (params.periods) queryParams.periods = params.periods;
  if (params.timeframe) queryParams.timeframe = params.timeframe;
  if (params.trackingCategoryId) queryParams.trackingCategoryID = params.trackingCategoryId;
  if (params.trackingOptionId) queryParams.trackingOptionID = params.trackingOptionId;
  if (params.standardLayout !== undefined) queryParams.standardLayout = params.standardLayout;
  if (params.paymentsOnly !== undefined) queryParams.paymentsOnly = params.paymentsOnly;

  const response = await xeroRequest("/Reports/BalanceSheet", { params: queryParams });

  return {
    reportName: response.Reports?.[0]?.ReportName,
    reportType: response.Reports?.[0]?.ReportType,
    reportDate: response.Reports?.[0]?.ReportDate,
    updatedDateUTC: response.Reports?.[0]?.UpdatedDateUTC,
    rows: response.Reports?.[0]?.Rows?.map((row: any) => ({
      rowType: row.RowType,
      title: row.Title,
      cells: row.Cells?.map((cell: any) => ({
        value: cell.Value,
        attributes: cell.Attributes,
      })),
      rows: row.Rows?.map((subRow: any) => ({
        rowType: subRow.RowType,
        cells: subRow.Cells?.map((cell: any) => ({
          value: cell.Value,
          attributes: cell.Attributes,
        })),
      })),
    })),
  };
}

async function getTrialBalance(params: {
  date?: string;
  paymentsOnly?: boolean;
}): Promise<any> {
  const queryParams: Record<string, string | number | boolean | undefined> = {};
  if (params.date) queryParams.date = params.date;
  if (params.paymentsOnly !== undefined) queryParams.paymentsOnly = params.paymentsOnly;

  const response = await xeroRequest("/Reports/TrialBalance", { params: queryParams });

  return {
    reportName: response.Reports?.[0]?.ReportName,
    reportType: response.Reports?.[0]?.ReportType,
    reportDate: response.Reports?.[0]?.ReportDate,
    updatedDateUTC: response.Reports?.[0]?.UpdatedDateUTC,
    rows: response.Reports?.[0]?.Rows?.map((row: any) => ({
      rowType: row.RowType,
      title: row.Title,
      cells: row.Cells?.map((cell: any) => ({
        value: cell.Value,
        attributes: cell.Attributes,
      })),
      rows: row.Rows?.map((subRow: any) => ({
        rowType: subRow.RowType,
        cells: subRow.Cells?.map((cell: any) => ({
          value: cell.Value,
          attributes: cell.Attributes,
        })),
      })),
    })),
  };
}

// Organisation operations
async function listOrganisations(): Promise<any> {
  // List connections/tenants requires a different endpoint
  const token = await getAccessToken();
  const response = await fetch("https://api.xero.com/connections", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Xero API error (${response.status}): ${errorText}`);
  }

  const connections = await response.json();

  return {
    organisations: connections.map((conn: any) => ({
      tenantId: conn.tenantId,
      tenantType: conn.tenantType,
      tenantName: conn.tenantName,
      createdDateUtc: conn.createdDateUtc,
      updatedDateUtc: conn.updatedDateUtc,
    })),
  };
}

async function getOrganisation(): Promise<any> {
  const response = await xeroRequest("/Organisation");
  const org = response.Organisations?.[0];

  if (!org) {
    throw new Error("Organisation not found");
  }

  return {
    organisationId: org.OrganisationID,
    name: org.Name,
    legalName: org.LegalName,
    shortCode: org.ShortCode,
    organisationStatus: org.OrganisationStatus,
    organisationType: org.OrganisationType,
    baseCurrency: org.BaseCurrency,
    countryCode: org.CountryCode,
    isDemoCompany: org.IsDemoCompany,
    financialYearEndDay: org.FinancialYearEndDay,
    financialYearEndMonth: org.FinancialYearEndMonth,
    salesTaxBasis: org.SalesTaxBasis,
    salesTaxPeriod: org.SalesTaxPeriod,
    defaultSalesTax: org.DefaultSalesTax,
    defaultPurchasesTax: org.DefaultPurchasesTax,
    periodLockDate: org.PeriodLockDate,
    endOfYearLockDate: org.EndOfYearLockDate,
    createdDateUTC: org.CreatedDateUTC,
    timezone: org.Timezone,
    edition: org.Edition,
    class: org.Class,
    addresses: org.Addresses,
    phones: org.Phones,
    externalLinks: org.ExternalLinks,
    paymentTerms: org.PaymentTerms,
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  { name: "xero-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // Contact operations
      case "list_contacts": result = await listContacts(args as any); break;
      case "get_contact": result = await getContact(args as any); break;
      case "create_contact": result = await createContact(args as any); break;

      // Invoice operations
      case "list_invoices": result = await listInvoices(args as any); break;
      case "get_invoice": result = await getInvoice(args as any); break;
      case "create_invoice": result = await createInvoice(args as any); break;
      case "update_invoice": result = await updateInvoice(args as any); break;

      // Payment operations
      case "list_payments": result = await listPayments(args as any); break;
      case "create_payment": result = await createPayment(args as any); break;

      // Account operations
      case "list_accounts": result = await listAccounts(args as any); break;
      case "get_account": result = await getAccount(args as any); break;

      // Bank Transaction operations
      case "list_bank_transactions": result = await listBankTransactions(args as any); break;
      case "create_bank_transaction": result = await createBankTransaction(args as any); break;

      // Credit Note operations
      case "list_credit_notes": result = await listCreditNotes(args as any); break;

      // Purchase Order operations
      case "list_purchase_orders": result = await listPurchaseOrders(args as any); break;

      // Report operations
      case "get_profit_loss": result = await getProfitLoss(args as any); break;
      case "get_balance_sheet": result = await getBalanceSheet(args as any); break;
      case "get_trial_balance": result = await getTrialBalance(args as any); break;

      // Organisation operations
      case "list_organisations": result = await listOrganisations(); break;
      case "get_organisation": result = await getOrganisation(); break;

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
  console.error("Xero MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
