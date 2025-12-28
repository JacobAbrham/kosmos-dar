/**
 * Stripe MCP Server
 *
 * Provides Stripe payment operations for KOSMOS agents.
 * Features:
 * - Customer management
 * - Payment intents and charges
 * - Subscriptions and billing
 * - Invoices and refunds
 * - Product and price management
 *
 * Authentication: Uses Stripe API Key.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import Stripe from "stripe";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  secretKey: process.env.STRIPE_SECRET_KEY || "",
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
};

const stripe = new Stripe(config.secretKey, { apiVersion: "2023-10-16" });

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Customer operations
  {
    name: "list_customers",
    description: "List customers with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Filter by email" },
        limit: { type: "number", description: "Max results (1-100)" },
        startingAfter: { type: "string", description: "Pagination cursor" },
      },
    },
  },
  {
    name: "get_customer",
    description: "Get a customer by ID.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "Customer ID" },
      },
      required: ["customerId"],
    },
  },
  {
    name: "create_customer",
    description: "Create a new customer.",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Customer email" },
        name: { type: "string", description: "Customer name" },
        phone: { type: "string", description: "Customer phone" },
        description: { type: "string", description: "Description" },
        metadata: { type: "object", description: "Custom metadata" },
        paymentMethod: { type: "string", description: "Default payment method ID" },
      },
      required: ["email"],
    },
  },
  {
    name: "update_customer",
    description: "Update a customer.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "Customer ID" },
        email: { type: "string", description: "New email" },
        name: { type: "string", description: "New name" },
        phone: { type: "string", description: "New phone" },
        description: { type: "string", description: "New description" },
        metadata: { type: "object", description: "New metadata" },
      },
      required: ["customerId"],
    },
  },
  {
    name: "delete_customer",
    description: "Delete a customer.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "Customer ID" },
      },
      required: ["customerId"],
    },
  },
  // Payment Intent operations
  {
    name: "create_payment_intent",
    description: "Create a payment intent.",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Amount in cents" },
        currency: { type: "string", description: "Currency code (e.g., 'usd')" },
        customerId: { type: "string", description: "Customer ID" },
        paymentMethod: { type: "string", description: "Payment method ID" },
        description: { type: "string", description: "Payment description" },
        metadata: { type: "object", description: "Custom metadata" },
        confirm: { type: "boolean", description: "Confirm immediately" },
        receiptEmail: { type: "string", description: "Email for receipt" },
      },
      required: ["amount", "currency"],
    },
  },
  {
    name: "get_payment_intent",
    description: "Get a payment intent.",
    inputSchema: {
      type: "object",
      properties: {
        paymentIntentId: { type: "string", description: "Payment intent ID" },
      },
      required: ["paymentIntentId"],
    },
  },
  {
    name: "confirm_payment_intent",
    description: "Confirm a payment intent.",
    inputSchema: {
      type: "object",
      properties: {
        paymentIntentId: { type: "string", description: "Payment intent ID" },
        paymentMethod: { type: "string", description: "Payment method ID" },
      },
      required: ["paymentIntentId"],
    },
  },
  {
    name: "cancel_payment_intent",
    description: "Cancel a payment intent.",
    inputSchema: {
      type: "object",
      properties: {
        paymentIntentId: { type: "string", description: "Payment intent ID" },
        reason: {
          type: "string",
          enum: ["duplicate", "fraudulent", "requested_by_customer", "abandoned"],
          description: "Cancellation reason",
        },
      },
      required: ["paymentIntentId"],
    },
  },
  // Subscription operations
  {
    name: "list_subscriptions",
    description: "List subscriptions.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "Filter by customer" },
        priceId: { type: "string", description: "Filter by price" },
        status: {
          type: "string",
          enum: ["active", "past_due", "canceled", "unpaid", "trialing", "all"],
          description: "Filter by status",
        },
        limit: { type: "number", description: "Max results" },
      },
    },
  },
  {
    name: "create_subscription",
    description: "Create a subscription.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "Customer ID" },
        priceId: { type: "string", description: "Price ID" },
        quantity: { type: "number", description: "Quantity" },
        trialDays: { type: "number", description: "Trial period days" },
        metadata: { type: "object", description: "Custom metadata" },
        paymentBehavior: {
          type: "string",
          enum: ["default_incomplete", "error_if_incomplete", "allow_incomplete", "pending_if_incomplete"],
        },
      },
      required: ["customerId", "priceId"],
    },
  },
  {
    name: "update_subscription",
    description: "Update a subscription.",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: { type: "string", description: "Subscription ID" },
        priceId: { type: "string", description: "New price ID" },
        quantity: { type: "number", description: "New quantity" },
        cancelAtPeriodEnd: { type: "boolean", description: "Cancel at period end" },
        metadata: { type: "object", description: "New metadata" },
      },
      required: ["subscriptionId"],
    },
  },
  {
    name: "cancel_subscription",
    description: "Cancel a subscription.",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: { type: "string", description: "Subscription ID" },
        immediately: { type: "boolean", description: "Cancel immediately vs at period end" },
      },
      required: ["subscriptionId"],
    },
  },
  // Invoice operations
  {
    name: "list_invoices",
    description: "List invoices.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "Filter by customer" },
        subscriptionId: { type: "string", description: "Filter by subscription" },
        status: {
          type: "string",
          enum: ["draft", "open", "paid", "uncollectible", "void"],
        },
        limit: { type: "number", description: "Max results" },
      },
    },
  },
  {
    name: "get_invoice",
    description: "Get an invoice.",
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: { type: "string", description: "Invoice ID" },
      },
      required: ["invoiceId"],
    },
  },
  {
    name: "pay_invoice",
    description: "Pay an invoice.",
    inputSchema: {
      type: "object",
      properties: {
        invoiceId: { type: "string", description: "Invoice ID" },
        paymentMethod: { type: "string", description: "Payment method ID" },
      },
      required: ["invoiceId"],
    },
  },
  // Refund operations
  {
    name: "create_refund",
    description: "Create a refund.",
    inputSchema: {
      type: "object",
      properties: {
        paymentIntentId: { type: "string", description: "Payment intent ID" },
        chargeId: { type: "string", description: "Charge ID (alternative to paymentIntentId)" },
        amount: { type: "number", description: "Amount in cents (partial refund)" },
        reason: {
          type: "string",
          enum: ["duplicate", "fraudulent", "requested_by_customer"],
        },
        metadata: { type: "object", description: "Custom metadata" },
      },
    },
  },
  {
    name: "list_refunds",
    description: "List refunds.",
    inputSchema: {
      type: "object",
      properties: {
        paymentIntentId: { type: "string", description: "Filter by payment intent" },
        chargeId: { type: "string", description: "Filter by charge" },
        limit: { type: "number", description: "Max results" },
      },
    },
  },
  // Product and Price operations
  {
    name: "list_products",
    description: "List products.",
    inputSchema: {
      type: "object",
      properties: {
        active: { type: "boolean", description: "Filter by active status" },
        limit: { type: "number", description: "Max results" },
      },
    },
  },
  {
    name: "create_product",
    description: "Create a product.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Product name" },
        description: { type: "string", description: "Description" },
        active: { type: "boolean", description: "Is active" },
        metadata: { type: "object", description: "Custom metadata" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_prices",
    description: "List prices.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Filter by product" },
        active: { type: "boolean", description: "Filter by active status" },
        limit: { type: "number", description: "Max results" },
      },
    },
  },
  {
    name: "create_price",
    description: "Create a price.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Product ID" },
        unitAmount: { type: "number", description: "Price in cents" },
        currency: { type: "string", description: "Currency code" },
        recurring: {
          type: "object",
          properties: {
            interval: { type: "string", enum: ["day", "week", "month", "year"] },
            intervalCount: { type: "number" },
          },
          description: "Recurring settings (for subscriptions)",
        },
        metadata: { type: "object", description: "Custom metadata" },
      },
      required: ["productId", "unitAmount", "currency"],
    },
  },
  // Balance operations
  {
    name: "get_balance",
    description: "Get account balance.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  // Charge operations
  {
    name: "list_charges",
    description: "List charges with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "Filter by customer ID" },
        paymentIntentId: { type: "string", description: "Filter by payment intent" },
        limit: { type: "number", description: "Max results (1-100)" },
        startingAfter: { type: "string", description: "Pagination cursor" },
      },
    },
  },
  {
    name: "get_charge",
    description: "Get a charge by ID.",
    inputSchema: {
      type: "object",
      properties: {
        chargeId: { type: "string", description: "Charge ID" },
      },
      required: ["chargeId"],
    },
  },
  {
    name: "create_charge",
    description: "Create a charge (legacy - prefer payment intents).",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Amount in cents" },
        currency: { type: "string", description: "Currency code (e.g., 'usd')" },
        customerId: { type: "string", description: "Customer ID" },
        source: { type: "string", description: "Payment source (token or source ID)" },
        description: { type: "string", description: "Charge description" },
        metadata: { type: "object", description: "Custom metadata" },
        receiptEmail: { type: "string", description: "Email for receipt" },
      },
      required: ["amount", "currency"],
    },
  },
  // Get subscription
  {
    name: "get_subscription",
    description: "Get a subscription by ID.",
    inputSchema: {
      type: "object",
      properties: {
        subscriptionId: { type: "string", description: "Subscription ID" },
      },
      required: ["subscriptionId"],
    },
  },
  // Create invoice
  {
    name: "create_invoice",
    description: "Create an invoice for a customer.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "Customer ID" },
        autoAdvance: { type: "boolean", description: "Auto-finalize invoice" },
        collectionMethod: {
          type: "string",
          enum: ["charge_automatically", "send_invoice"],
          description: "Collection method",
        },
        daysUntilDue: { type: "number", description: "Days until due (for send_invoice)" },
        description: { type: "string", description: "Invoice description" },
        metadata: { type: "object", description: "Custom metadata" },
      },
      required: ["customerId"],
    },
  },
  // List payment intents
  {
    name: "list_payment_intents",
    description: "List payment intents with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "Filter by customer ID" },
        limit: { type: "number", description: "Max results (1-100)" },
        startingAfter: { type: "string", description: "Pagination cursor" },
      },
    },
  },
  // Payout operations
  {
    name: "list_payouts",
    description: "List payouts with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pending", "paid", "failed", "canceled"],
          description: "Filter by status",
        },
        limit: { type: "number", description: "Max results (1-100)" },
        startingAfter: { type: "string", description: "Pagination cursor" },
      },
    },
  },
];

// =============================================================================
// Tool Implementations
// =============================================================================

async function listCustomers(params: {
  email?: string;
  limit?: number;
  startingAfter?: string;
}): Promise<any> {
  const customers = await stripe.customers.list({
    email: params.email,
    limit: params.limit || 10,
    starting_after: params.startingAfter,
  });

  return {
    customers: customers.data.map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name,
      created: new Date(c.created * 1000).toISOString(),
      metadata: c.metadata,
    })),
    hasMore: customers.has_more,
  };
}

async function getCustomer(params: { customerId: string }): Promise<any> {
  const customer = await stripe.customers.retrieve(params.customerId);
  if (customer.deleted) {
    return { id: params.customerId, deleted: true };
  }
  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    description: customer.description,
    created: new Date(customer.created * 1000).toISOString(),
    metadata: customer.metadata,
    defaultSource: customer.default_source,
  };
}

async function createCustomer(params: {
  email: string;
  name?: string;
  phone?: string;
  description?: string;
  metadata?: Record<string, string>;
  paymentMethod?: string;
}): Promise<any> {
  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    phone: params.phone,
    description: params.description,
    metadata: params.metadata,
    payment_method: params.paymentMethod,
    invoice_settings: params.paymentMethod
      ? { default_payment_method: params.paymentMethod }
      : undefined,
  });

  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    created: true,
  };
}

async function updateCustomer(params: {
  customerId: string;
  email?: string;
  name?: string;
  phone?: string;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<any> {
  const { customerId, ...updateData } = params;
  const customer = await stripe.customers.update(customerId, updateData);

  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    updated: true,
  };
}

async function deleteCustomer(params: { customerId: string }): Promise<any> {
  await stripe.customers.del(params.customerId);
  return { id: params.customerId, deleted: true };
}

async function createPaymentIntent(params: {
  amount: number;
  currency: string;
  customerId?: string;
  paymentMethod?: string;
  description?: string;
  metadata?: Record<string, string>;
  confirm?: boolean;
  receiptEmail?: string;
}): Promise<any> {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: params.amount,
    currency: params.currency,
    customer: params.customerId,
    payment_method: params.paymentMethod,
    description: params.description,
    metadata: params.metadata,
    confirm: params.confirm,
    receipt_email: params.receiptEmail,
  });

  return {
    id: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: paymentIntent.status,
    clientSecret: paymentIntent.client_secret,
  };
}

async function getPaymentIntent(params: { paymentIntentId: string }): Promise<any> {
  const pi = await stripe.paymentIntents.retrieve(params.paymentIntentId);

  return {
    id: pi.id,
    amount: pi.amount,
    currency: pi.currency,
    status: pi.status,
    customer: pi.customer,
    paymentMethod: pi.payment_method,
    created: new Date(pi.created * 1000).toISOString(),
    metadata: pi.metadata,
  };
}

async function confirmPaymentIntent(params: {
  paymentIntentId: string;
  paymentMethod?: string;
}): Promise<any> {
  const pi = await stripe.paymentIntents.confirm(params.paymentIntentId, {
    payment_method: params.paymentMethod,
  });

  return {
    id: pi.id,
    status: pi.status,
    confirmed: pi.status === "succeeded",
  };
}

async function cancelPaymentIntent(params: {
  paymentIntentId: string;
  reason?: string;
}): Promise<any> {
  const pi = await stripe.paymentIntents.cancel(params.paymentIntentId, {
    cancellation_reason: params.reason as any,
  });

  return {
    id: pi.id,
    status: pi.status,
    canceled: true,
  };
}

async function listSubscriptions(params: {
  customerId?: string;
  priceId?: string;
  status?: string;
  limit?: number;
}): Promise<any> {
  const subscriptions = await stripe.subscriptions.list({
    customer: params.customerId,
    price: params.priceId,
    status: params.status as any,
    limit: params.limit || 10,
  });

  return {
    subscriptions: subscriptions.data.map((sub) => ({
      id: sub.id,
      customer: sub.customer,
      status: sub.status,
      currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
      items: sub.items.data.map((item) => ({
        id: item.id,
        priceId: item.price.id,
        quantity: item.quantity,
      })),
    })),
    hasMore: subscriptions.has_more,
  };
}

async function createSubscription(params: {
  customerId: string;
  priceId: string;
  quantity?: number;
  trialDays?: number;
  metadata?: Record<string, string>;
  paymentBehavior?: string;
}): Promise<any> {
  const subscription = await stripe.subscriptions.create({
    customer: params.customerId,
    items: [{ price: params.priceId, quantity: params.quantity || 1 }],
    trial_period_days: params.trialDays,
    metadata: params.metadata,
    payment_behavior: params.paymentBehavior as any,
  });

  return {
    id: subscription.id,
    status: subscription.status,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
  };
}

async function updateSubscription(params: {
  subscriptionId: string;
  priceId?: string;
  quantity?: number;
  cancelAtPeriodEnd?: boolean;
  metadata?: Record<string, string>;
}): Promise<any> {
  const updateData: Stripe.SubscriptionUpdateParams = {};

  if (params.priceId) {
    const sub = await stripe.subscriptions.retrieve(params.subscriptionId);
    updateData.items = [
      { id: sub.items.data[0].id, price: params.priceId, quantity: params.quantity },
    ];
  }
  if (params.cancelAtPeriodEnd !== undefined) {
    updateData.cancel_at_period_end = params.cancelAtPeriodEnd;
  }
  if (params.metadata) {
    updateData.metadata = params.metadata;
  }

  const subscription = await stripe.subscriptions.update(params.subscriptionId, updateData);

  return {
    id: subscription.id,
    status: subscription.status,
    updated: true,
  };
}

async function cancelSubscription(params: {
  subscriptionId: string;
  immediately?: boolean;
}): Promise<any> {
  let subscription;

  if (params.immediately) {
    subscription = await stripe.subscriptions.cancel(params.subscriptionId);
  } else {
    subscription = await stripe.subscriptions.update(params.subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  return {
    id: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

async function listInvoices(params: {
  customerId?: string;
  subscriptionId?: string;
  status?: string;
  limit?: number;
}): Promise<any> {
  const invoices = await stripe.invoices.list({
    customer: params.customerId,
    subscription: params.subscriptionId,
    status: params.status as any,
    limit: params.limit || 10,
  });

  return {
    invoices: invoices.data.map((inv) => ({
      id: inv.id,
      customer: inv.customer,
      status: inv.status,
      amountDue: inv.amount_due,
      amountPaid: inv.amount_paid,
      currency: inv.currency,
      created: new Date(inv.created * 1000).toISOString(),
      dueDate: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
      hostedInvoiceUrl: inv.hosted_invoice_url,
    })),
    hasMore: invoices.has_more,
  };
}

async function getInvoice(params: { invoiceId: string }): Promise<any> {
  const invoice = await stripe.invoices.retrieve(params.invoiceId);

  return {
    id: invoice.id,
    customer: invoice.customer,
    status: invoice.status,
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    amountRemaining: invoice.amount_remaining,
    currency: invoice.currency,
    lines: invoice.lines.data.map((line) => ({
      description: line.description,
      amount: line.amount,
      quantity: line.quantity,
    })),
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    invoicePdf: invoice.invoice_pdf,
  };
}

async function payInvoice(params: {
  invoiceId: string;
  paymentMethod?: string;
}): Promise<any> {
  const invoice = await stripe.invoices.pay(params.invoiceId, {
    payment_method: params.paymentMethod,
  });

  return {
    id: invoice.id,
    status: invoice.status,
    paid: invoice.paid,
  };
}

async function createRefund(params: {
  paymentIntentId?: string;
  chargeId?: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, string>;
}): Promise<any> {
  const refund = await stripe.refunds.create({
    payment_intent: params.paymentIntentId,
    charge: params.chargeId,
    amount: params.amount,
    reason: params.reason as any,
    metadata: params.metadata,
  });

  return {
    id: refund.id,
    amount: refund.amount,
    status: refund.status,
    currency: refund.currency,
  };
}

async function listRefunds(params: {
  paymentIntentId?: string;
  chargeId?: string;
  limit?: number;
}): Promise<any> {
  const refunds = await stripe.refunds.list({
    payment_intent: params.paymentIntentId,
    charge: params.chargeId,
    limit: params.limit || 10,
  });

  return {
    refunds: refunds.data.map((r) => ({
      id: r.id,
      amount: r.amount,
      status: r.status,
      currency: r.currency,
      created: new Date(r.created * 1000).toISOString(),
    })),
    hasMore: refunds.has_more,
  };
}

async function listProducts(params: { active?: boolean; limit?: number }): Promise<any> {
  const products = await stripe.products.list({
    active: params.active,
    limit: params.limit || 10,
  });

  return {
    products: products.data.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      active: p.active,
      metadata: p.metadata,
    })),
    hasMore: products.has_more,
  };
}

async function createProduct(params: {
  name: string;
  description?: string;
  active?: boolean;
  metadata?: Record<string, string>;
}): Promise<any> {
  const product = await stripe.products.create({
    name: params.name,
    description: params.description,
    active: params.active,
    metadata: params.metadata,
  });

  return {
    id: product.id,
    name: product.name,
    created: true,
  };
}

async function listPrices(params: {
  productId?: string;
  active?: boolean;
  limit?: number;
}): Promise<any> {
  const prices = await stripe.prices.list({
    product: params.productId,
    active: params.active,
    limit: params.limit || 10,
  });

  return {
    prices: prices.data.map((p) => ({
      id: p.id,
      product: p.product,
      unitAmount: p.unit_amount,
      currency: p.currency,
      recurring: p.recurring,
      active: p.active,
    })),
    hasMore: prices.has_more,
  };
}

async function createPrice(params: {
  productId: string;
  unitAmount: number;
  currency: string;
  recurring?: { interval: string; intervalCount?: number };
  metadata?: Record<string, string>;
}): Promise<any> {
  const price = await stripe.prices.create({
    product: params.productId,
    unit_amount: params.unitAmount,
    currency: params.currency,
    recurring: params.recurring as any,
    metadata: params.metadata,
  });

  return {
    id: price.id,
    unitAmount: price.unit_amount,
    currency: price.currency,
    created: true,
  };
}

async function getBalance(): Promise<any> {
  const balance = await stripe.balance.retrieve();

  return {
    available: balance.available.map((b) => ({
      amount: b.amount,
      currency: b.currency,
    })),
    pending: balance.pending.map((b) => ({
      amount: b.amount,
      currency: b.currency,
    })),
  };
}

async function listCharges(params: {
  customerId?: string;
  paymentIntentId?: string;
  limit?: number;
  startingAfter?: string;
}): Promise<any> {
  const charges = await stripe.charges.list({
    customer: params.customerId,
    payment_intent: params.paymentIntentId,
    limit: params.limit || 10,
    starting_after: params.startingAfter,
  });

  return {
    charges: charges.data.map((c) => ({
      id: c.id,
      amount: c.amount,
      currency: c.currency,
      status: c.status,
      customer: c.customer,
      description: c.description,
      paymentIntent: c.payment_intent,
      created: new Date(c.created * 1000).toISOString(),
      paid: c.paid,
      refunded: c.refunded,
      metadata: c.metadata,
    })),
    hasMore: charges.has_more,
  };
}

async function getCharge(params: { chargeId: string }): Promise<any> {
  const charge = await stripe.charges.retrieve(params.chargeId);

  return {
    id: charge.id,
    amount: charge.amount,
    amountRefunded: charge.amount_refunded,
    currency: charge.currency,
    status: charge.status,
    customer: charge.customer,
    description: charge.description,
    paymentIntent: charge.payment_intent,
    paymentMethod: charge.payment_method,
    receiptEmail: charge.receipt_email,
    receiptUrl: charge.receipt_url,
    created: new Date(charge.created * 1000).toISOString(),
    paid: charge.paid,
    refunded: charge.refunded,
    metadata: charge.metadata,
  };
}

async function createCharge(params: {
  amount: number;
  currency: string;
  customerId?: string;
  source?: string;
  description?: string;
  metadata?: Record<string, string>;
  receiptEmail?: string;
}): Promise<any> {
  const charge = await stripe.charges.create({
    amount: params.amount,
    currency: params.currency,
    customer: params.customerId,
    source: params.source,
    description: params.description,
    metadata: params.metadata,
    receipt_email: params.receiptEmail,
  });

  return {
    id: charge.id,
    amount: charge.amount,
    currency: charge.currency,
    status: charge.status,
    paid: charge.paid,
    created: true,
  };
}

async function getSubscription(params: { subscriptionId: string }): Promise<any> {
  const subscription = await stripe.subscriptions.retrieve(params.subscriptionId);

  return {
    id: subscription.id,
    customer: subscription.customer,
    status: subscription.status,
    currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    items: subscription.items.data.map((item) => ({
      id: item.id,
      priceId: item.price.id,
      quantity: item.quantity,
      productId: item.price.product,
    })),
    latestInvoice: subscription.latest_invoice,
    defaultPaymentMethod: subscription.default_payment_method,
    metadata: subscription.metadata,
  };
}

async function createInvoice(params: {
  customerId: string;
  autoAdvance?: boolean;
  collectionMethod?: string;
  daysUntilDue?: number;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<any> {
  const invoice = await stripe.invoices.create({
    customer: params.customerId,
    auto_advance: params.autoAdvance,
    collection_method: params.collectionMethod as any,
    days_until_due: params.daysUntilDue,
    description: params.description,
    metadata: params.metadata,
  });

  return {
    id: invoice.id,
    customer: invoice.customer,
    status: invoice.status,
    amountDue: invoice.amount_due,
    currency: invoice.currency,
    hostedInvoiceUrl: invoice.hosted_invoice_url,
    created: true,
  };
}

async function listPaymentIntents(params: {
  customerId?: string;
  limit?: number;
  startingAfter?: string;
}): Promise<any> {
  const paymentIntents = await stripe.paymentIntents.list({
    customer: params.customerId,
    limit: params.limit || 10,
    starting_after: params.startingAfter,
  });

  return {
    paymentIntents: paymentIntents.data.map((pi) => ({
      id: pi.id,
      amount: pi.amount,
      currency: pi.currency,
      status: pi.status,
      customer: pi.customer,
      description: pi.description,
      paymentMethod: pi.payment_method,
      created: new Date(pi.created * 1000).toISOString(),
      metadata: pi.metadata,
    })),
    hasMore: paymentIntents.has_more,
  };
}

async function listPayouts(params: {
  status?: string;
  limit?: number;
  startingAfter?: string;
}): Promise<any> {
  const payouts = await stripe.payouts.list({
    status: params.status as any,
    limit: params.limit || 10,
    starting_after: params.startingAfter,
  });

  return {
    payouts: payouts.data.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      arrivalDate: new Date(p.arrival_date * 1000).toISOString(),
      created: new Date(p.created * 1000).toISOString(),
      description: p.description,
      destination: p.destination,
      method: p.method,
      sourceType: p.source_type,
    })),
    hasMore: payouts.has_more,
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  { name: "stripe-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case "list_customers": result = await listCustomers(args as any); break;
      case "get_customer": result = await getCustomer(args as any); break;
      case "create_customer": result = await createCustomer(args as any); break;
      case "update_customer": result = await updateCustomer(args as any); break;
      case "delete_customer": result = await deleteCustomer(args as any); break;
      case "create_payment_intent": result = await createPaymentIntent(args as any); break;
      case "get_payment_intent": result = await getPaymentIntent(args as any); break;
      case "confirm_payment_intent": result = await confirmPaymentIntent(args as any); break;
      case "cancel_payment_intent": result = await cancelPaymentIntent(args as any); break;
      case "list_subscriptions": result = await listSubscriptions(args as any); break;
      case "create_subscription": result = await createSubscription(args as any); break;
      case "update_subscription": result = await updateSubscription(args as any); break;
      case "cancel_subscription": result = await cancelSubscription(args as any); break;
      case "list_invoices": result = await listInvoices(args as any); break;
      case "get_invoice": result = await getInvoice(args as any); break;
      case "pay_invoice": result = await payInvoice(args as any); break;
      case "create_refund": result = await createRefund(args as any); break;
      case "list_refunds": result = await listRefunds(args as any); break;
      case "list_products": result = await listProducts(args as any); break;
      case "create_product": result = await createProduct(args as any); break;
      case "list_prices": result = await listPrices(args as any); break;
      case "create_price": result = await createPrice(args as any); break;
      case "get_balance": result = await getBalance(); break;
      case "list_charges": result = await listCharges(args as any); break;
      case "get_charge": result = await getCharge(args as any); break;
      case "create_charge": result = await createCharge(args as any); break;
      case "get_subscription": result = await getSubscription(args as any); break;
      case "create_invoice": result = await createInvoice(args as any); break;
      case "list_payment_intents": result = await listPaymentIntents(args as any); break;
      case "list_payouts": result = await listPayouts(args as any); break;
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
  console.error("Stripe MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
