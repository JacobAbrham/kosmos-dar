/**
 * Square MCP Server - Payments and commerce for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { Client, Environment } from "square";

const config = {
  accessToken: process.env.SQUARE_ACCESS_TOKEN || "",
  environment: (process.env.SQUARE_ENVIRONMENT || "sandbox") as "sandbox" | "production",
};

const client = new Client({
  accessToken: config.accessToken,
  environment: config.environment === "production" ? Environment.Production : Environment.Sandbox,
});

const TOOLS: Tool[] = [
  // Payments
  { name: "create_payment", description: "Create a payment.", inputSchema: { type: "object", properties: { sourceId: { type: "string" }, amountMoney: { type: "object", properties: { amount: { type: "number" }, currency: { type: "string" } } }, idempotencyKey: { type: "string" }, customerId: { type: "string" }, locationId: { type: "string" }, note: { type: "string" } }, required: ["sourceId", "amountMoney", "idempotencyKey"] } },
  { name: "get_payment", description: "Get payment details.", inputSchema: { type: "object", properties: { paymentId: { type: "string" } }, required: ["paymentId"] } },
  { name: "list_payments", description: "List payments.", inputSchema: { type: "object", properties: { beginTime: { type: "string" }, endTime: { type: "string" }, locationId: { type: "string" }, limit: { type: "number" } } } },
  { name: "cancel_payment", description: "Cancel a payment.", inputSchema: { type: "object", properties: { paymentId: { type: "string" } }, required: ["paymentId"] } },
  { name: "refund_payment", description: "Refund a payment.", inputSchema: { type: "object", properties: { paymentId: { type: "string" }, amountMoney: { type: "object" }, idempotencyKey: { type: "string" }, reason: { type: "string" } }, required: ["paymentId", "amountMoney", "idempotencyKey"] } },
  // Orders
  { name: "create_order", description: "Create an order.", inputSchema: { type: "object", properties: { locationId: { type: "string" }, lineItems: { type: "array" }, customerId: { type: "string" }, idempotencyKey: { type: "string" } }, required: ["locationId", "lineItems", "idempotencyKey"] } },
  { name: "get_order", description: "Get order details.", inputSchema: { type: "object", properties: { orderId: { type: "string" } }, required: ["orderId"] } },
  { name: "search_orders", description: "Search orders.", inputSchema: { type: "object", properties: { locationIds: { type: "array", items: { type: "string" } }, query: { type: "object" }, limit: { type: "number" } }, required: ["locationIds"] } },
  { name: "update_order", description: "Update an order.", inputSchema: { type: "object", properties: { orderId: { type: "string" }, fieldsToClear: { type: "array", items: { type: "string" } }, idempotencyKey: { type: "string" } }, required: ["orderId", "idempotencyKey"] } },
  { name: "pay_order", description: "Pay for an order.", inputSchema: { type: "object", properties: { orderId: { type: "string" }, paymentIds: { type: "array", items: { type: "string" } }, idempotencyKey: { type: "string" } }, required: ["orderId", "paymentIds", "idempotencyKey"] } },
  // Customers
  { name: "create_customer", description: "Create a customer.", inputSchema: { type: "object", properties: { givenName: { type: "string" }, familyName: { type: "string" }, emailAddress: { type: "string" }, phoneNumber: { type: "string" }, note: { type: "string" }, idempotencyKey: { type: "string" } }, required: ["idempotencyKey"] } },
  { name: "get_customer", description: "Get customer details.", inputSchema: { type: "object", properties: { customerId: { type: "string" } }, required: ["customerId"] } },
  { name: "search_customers", description: "Search customers.", inputSchema: { type: "object", properties: { query: { type: "object" }, limit: { type: "number" } } } },
  { name: "update_customer", description: "Update a customer.", inputSchema: { type: "object", properties: { customerId: { type: "string" }, givenName: { type: "string" }, familyName: { type: "string" }, emailAddress: { type: "string" }, phoneNumber: { type: "string" }, note: { type: "string" } }, required: ["customerId"] } },
  { name: "delete_customer", description: "Delete a customer.", inputSchema: { type: "object", properties: { customerId: { type: "string" } }, required: ["customerId"] } },
  // Catalog
  { name: "list_catalog", description: "List catalog items.", inputSchema: { type: "object", properties: { types: { type: "array", items: { type: "string" } }, cursor: { type: "string" } } } },
  { name: "get_catalog_item", description: "Get catalog item.", inputSchema: { type: "object", properties: { objectId: { type: "string" } }, required: ["objectId"] } },
  { name: "search_catalog", description: "Search catalog.", inputSchema: { type: "object", properties: { objectTypes: { type: "array", items: { type: "string" } }, query: { type: "object" }, limit: { type: "number" } } } },
  { name: "upsert_catalog_item", description: "Create or update catalog item.", inputSchema: { type: "object", properties: { object: { type: "object" }, idempotencyKey: { type: "string" } }, required: ["object", "idempotencyKey"] } },
  { name: "delete_catalog_item", description: "Delete catalog item.", inputSchema: { type: "object", properties: { objectId: { type: "string" } }, required: ["objectId"] } },
  // Inventory
  { name: "get_inventory_count", description: "Get inventory count.", inputSchema: { type: "object", properties: { catalogObjectId: { type: "string" }, locationIds: { type: "array", items: { type: "string" } } }, required: ["catalogObjectId"] } },
  { name: "batch_change_inventory", description: "Batch change inventory.", inputSchema: { type: "object", properties: { changes: { type: "array" }, idempotencyKey: { type: "string" } }, required: ["changes", "idempotencyKey"] } },
  // Locations
  { name: "list_locations", description: "List locations.", inputSchema: { type: "object", properties: {} } },
  { name: "get_location", description: "Get location details.", inputSchema: { type: "object", properties: { locationId: { type: "string" } }, required: ["locationId"] } },
  // Invoices
  { name: "create_invoice", description: "Create an invoice.", inputSchema: { type: "object", properties: { invoice: { type: "object" }, idempotencyKey: { type: "string" } }, required: ["invoice", "idempotencyKey"] } },
  { name: "get_invoice", description: "Get invoice details.", inputSchema: { type: "object", properties: { invoiceId: { type: "string" } }, required: ["invoiceId"] } },
  { name: "list_invoices", description: "List invoices.", inputSchema: { type: "object", properties: { locationId: { type: "string" }, cursor: { type: "string" }, limit: { type: "number" } }, required: ["locationId"] } },
  { name: "publish_invoice", description: "Publish an invoice.", inputSchema: { type: "object", properties: { invoiceId: { type: "string" }, version: { type: "number" }, idempotencyKey: { type: "string" } }, required: ["invoiceId", "version", "idempotencyKey"] } },
  // Subscriptions
  { name: "create_subscription", description: "Create a subscription.", inputSchema: { type: "object", properties: { locationId: { type: "string" }, customerId: { type: "string" }, planId: { type: "string" }, idempotencyKey: { type: "string" } }, required: ["locationId", "customerId", "planId", "idempotencyKey"] } },
  { name: "get_subscription", description: "Get subscription details.", inputSchema: { type: "object", properties: { subscriptionId: { type: "string" } }, required: ["subscriptionId"] } },
  { name: "cancel_subscription", description: "Cancel a subscription.", inputSchema: { type: "object", properties: { subscriptionId: { type: "string" } }, required: ["subscriptionId"] } },
];

async function createPayment(params: { sourceId: string; amountMoney: { amount: number; currency: string }; idempotencyKey: string; customerId?: string; locationId?: string; note?: string }): Promise<any> {
  const res = await client.paymentsApi.createPayment({
    sourceId: params.sourceId,
    amountMoney: { amount: BigInt(params.amountMoney.amount), currency: params.amountMoney.currency },
    idempotencyKey: params.idempotencyKey,
    customerId: params.customerId,
    locationId: params.locationId,
    note: params.note,
  });
  return res.result.payment;
}

async function getPayment(params: { paymentId: string }): Promise<any> {
  const res = await client.paymentsApi.getPayment(params.paymentId);
  return res.result.payment;
}

async function listPayments(params: { beginTime?: string; endTime?: string; locationId?: string; limit?: number }): Promise<any> {
  const res = await client.paymentsApi.listPayments(params.beginTime, params.endTime, undefined, undefined, undefined, params.locationId, undefined, params.limit);
  return { payments: res.result.payments };
}

async function cancelPayment(params: { paymentId: string }): Promise<any> {
  const res = await client.paymentsApi.cancelPayment(params.paymentId);
  return res.result.payment;
}

async function refundPayment(params: { paymentId: string; amountMoney: { amount: number; currency: string }; idempotencyKey: string; reason?: string }): Promise<any> {
  const res = await client.refundsApi.refundPayment({
    paymentId: params.paymentId,
    amountMoney: { amount: BigInt(params.amountMoney.amount), currency: params.amountMoney.currency },
    idempotencyKey: params.idempotencyKey,
    reason: params.reason,
  });
  return res.result.refund;
}

async function createOrder(params: { locationId: string; lineItems: any[]; customerId?: string; idempotencyKey: string }): Promise<any> {
  const res = await client.ordersApi.createOrder({
    order: { locationId: params.locationId, lineItems: params.lineItems, customerId: params.customerId },
    idempotencyKey: params.idempotencyKey,
  });
  return res.result.order;
}

async function getOrder(params: { orderId: string }): Promise<any> {
  const res = await client.ordersApi.retrieveOrder(params.orderId);
  return res.result.order;
}

async function searchOrders(params: { locationIds: string[]; query?: any; limit?: number }): Promise<any> {
  const res = await client.ordersApi.searchOrders({ locationIds: params.locationIds, query: params.query, limit: params.limit });
  return { orders: res.result.orders };
}

async function updateOrder(params: { orderId: string; fieldsToClear?: string[]; idempotencyKey: string }): Promise<any> {
  const res = await client.ordersApi.updateOrder(params.orderId, { fieldsToClear: params.fieldsToClear, idempotencyKey: params.idempotencyKey });
  return res.result.order;
}

async function payOrder(params: { orderId: string; paymentIds: string[]; idempotencyKey: string }): Promise<any> {
  const res = await client.ordersApi.payOrder(params.orderId, { paymentIds: params.paymentIds, idempotencyKey: params.idempotencyKey });
  return res.result.order;
}

async function createCustomer(params: { givenName?: string; familyName?: string; emailAddress?: string; phoneNumber?: string; note?: string; idempotencyKey: string }): Promise<any> {
  const res = await client.customersApi.createCustomer({
    givenName: params.givenName,
    familyName: params.familyName,
    emailAddress: params.emailAddress,
    phoneNumber: params.phoneNumber,
    note: params.note,
    idempotencyKey: params.idempotencyKey,
  });
  return res.result.customer;
}

async function getCustomer(params: { customerId: string }): Promise<any> {
  const res = await client.customersApi.retrieveCustomer(params.customerId);
  return res.result.customer;
}

async function searchCustomers(params: { query?: any; limit?: number }): Promise<any> {
  const res = await client.customersApi.searchCustomers({ query: params.query, limit: params.limit });
  return { customers: res.result.customers };
}

async function updateCustomer(params: { customerId: string; givenName?: string; familyName?: string; emailAddress?: string; phoneNumber?: string; note?: string }): Promise<any> {
  const res = await client.customersApi.updateCustomer(params.customerId, {
    givenName: params.givenName,
    familyName: params.familyName,
    emailAddress: params.emailAddress,
    phoneNumber: params.phoneNumber,
    note: params.note,
  });
  return res.result.customer;
}

async function deleteCustomer(params: { customerId: string }): Promise<any> {
  await client.customersApi.deleteCustomer(params.customerId);
  return { customerId: params.customerId, deleted: true };
}

async function listCatalog(params: { types?: string[]; cursor?: string }): Promise<any> {
  const res = await client.catalogApi.listCatalog(params.cursor, params.types?.join(","));
  return { objects: res.result.objects, cursor: res.result.cursor };
}

async function getCatalogItem(params: { objectId: string }): Promise<any> {
  const res = await client.catalogApi.retrieveCatalogObject(params.objectId);
  return res.result.object;
}

async function searchCatalog(params: { objectTypes?: string[]; query?: any; limit?: number }): Promise<any> {
  const res = await client.catalogApi.searchCatalogObjects({ objectTypes: params.objectTypes, query: params.query, limit: params.limit });
  return { objects: res.result.objects };
}

async function upsertCatalogItem(params: { object: any; idempotencyKey: string }): Promise<any> {
  const res = await client.catalogApi.upsertCatalogObject({ object: params.object, idempotencyKey: params.idempotencyKey });
  return res.result.catalogObject;
}

async function deleteCatalogItem(params: { objectId: string }): Promise<any> {
  const res = await client.catalogApi.deleteCatalogObject(params.objectId);
  return { deletedObjectIds: res.result.deletedObjectIds };
}

async function getInventoryCount(params: { catalogObjectId: string; locationIds?: string[] }): Promise<any> {
  const res = await client.inventoryApi.retrieveInventoryCount(params.catalogObjectId, params.locationIds?.join(","));
  return { counts: res.result.counts };
}

async function batchChangeInventory(params: { changes: any[]; idempotencyKey: string }): Promise<any> {
  const res = await client.inventoryApi.batchChangeInventory({ changes: params.changes, idempotencyKey: params.idempotencyKey });
  return { counts: res.result.counts };
}

async function listLocations(): Promise<any> {
  const res = await client.locationsApi.listLocations();
  return { locations: res.result.locations };
}

async function getLocation(params: { locationId: string }): Promise<any> {
  const res = await client.locationsApi.retrieveLocation(params.locationId);
  return res.result.location;
}

async function createInvoice(params: { invoice: any; idempotencyKey: string }): Promise<any> {
  const res = await client.invoicesApi.createInvoice({ invoice: params.invoice, idempotencyKey: params.idempotencyKey });
  return res.result.invoice;
}

async function getInvoice(params: { invoiceId: string }): Promise<any> {
  const res = await client.invoicesApi.getInvoice(params.invoiceId);
  return res.result.invoice;
}

async function listInvoices(params: { locationId: string; cursor?: string; limit?: number }): Promise<any> {
  const res = await client.invoicesApi.listInvoices(params.locationId, params.cursor, params.limit);
  return { invoices: res.result.invoices, cursor: res.result.cursor };
}

async function publishInvoice(params: { invoiceId: string; version: number; idempotencyKey: string }): Promise<any> {
  const res = await client.invoicesApi.publishInvoice(params.invoiceId, { version: params.version, idempotencyKey: params.idempotencyKey });
  return res.result.invoice;
}

async function createSubscription(params: { locationId: string; customerId: string; planId: string; idempotencyKey: string }): Promise<any> {
  const res = await client.subscriptionsApi.createSubscription({
    locationId: params.locationId,
    customerId: params.customerId,
    planVariationId: params.planId,
    idempotencyKey: params.idempotencyKey,
  });
  return res.result.subscription;
}

async function getSubscription(params: { subscriptionId: string }): Promise<any> {
  const res = await client.subscriptionsApi.retrieveSubscription(params.subscriptionId);
  return res.result.subscription;
}

async function cancelSubscription(params: { subscriptionId: string }): Promise<any> {
  const res = await client.subscriptionsApi.cancelSubscription(params.subscriptionId);
  return res.result.subscription;
}

const server = new Server({ name: "square-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "create_payment": result = await createPayment(args as any); break;
      case "get_payment": result = await getPayment(args as any); break;
      case "list_payments": result = await listPayments(args as any); break;
      case "cancel_payment": result = await cancelPayment(args as any); break;
      case "refund_payment": result = await refundPayment(args as any); break;
      case "create_order": result = await createOrder(args as any); break;
      case "get_order": result = await getOrder(args as any); break;
      case "search_orders": result = await searchOrders(args as any); break;
      case "update_order": result = await updateOrder(args as any); break;
      case "pay_order": result = await payOrder(args as any); break;
      case "create_customer": result = await createCustomer(args as any); break;
      case "get_customer": result = await getCustomer(args as any); break;
      case "search_customers": result = await searchCustomers(args as any); break;
      case "update_customer": result = await updateCustomer(args as any); break;
      case "delete_customer": result = await deleteCustomer(args as any); break;
      case "list_catalog": result = await listCatalog(args as any); break;
      case "get_catalog_item": result = await getCatalogItem(args as any); break;
      case "search_catalog": result = await searchCatalog(args as any); break;
      case "upsert_catalog_item": result = await upsertCatalogItem(args as any); break;
      case "delete_catalog_item": result = await deleteCatalogItem(args as any); break;
      case "get_inventory_count": result = await getInventoryCount(args as any); break;
      case "batch_change_inventory": result = await batchChangeInventory(args as any); break;
      case "list_locations": result = await listLocations(); break;
      case "get_location": result = await getLocation(args as any); break;
      case "create_invoice": result = await createInvoice(args as any); break;
      case "get_invoice": result = await getInvoice(args as any); break;
      case "list_invoices": result = await listInvoices(args as any); break;
      case "publish_invoice": result = await publishInvoice(args as any); break;
      case "create_subscription": result = await createSubscription(args as any); break;
      case "get_subscription": result = await getSubscription(args as any); break;
      case "cancel_subscription": result = await cancelSubscription(args as any); break;
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
  console.error("Square MCP Server running on stdio");
}

main().catch(console.error);
