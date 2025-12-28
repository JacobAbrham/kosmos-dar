/**
 * Plaid MCP Server - Banking connections for KOSMOS
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  clientId: process.env.PLAID_CLIENT_ID || "",
  secret: process.env.PLAID_SECRET || "",
  env: process.env.PLAID_ENV || "sandbox",
};

const apiUrl = config.env === "production"
  ? "https://production.plaid.com"
  : config.env === "development"
    ? "https://development.plaid.com"
    : "https://sandbox.plaid.com";

async function plaidRequest(path: string, body: any): Promise<any> {
  const res = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: config.clientId, secret: config.secret, ...body }),
  });

  const data = await res.json();
  if (data.error_code) throw new Error(`${data.error_code}: ${data.error_message}`);
  return data;
}

const TOOLS: Tool[] = [
  // Link Token
  { name: "create_link_token", description: "Create a Link token for Plaid Link.", inputSchema: { type: "object", properties: { userId: { type: "string" }, products: { type: "array", items: { type: "string" } }, countryCodes: { type: "array", items: { type: "string" } }, language: { type: "string" } }, required: ["userId"] } },
  { name: "exchange_public_token", description: "Exchange public token for access token.", inputSchema: { type: "object", properties: { publicToken: { type: "string" } }, required: ["publicToken"] } },
  // Accounts
  { name: "get_accounts", description: "Get accounts for an item.", inputSchema: { type: "object", properties: { accessToken: { type: "string" } }, required: ["accessToken"] } },
  { name: "get_account_balances", description: "Get real-time account balances.", inputSchema: { type: "object", properties: { accessToken: { type: "string" }, accountIds: { type: "array", items: { type: "string" } } }, required: ["accessToken"] } },
  // Transactions
  { name: "get_transactions", description: "Get transactions.", inputSchema: { type: "object", properties: { accessToken: { type: "string" }, startDate: { type: "string" }, endDate: { type: "string" }, count: { type: "number" }, offset: { type: "number" } }, required: ["accessToken", "startDate", "endDate"] } },
  { name: "sync_transactions", description: "Sync transactions incrementally.", inputSchema: { type: "object", properties: { accessToken: { type: "string" }, cursor: { type: "string" } }, required: ["accessToken"] } },
  { name: "refresh_transactions", description: "Refresh transactions.", inputSchema: { type: "object", properties: { accessToken: { type: "string" } }, required: ["accessToken"] } },
  // Auth
  { name: "get_auth", description: "Get bank account and routing numbers.", inputSchema: { type: "object", properties: { accessToken: { type: "string" } }, required: ["accessToken"] } },
  // Identity
  { name: "get_identity", description: "Get account holder identity.", inputSchema: { type: "object", properties: { accessToken: { type: "string" } }, required: ["accessToken"] } },
  // Liabilities
  { name: "get_liabilities", description: "Get liabilities (loans, credit cards).", inputSchema: { type: "object", properties: { accessToken: { type: "string" } }, required: ["accessToken"] } },
  // Investments
  { name: "get_investments_holdings", description: "Get investment holdings.", inputSchema: { type: "object", properties: { accessToken: { type: "string" } }, required: ["accessToken"] } },
  { name: "get_investments_transactions", description: "Get investment transactions.", inputSchema: { type: "object", properties: { accessToken: { type: "string" }, startDate: { type: "string" }, endDate: { type: "string" } }, required: ["accessToken", "startDate", "endDate"] } },
  // Item Management
  { name: "get_item", description: "Get item details.", inputSchema: { type: "object", properties: { accessToken: { type: "string" } }, required: ["accessToken"] } },
  { name: "remove_item", description: "Remove an item.", inputSchema: { type: "object", properties: { accessToken: { type: "string" } }, required: ["accessToken"] } },
  { name: "update_item_webhook", description: "Update item webhook.", inputSchema: { type: "object", properties: { accessToken: { type: "string" }, webhook: { type: "string" } }, required: ["accessToken", "webhook"] } },
  // Institutions
  { name: "get_institutions", description: "Get list of institutions.", inputSchema: { type: "object", properties: { count: { type: "number" }, offset: { type: "number" }, countryCodes: { type: "array", items: { type: "string" } } } } },
  { name: "get_institution", description: "Get institution by ID.", inputSchema: { type: "object", properties: { institutionId: { type: "string" }, countryCodes: { type: "array", items: { type: "string" } } }, required: ["institutionId"] } },
  { name: "search_institutions", description: "Search institutions.", inputSchema: { type: "object", properties: { query: { type: "string" }, products: { type: "array", items: { type: "string" } }, countryCodes: { type: "array", items: { type: "string" } } }, required: ["query"] } },
  // Categories
  { name: "get_categories", description: "Get transaction categories.", inputSchema: { type: "object", properties: {} } },
];

async function createLinkToken(params: { userId: string; products?: string[]; countryCodes?: string[]; language?: string }): Promise<any> {
  return plaidRequest("/link/token/create", {
    user: { client_user_id: params.userId },
    client_name: "KOSMOS",
    products: params.products || ["transactions"],
    country_codes: params.countryCodes || ["US"],
    language: params.language || "en",
  });
}

async function exchangePublicToken(params: { publicToken: string }): Promise<any> {
  return plaidRequest("/item/public_token/exchange", { public_token: params.publicToken });
}

async function getAccounts(params: { accessToken: string }): Promise<any> {
  return plaidRequest("/accounts/get", { access_token: params.accessToken });
}

async function getAccountBalances(params: { accessToken: string; accountIds?: string[] }): Promise<any> {
  const body: any = { access_token: params.accessToken };
  if (params.accountIds) body.options = { account_ids: params.accountIds };
  return plaidRequest("/accounts/balance/get", body);
}

async function getTransactions(params: { accessToken: string; startDate: string; endDate: string; count?: number; offset?: number }): Promise<any> {
  return plaidRequest("/transactions/get", {
    access_token: params.accessToken,
    start_date: params.startDate,
    end_date: params.endDate,
    options: { count: params.count || 100, offset: params.offset || 0 },
  });
}

async function syncTransactions(params: { accessToken: string; cursor?: string }): Promise<any> {
  const body: any = { access_token: params.accessToken };
  if (params.cursor) body.cursor = params.cursor;
  return plaidRequest("/transactions/sync", body);
}

async function refreshTransactions(params: { accessToken: string }): Promise<any> {
  return plaidRequest("/transactions/refresh", { access_token: params.accessToken });
}

async function getAuth(params: { accessToken: string }): Promise<any> {
  return plaidRequest("/auth/get", { access_token: params.accessToken });
}

async function getIdentity(params: { accessToken: string }): Promise<any> {
  return plaidRequest("/identity/get", { access_token: params.accessToken });
}

async function getLiabilities(params: { accessToken: string }): Promise<any> {
  return plaidRequest("/liabilities/get", { access_token: params.accessToken });
}

async function getInvestmentsHoldings(params: { accessToken: string }): Promise<any> {
  return plaidRequest("/investments/holdings/get", { access_token: params.accessToken });
}

async function getInvestmentsTransactions(params: { accessToken: string; startDate: string; endDate: string }): Promise<any> {
  return plaidRequest("/investments/transactions/get", {
    access_token: params.accessToken,
    start_date: params.startDate,
    end_date: params.endDate,
  });
}

async function getItem(params: { accessToken: string }): Promise<any> {
  return plaidRequest("/item/get", { access_token: params.accessToken });
}

async function removeItem(params: { accessToken: string }): Promise<any> {
  return plaidRequest("/item/remove", { access_token: params.accessToken });
}

async function updateItemWebhook(params: { accessToken: string; webhook: string }): Promise<any> {
  return plaidRequest("/item/webhook/update", { access_token: params.accessToken, webhook: params.webhook });
}

async function getInstitutions(params: { count?: number; offset?: number; countryCodes?: string[] }): Promise<any> {
  return plaidRequest("/institutions/get", {
    count: params.count || 100,
    offset: params.offset || 0,
    country_codes: params.countryCodes || ["US"],
  });
}

async function getInstitution(params: { institutionId: string; countryCodes?: string[] }): Promise<any> {
  return plaidRequest("/institutions/get_by_id", {
    institution_id: params.institutionId,
    country_codes: params.countryCodes || ["US"],
  });
}

async function searchInstitutions(params: { query: string; products?: string[]; countryCodes?: string[] }): Promise<any> {
  return plaidRequest("/institutions/search", {
    query: params.query,
    products: params.products || ["transactions"],
    country_codes: params.countryCodes || ["US"],
  });
}

async function getCategories(): Promise<any> {
  return plaidRequest("/categories/get", {});
}

const server = new Server({ name: "plaid-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "create_link_token": result = await createLinkToken(args as any); break;
      case "exchange_public_token": result = await exchangePublicToken(args as any); break;
      case "get_accounts": result = await getAccounts(args as any); break;
      case "get_account_balances": result = await getAccountBalances(args as any); break;
      case "get_transactions": result = await getTransactions(args as any); break;
      case "sync_transactions": result = await syncTransactions(args as any); break;
      case "refresh_transactions": result = await refreshTransactions(args as any); break;
      case "get_auth": result = await getAuth(args as any); break;
      case "get_identity": result = await getIdentity(args as any); break;
      case "get_liabilities": result = await getLiabilities(args as any); break;
      case "get_investments_holdings": result = await getInvestmentsHoldings(args as any); break;
      case "get_investments_transactions": result = await getInvestmentsTransactions(args as any); break;
      case "get_item": result = await getItem(args as any); break;
      case "remove_item": result = await removeItem(args as any); break;
      case "update_item_webhook": result = await updateItemWebhook(args as any); break;
      case "get_institutions": result = await getInstitutions(args as any); break;
      case "get_institution": result = await getInstitution(args as any); break;
      case "search_institutions": result = await searchInstitutions(args as any); break;
      case "get_categories": result = await getCategories(); break;
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
  console.error("Plaid MCP Server running on stdio");
}

main().catch(console.error);
