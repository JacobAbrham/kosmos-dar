/**
 * QuickBooks Online MCP Server
 *
 * Provides QuickBooks Online accounting operations for KOSMOS agents.
 * Features:
 * - Customer and vendor management
 * - Invoice creation and management
 * - Payment recording
 * - Expense tracking
 * - Chart of accounts
 * - Financial reports (P&L, Balance Sheet)
 * - Products and services management
 *
 * Authentication: Uses OAuth2 with refresh token.
 * Environment variables: QB_CLIENT_ID, QB_CLIENT_SECRET, QB_REFRESH_TOKEN, QB_REALM_ID
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
  clientId: process.env.QB_CLIENT_ID || "",
  clientSecret: process.env.QB_CLIENT_SECRET || "",
  refreshToken: process.env.QB_REFRESH_TOKEN || "",
  realmId: process.env.QB_REALM_ID || "",
  environment: process.env.QB_ENVIRONMENT || "production", // "sandbox" or "production"
};

const baseUrl = config.environment === "sandbox"
  ? "https://sandbox-quickbooks.api.intuit.com"
  : "https://quickbooks.api.intuit.com";

const tokenUrl = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

// Token management
let accessToken: string = "";
let tokenExpiry: number = 0;

// =============================================================================
// OAuth2 Token Management
// =============================================================================

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 minute buffer)
  if (accessToken && Date.now() < tokenExpiry - 300000) {
    return accessToken;
  }

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);

  // Note: In production, you may want to store the new refresh_token
  // if QuickBooks returns one (they rotate refresh tokens)

  return accessToken;
}

// =============================================================================
// QuickBooks API Request Helper
// =============================================================================

async function qbRequest(
  method: string,
  endpoint: string,
  body?: any,
  query?: Record<string, string>
): Promise<any> {
  const token = await getAccessToken();

  let url = `${baseUrl}/v3/company/${config.realmId}${endpoint}`;

  if (query) {
    const params = new URLSearchParams(query);
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/json",
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`QuickBooks API error (${response.status}): ${error}`);
  }

  return response.json();
}

async function qbQuery(query: string): Promise<any> {
  return qbRequest("GET", "/query", undefined, { query });
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Customer operations
  {
    name: "list_customers",
    description: "List customers from QuickBooks. Can filter by active status.",
    inputSchema: {
      type: "object",
      properties: {
        active: { type: "boolean", description: "Filter by active status (true/false)" },
        maxResults: { type: "number", description: "Maximum number of results (default 100)" },
        startPosition: { type: "number", description: "Starting position for pagination (1-based)" },
      },
    },
  },
  {
    name: "get_customer",
    description: "Get a specific customer by ID.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "The QuickBooks Customer ID" },
      },
      required: ["customerId"],
    },
  },
  {
    name: "create_customer",
    description: "Create a new customer in QuickBooks.",
    inputSchema: {
      type: "object",
      properties: {
        displayName: { type: "string", description: "Display name (required, must be unique)" },
        companyName: { type: "string", description: "Company name" },
        givenName: { type: "string", description: "First name" },
        familyName: { type: "string", description: "Last name" },
        primaryEmailAddr: { type: "string", description: "Primary email address" },
        primaryPhone: { type: "string", description: "Primary phone number" },
        billAddr: {
          type: "object",
          properties: {
            line1: { type: "string" },
            city: { type: "string" },
            countrySubDivisionCode: { type: "string", description: "State/Province code" },
            postalCode: { type: "string" },
            country: { type: "string" },
          },
          description: "Billing address",
        },
        notes: { type: "string", description: "Notes about the customer" },
      },
      required: ["displayName"],
    },
  },
  {
    name: "update_customer",
    description: "Update an existing customer. Requires SyncToken from get_customer.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "The QuickBooks Customer ID" },
        syncToken: { type: "string", description: "Sync token from get_customer (required for updates)" },
        displayName: { type: "string", description: "Display name" },
        companyName: { type: "string", description: "Company name" },
        givenName: { type: "string", description: "First name" },
        familyName: { type: "string", description: "Last name" },
        primaryEmailAddr: { type: "string", description: "Primary email address" },
        primaryPhone: { type: "string", description: "Primary phone number" },
        active: { type: "boolean", description: "Active status" },
      },
      required: ["customerId", "syncToken"],
    },
  },
  // Invoice operations
  {
    name: "list_invoices",
    description: "List invoices with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "Filter by customer ID" },
        startDate: { type: "string", description: "Filter by transaction date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "Filter by transaction date (YYYY-MM-DD)" },
        maxResults: { type: "number", description: "Maximum number of results (default 100)" },
      },
    },
  },
  {
    name: "get_invoice",
    description: "Get a specific invoice by ID.",
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: { type: "string", description: "The QuickBooks Invoice ID" },
      },
      required: ["invoiceId"],
    },
  },
  {
    name: "create_invoice",
    description: "Create a new invoice.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "Customer ID (required)" },
        lineItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string", description: "Line item description" },
              amount: { type: "number", description: "Line amount" },
              itemId: { type: "string", description: "Item/Service ID (optional)" },
              quantity: { type: "number", description: "Quantity (default 1)" },
              unitPrice: { type: "number", description: "Unit price (if using item)" },
            },
          },
          description: "Array of line items",
        },
        dueDate: { type: "string", description: "Due date (YYYY-MM-DD)" },
        txnDate: { type: "string", description: "Transaction date (YYYY-MM-DD)" },
        customerMemo: { type: "string", description: "Memo visible to customer" },
        privateNote: { type: "string", description: "Private note (not visible to customer)" },
        billEmail: { type: "string", description: "Email address for invoice" },
      },
      required: ["customerId", "lineItems"],
    },
  },
  {
    name: "send_invoice",
    description: "Email an invoice to the customer.",
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: { type: "string", description: "The QuickBooks Invoice ID" },
        emailTo: { type: "string", description: "Email address (optional, uses customer email if not provided)" },
      },
      required: ["invoiceId"],
    },
  },
  // Payment operations
  {
    name: "list_payments",
    description: "List payments received.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "Filter by customer ID" },
        startDate: { type: "string", description: "Filter by transaction date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "Filter by transaction date (YYYY-MM-DD)" },
        maxResults: { type: "number", description: "Maximum number of results (default 100)" },
      },
    },
  },
  {
    name: "create_payment",
    description: "Record a payment received from a customer.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "Customer ID (required)" },
        totalAmt: { type: "number", description: "Total payment amount (required)" },
        invoiceId: { type: "string", description: "Invoice ID to apply payment to (optional)" },
        paymentMethodRef: { type: "string", description: "Payment method ID (optional)" },
        depositToAccountId: { type: "string", description: "Account ID to deposit to (optional)" },
        txnDate: { type: "string", description: "Transaction date (YYYY-MM-DD)" },
        privateNote: { type: "string", description: "Private note" },
      },
      required: ["customerId", "totalAmt"],
    },
  },
  // Expense operations
  {
    name: "list_expenses",
    description: "List purchases/expenses (Purchase transactions).",
    inputSchema: {
      type: "object",
      properties: {
        vendorId: { type: "string", description: "Filter by vendor ID" },
        accountId: { type: "string", description: "Filter by account ID" },
        startDate: { type: "string", description: "Filter by transaction date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "Filter by transaction date (YYYY-MM-DD)" },
        maxResults: { type: "number", description: "Maximum number of results (default 100)" },
      },
    },
  },
  {
    name: "create_expense",
    description: "Create an expense/purchase transaction.",
    inputSchema: {
      type: "object",
      properties: {
        paymentType: {
          type: "string",
          enum: ["Cash", "Check", "CreditCard"],
          description: "Payment type (required)",
        },
        accountId: { type: "string", description: "Bank/Credit Card account ID (required)" },
        vendorId: { type: "string", description: "Vendor ID (optional)" },
        lineItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amount: { type: "number", description: "Line amount" },
              description: { type: "string", description: "Description" },
              expenseAccountId: { type: "string", description: "Expense account ID" },
            },
          },
          description: "Array of expense line items",
        },
        txnDate: { type: "string", description: "Transaction date (YYYY-MM-DD)" },
        privateNote: { type: "string", description: "Private note" },
      },
      required: ["paymentType", "accountId", "lineItems"],
    },
  },
  // Account operations
  {
    name: "list_accounts",
    description: "List chart of accounts.",
    inputSchema: {
      type: "object",
      properties: {
        accountType: {
          type: "string",
          description: "Filter by account type (Bank, CreditCard, Expense, Income, etc.)",
        },
        active: { type: "boolean", description: "Filter by active status" },
        maxResults: { type: "number", description: "Maximum number of results (default 100)" },
      },
    },
  },
  {
    name: "get_account",
    description: "Get a specific account by ID.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string", description: "The QuickBooks Account ID" },
      },
      required: ["accountId"],
    },
  },
  // Vendor operations
  {
    name: "list_vendors",
    description: "List vendors/suppliers.",
    inputSchema: {
      type: "object",
      properties: {
        active: { type: "boolean", description: "Filter by active status" },
        maxResults: { type: "number", description: "Maximum number of results (default 100)" },
      },
    },
  },
  {
    name: "create_vendor",
    description: "Create a new vendor/supplier.",
    inputSchema: {
      type: "object",
      properties: {
        displayName: { type: "string", description: "Display name (required, must be unique)" },
        companyName: { type: "string", description: "Company name" },
        givenName: { type: "string", description: "First name" },
        familyName: { type: "string", description: "Last name" },
        primaryEmailAddr: { type: "string", description: "Primary email address" },
        primaryPhone: { type: "string", description: "Primary phone number" },
        billAddr: {
          type: "object",
          properties: {
            line1: { type: "string" },
            city: { type: "string" },
            countrySubDivisionCode: { type: "string", description: "State/Province code" },
            postalCode: { type: "string" },
            country: { type: "string" },
          },
          description: "Billing address",
        },
        taxIdentifier: { type: "string", description: "Tax ID/EIN" },
      },
      required: ["displayName"],
    },
  },
  // Item operations
  {
    name: "list_items",
    description: "List products and services (items).",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["Inventory", "Service", "NonInventory"],
          description: "Filter by item type",
        },
        active: { type: "boolean", description: "Filter by active status" },
        maxResults: { type: "number", description: "Maximum number of results (default 100)" },
      },
    },
  },
  // Report operations
  {
    name: "get_profit_loss",
    description: "Get Profit and Loss (Income Statement) report.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
        accountingMethod: {
          type: "string",
          enum: ["Cash", "Accrual"],
          description: "Accounting method (default: Accrual)",
        },
        summarizeBy: {
          type: "string",
          enum: ["Total", "Month", "Week", "Days"],
          description: "How to summarize the report",
        },
      },
    },
  },
  {
    name: "get_balance_sheet",
    description: "Get Balance Sheet report.",
    inputSchema: {
      type: "object",
      properties: {
        asOfDate: { type: "string", description: "As-of date (YYYY-MM-DD, default: today)" },
        accountingMethod: {
          type: "string",
          enum: ["Cash", "Accrual"],
          description: "Accounting method (default: Accrual)",
        },
      },
    },
  },
  // Company info
  {
    name: "get_company_info",
    description: "Get company information and settings.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// =============================================================================
// Tool Implementations
// =============================================================================

async function listCustomers(params: {
  active?: boolean;
  maxResults?: number;
  startPosition?: number;
}): Promise<any> {
  let query = "SELECT * FROM Customer";
  const conditions: string[] = [];

  if (params.active !== undefined) {
    conditions.push(`Active = ${params.active}`);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` MAXRESULTS ${params.maxResults || 100}`;
  if (params.startPosition) {
    query += ` STARTPOSITION ${params.startPosition}`;
  }

  const result = await qbQuery(query);
  return {
    customers: result.QueryResponse?.Customer || [],
    count: result.QueryResponse?.Customer?.length || 0,
  };
}

async function getCustomer(params: { customerId: string }): Promise<any> {
  const result = await qbRequest("GET", `/customer/${params.customerId}`);
  return result.Customer;
}

async function createCustomer(params: {
  displayName: string;
  companyName?: string;
  givenName?: string;
  familyName?: string;
  primaryEmailAddr?: string;
  primaryPhone?: string;
  billAddr?: {
    line1?: string;
    city?: string;
    countrySubDivisionCode?: string;
    postalCode?: string;
    country?: string;
  };
  notes?: string;
}): Promise<any> {
  const customer: any = {
    DisplayName: params.displayName,
  };

  if (params.companyName) customer.CompanyName = params.companyName;
  if (params.givenName) customer.GivenName = params.givenName;
  if (params.familyName) customer.FamilyName = params.familyName;
  if (params.primaryEmailAddr) {
    customer.PrimaryEmailAddr = { Address: params.primaryEmailAddr };
  }
  if (params.primaryPhone) {
    customer.PrimaryPhone = { FreeFormNumber: params.primaryPhone };
  }
  if (params.billAddr) {
    customer.BillAddr = {
      Line1: params.billAddr.line1,
      City: params.billAddr.city,
      CountrySubDivisionCode: params.billAddr.countrySubDivisionCode,
      PostalCode: params.billAddr.postalCode,
      Country: params.billAddr.country,
    };
  }
  if (params.notes) customer.Notes = params.notes;

  const result = await qbRequest("POST", "/customer", customer);
  return result.Customer;
}

async function updateCustomer(params: {
  customerId: string;
  syncToken: string;
  displayName?: string;
  companyName?: string;
  givenName?: string;
  familyName?: string;
  primaryEmailAddr?: string;
  primaryPhone?: string;
  active?: boolean;
}): Promise<any> {
  const customer: any = {
    Id: params.customerId,
    SyncToken: params.syncToken,
    sparse: true,
  };

  if (params.displayName) customer.DisplayName = params.displayName;
  if (params.companyName) customer.CompanyName = params.companyName;
  if (params.givenName) customer.GivenName = params.givenName;
  if (params.familyName) customer.FamilyName = params.familyName;
  if (params.primaryEmailAddr) {
    customer.PrimaryEmailAddr = { Address: params.primaryEmailAddr };
  }
  if (params.primaryPhone) {
    customer.PrimaryPhone = { FreeFormNumber: params.primaryPhone };
  }
  if (params.active !== undefined) customer.Active = params.active;

  const result = await qbRequest("POST", "/customer", customer);
  return result.Customer;
}

async function listInvoices(params: {
  customerId?: string;
  startDate?: string;
  endDate?: string;
  maxResults?: number;
}): Promise<any> {
  let query = "SELECT * FROM Invoice";
  const conditions: string[] = [];

  if (params.customerId) {
    conditions.push(`CustomerRef = '${params.customerId}'`);
  }
  if (params.startDate) {
    conditions.push(`TxnDate >= '${params.startDate}'`);
  }
  if (params.endDate) {
    conditions.push(`TxnDate <= '${params.endDate}'`);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` MAXRESULTS ${params.maxResults || 100}`;

  const result = await qbQuery(query);
  return {
    invoices: result.QueryResponse?.Invoice || [],
    count: result.QueryResponse?.Invoice?.length || 0,
  };
}

async function getInvoice(params: { invoiceId: string }): Promise<any> {
  const result = await qbRequest("GET", `/invoice/${params.invoiceId}`);
  return result.Invoice;
}

async function createInvoice(params: {
  customerId: string;
  lineItems: Array<{
    description?: string;
    amount?: number;
    itemId?: string;
    quantity?: number;
    unitPrice?: number;
  }>;
  dueDate?: string;
  txnDate?: string;
  customerMemo?: string;
  privateNote?: string;
  billEmail?: string;
}): Promise<any> {
  const lines = params.lineItems.map((item, index) => {
    const line: any = {
      LineNum: index + 1,
      DetailType: item.itemId ? "SalesItemLineDetail" : "DescriptionOnly",
    };

    if (item.itemId) {
      line.SalesItemLineDetail = {
        ItemRef: { value: item.itemId },
        Qty: item.quantity || 1,
        UnitPrice: item.unitPrice,
      };
      line.Amount = item.amount || (item.quantity || 1) * (item.unitPrice || 0);
    } else {
      line.Description = item.description || "";
      line.Amount = item.amount || 0;
      // For description-only lines, we need to use SalesItemLineDetail with a service
      line.DetailType = "SalesItemLineDetail";
      line.SalesItemLineDetail = {
        Qty: 1,
        UnitPrice: item.amount || 0,
      };
    }

    return line;
  });

  const invoice: any = {
    CustomerRef: { value: params.customerId },
    Line: lines,
  };

  if (params.dueDate) invoice.DueDate = params.dueDate;
  if (params.txnDate) invoice.TxnDate = params.txnDate;
  if (params.customerMemo) invoice.CustomerMemo = { value: params.customerMemo };
  if (params.privateNote) invoice.PrivateNote = params.privateNote;
  if (params.billEmail) invoice.BillEmail = { Address: params.billEmail };

  const result = await qbRequest("POST", "/invoice", invoice);
  return result.Invoice;
}

async function sendInvoice(params: {
  invoiceId: string;
  emailTo?: string;
}): Promise<any> {
  let endpoint = `/invoice/${params.invoiceId}/send`;
  if (params.emailTo) {
    endpoint += `?sendTo=${encodeURIComponent(params.emailTo)}`;
  }

  const result = await qbRequest("POST", endpoint);
  return result.Invoice;
}

async function listPayments(params: {
  customerId?: string;
  startDate?: string;
  endDate?: string;
  maxResults?: number;
}): Promise<any> {
  let query = "SELECT * FROM Payment";
  const conditions: string[] = [];

  if (params.customerId) {
    conditions.push(`CustomerRef = '${params.customerId}'`);
  }
  if (params.startDate) {
    conditions.push(`TxnDate >= '${params.startDate}'`);
  }
  if (params.endDate) {
    conditions.push(`TxnDate <= '${params.endDate}'`);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` MAXRESULTS ${params.maxResults || 100}`;

  const result = await qbQuery(query);
  return {
    payments: result.QueryResponse?.Payment || [],
    count: result.QueryResponse?.Payment?.length || 0,
  };
}

async function createPayment(params: {
  customerId: string;
  totalAmt: number;
  invoiceId?: string;
  paymentMethodRef?: string;
  depositToAccountId?: string;
  txnDate?: string;
  privateNote?: string;
}): Promise<any> {
  const payment: any = {
    CustomerRef: { value: params.customerId },
    TotalAmt: params.totalAmt,
  };

  if (params.invoiceId) {
    payment.Line = [{
      Amount: params.totalAmt,
      LinkedTxn: [{
        TxnId: params.invoiceId,
        TxnType: "Invoice",
      }],
    }];
  }

  if (params.paymentMethodRef) {
    payment.PaymentMethodRef = { value: params.paymentMethodRef };
  }
  if (params.depositToAccountId) {
    payment.DepositToAccountRef = { value: params.depositToAccountId };
  }
  if (params.txnDate) payment.TxnDate = params.txnDate;
  if (params.privateNote) payment.PrivateNote = params.privateNote;

  const result = await qbRequest("POST", "/payment", payment);
  return result.Payment;
}

async function listExpenses(params: {
  vendorId?: string;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  maxResults?: number;
}): Promise<any> {
  let query = "SELECT * FROM Purchase";
  const conditions: string[] = [];

  if (params.vendorId) {
    conditions.push(`EntityRef = '${params.vendorId}'`);
  }
  if (params.accountId) {
    conditions.push(`AccountRef = '${params.accountId}'`);
  }
  if (params.startDate) {
    conditions.push(`TxnDate >= '${params.startDate}'`);
  }
  if (params.endDate) {
    conditions.push(`TxnDate <= '${params.endDate}'`);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` MAXRESULTS ${params.maxResults || 100}`;

  const result = await qbQuery(query);
  return {
    expenses: result.QueryResponse?.Purchase || [],
    count: result.QueryResponse?.Purchase?.length || 0,
  };
}

async function createExpense(params: {
  paymentType: "Cash" | "Check" | "CreditCard";
  accountId: string;
  vendorId?: string;
  lineItems: Array<{
    amount: number;
    description?: string;
    expenseAccountId?: string;
  }>;
  txnDate?: string;
  privateNote?: string;
}): Promise<any> {
  const lines = params.lineItems.map((item, index) => ({
    LineNum: index + 1,
    Amount: item.amount,
    DetailType: "AccountBasedExpenseLineDetail",
    AccountBasedExpenseLineDetail: {
      AccountRef: item.expenseAccountId ? { value: item.expenseAccountId } : undefined,
    },
    Description: item.description,
  }));

  const purchase: any = {
    PaymentType: params.paymentType,
    AccountRef: { value: params.accountId },
    Line: lines,
  };

  if (params.vendorId) {
    purchase.EntityRef = { value: params.vendorId, type: "Vendor" };
  }
  if (params.txnDate) purchase.TxnDate = params.txnDate;
  if (params.privateNote) purchase.PrivateNote = params.privateNote;

  const result = await qbRequest("POST", "/purchase", purchase);
  return result.Purchase;
}

async function listAccounts(params: {
  accountType?: string;
  active?: boolean;
  maxResults?: number;
}): Promise<any> {
  let query = "SELECT * FROM Account";
  const conditions: string[] = [];

  if (params.accountType) {
    conditions.push(`AccountType = '${params.accountType}'`);
  }
  if (params.active !== undefined) {
    conditions.push(`Active = ${params.active}`);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` MAXRESULTS ${params.maxResults || 100}`;

  const result = await qbQuery(query);
  return {
    accounts: result.QueryResponse?.Account || [],
    count: result.QueryResponse?.Account?.length || 0,
  };
}

async function getAccount(params: { accountId: string }): Promise<any> {
  const result = await qbRequest("GET", `/account/${params.accountId}`);
  return result.Account;
}

async function listVendors(params: {
  active?: boolean;
  maxResults?: number;
}): Promise<any> {
  let query = "SELECT * FROM Vendor";
  const conditions: string[] = [];

  if (params.active !== undefined) {
    conditions.push(`Active = ${params.active}`);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` MAXRESULTS ${params.maxResults || 100}`;

  const result = await qbQuery(query);
  return {
    vendors: result.QueryResponse?.Vendor || [],
    count: result.QueryResponse?.Vendor?.length || 0,
  };
}

async function createVendor(params: {
  displayName: string;
  companyName?: string;
  givenName?: string;
  familyName?: string;
  primaryEmailAddr?: string;
  primaryPhone?: string;
  billAddr?: {
    line1?: string;
    city?: string;
    countrySubDivisionCode?: string;
    postalCode?: string;
    country?: string;
  };
  taxIdentifier?: string;
}): Promise<any> {
  const vendor: any = {
    DisplayName: params.displayName,
  };

  if (params.companyName) vendor.CompanyName = params.companyName;
  if (params.givenName) vendor.GivenName = params.givenName;
  if (params.familyName) vendor.FamilyName = params.familyName;
  if (params.primaryEmailAddr) {
    vendor.PrimaryEmailAddr = { Address: params.primaryEmailAddr };
  }
  if (params.primaryPhone) {
    vendor.PrimaryPhone = { FreeFormNumber: params.primaryPhone };
  }
  if (params.billAddr) {
    vendor.BillAddr = {
      Line1: params.billAddr.line1,
      City: params.billAddr.city,
      CountrySubDivisionCode: params.billAddr.countrySubDivisionCode,
      PostalCode: params.billAddr.postalCode,
      Country: params.billAddr.country,
    };
  }
  if (params.taxIdentifier) vendor.TaxIdentifier = params.taxIdentifier;

  const result = await qbRequest("POST", "/vendor", vendor);
  return result.Vendor;
}

async function listItems(params: {
  type?: "Inventory" | "Service" | "NonInventory";
  active?: boolean;
  maxResults?: number;
}): Promise<any> {
  let query = "SELECT * FROM Item";
  const conditions: string[] = [];

  if (params.type) {
    conditions.push(`Type = '${params.type}'`);
  }
  if (params.active !== undefined) {
    conditions.push(`Active = ${params.active}`);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` MAXRESULTS ${params.maxResults || 100}`;

  const result = await qbQuery(query);
  return {
    items: result.QueryResponse?.Item || [],
    count: result.QueryResponse?.Item?.length || 0,
  };
}

async function getProfitLoss(params: {
  startDate?: string;
  endDate?: string;
  accountingMethod?: "Cash" | "Accrual";
  summarizeBy?: "Total" | "Month" | "Week" | "Days";
}): Promise<any> {
  const query: Record<string, string> = {};

  if (params.startDate) query.start_date = params.startDate;
  if (params.endDate) query.end_date = params.endDate;
  if (params.accountingMethod) query.accounting_method = params.accountingMethod;
  if (params.summarizeBy) query.summarize_column_by = params.summarizeBy;

  const url = `/reports/ProfitAndLoss${Object.keys(query).length > 0 ? "?" + new URLSearchParams(query).toString() : ""}`;
  const result = await qbRequest("GET", url);
  return result;
}

async function getBalanceSheet(params: {
  asOfDate?: string;
  accountingMethod?: "Cash" | "Accrual";
}): Promise<any> {
  const query: Record<string, string> = {};

  if (params.asOfDate) query.date_macro = params.asOfDate;
  if (params.accountingMethod) query.accounting_method = params.accountingMethod;

  const url = `/reports/BalanceSheet${Object.keys(query).length > 0 ? "?" + new URLSearchParams(query).toString() : ""}`;
  const result = await qbRequest("GET", url);
  return result;
}

async function getCompanyInfo(): Promise<any> {
  const query = "SELECT * FROM CompanyInfo";
  const result = await qbQuery(query);
  return result.QueryResponse?.CompanyInfo?.[0] || null;
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  { name: "quickbooks-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // Customer operations
      case "list_customers": result = await listCustomers(args as any); break;
      case "get_customer": result = await getCustomer(args as any); break;
      case "create_customer": result = await createCustomer(args as any); break;
      case "update_customer": result = await updateCustomer(args as any); break;

      // Invoice operations
      case "list_invoices": result = await listInvoices(args as any); break;
      case "get_invoice": result = await getInvoice(args as any); break;
      case "create_invoice": result = await createInvoice(args as any); break;
      case "send_invoice": result = await sendInvoice(args as any); break;

      // Payment operations
      case "list_payments": result = await listPayments(args as any); break;
      case "create_payment": result = await createPayment(args as any); break;

      // Expense operations
      case "list_expenses": result = await listExpenses(args as any); break;
      case "create_expense": result = await createExpense(args as any); break;

      // Account operations
      case "list_accounts": result = await listAccounts(args as any); break;
      case "get_account": result = await getAccount(args as any); break;

      // Vendor operations
      case "list_vendors": result = await listVendors(args as any); break;
      case "create_vendor": result = await createVendor(args as any); break;

      // Item operations
      case "list_items": result = await listItems(args as any); break;

      // Report operations
      case "get_profit_loss": result = await getProfitLoss(args as any); break;
      case "get_balance_sheet": result = await getBalanceSheet(args as any); break;

      // Company info
      case "get_company_info": result = await getCompanyInfo(); break;

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
  console.error("QuickBooks MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
