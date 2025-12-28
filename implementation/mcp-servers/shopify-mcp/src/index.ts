/**
 * Shopify MCP Server - E-commerce management for KOSMOS agents
 *
 * Provides comprehensive Shopify Admin API operations including:
 * - Product management (CRUD operations)
 * - Order management (list, create, update, cancel)
 * - Customer management
 * - Inventory management
 * - Collections, fulfillments, and transactions
 *
 * Authentication: Uses SHOPIFY_STORE and SHOPIFY_ACCESS_TOKEN environment variables.
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
  store: process.env.SHOPIFY_STORE || "",
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN || "",
  apiVersion: process.env.SHOPIFY_API_VERSION || "2024-01",
};

// =============================================================================
// Shopify API Client
// =============================================================================

async function shopifyRequest(
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const url = `https://${config.store}.myshopify.com/admin/api/${config.apiVersion}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      "X-Shopify-Access-Token": config.accessToken,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ errors: res.statusText }));
    throw new Error(
      typeof error.errors === "string"
        ? error.errors
        : JSON.stringify(error.errors)
    );
  }

  return res.status === 204 ? {} : res.json();
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Product operations
  {
    name: "list_products",
    description: "List products from the Shopify store with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of products to return (max 250)" },
        collection_id: { type: "string", description: "Filter by collection ID" },
        product_type: { type: "string", description: "Filter by product type" },
        vendor: { type: "string", description: "Filter by vendor" },
        status: {
          type: "string",
          enum: ["active", "archived", "draft"],
          description: "Filter by product status",
        },
        since_id: { type: "string", description: "Return products after this ID" },
      },
    },
  },
  {
    name: "get_product",
    description: "Get detailed information about a specific product.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "The product ID" },
      },
      required: ["productId"],
    },
  },
  {
    name: "create_product",
    description: "Create a new product in the Shopify store.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Product title" },
        body_html: { type: "string", description: "Product description in HTML" },
        vendor: { type: "string", description: "Product vendor" },
        product_type: { type: "string", description: "Product type/category" },
        tags: { type: "string", description: "Comma-separated tags" },
        status: {
          type: "string",
          enum: ["active", "archived", "draft"],
          description: "Product status",
        },
        variants: {
          type: "array",
          description: "Product variants with price, sku, etc.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              price: { type: "string" },
              sku: { type: "string" },
              inventory_quantity: { type: "number" },
            },
          },
        },
        images: {
          type: "array",
          description: "Product images",
          items: {
            type: "object",
            properties: {
              src: { type: "string", description: "Image URL" },
              alt: { type: "string", description: "Alt text" },
            },
          },
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_product",
    description: "Update an existing product.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "The product ID to update" },
        title: { type: "string", description: "New product title" },
        body_html: { type: "string", description: "New product description" },
        vendor: { type: "string", description: "New vendor" },
        product_type: { type: "string", description: "New product type" },
        tags: { type: "string", description: "New comma-separated tags" },
        status: {
          type: "string",
          enum: ["active", "archived", "draft"],
          description: "New product status",
        },
      },
      required: ["productId"],
    },
  },
  {
    name: "delete_product",
    description: "Delete a product from the store.",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "The product ID to delete" },
      },
      required: ["productId"],
    },
  },

  // Order operations
  {
    name: "list_orders",
    description: "List orders from the Shopify store with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["open", "closed", "cancelled", "any"],
          description: "Filter by order status",
        },
        financial_status: {
          type: "string",
          enum: ["pending", "authorized", "paid", "partially_paid", "refunded", "voided", "any"],
          description: "Filter by financial status",
        },
        fulfillment_status: {
          type: "string",
          enum: ["shipped", "partial", "unshipped", "any", "unfulfilled"],
          description: "Filter by fulfillment status",
        },
        limit: { type: "number", description: "Maximum number of orders to return" },
        since_id: { type: "string", description: "Return orders after this ID" },
        created_at_min: { type: "string", description: "Minimum creation date (ISO 8601)" },
        created_at_max: { type: "string", description: "Maximum creation date (ISO 8601)" },
      },
    },
  },
  {
    name: "get_order",
    description: "Get detailed information about a specific order.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID" },
      },
      required: ["orderId"],
    },
  },
  {
    name: "create_order",
    description: "Create a new draft order.",
    inputSchema: {
      type: "object",
      properties: {
        line_items: {
          type: "array",
          description: "Order line items",
          items: {
            type: "object",
            properties: {
              variant_id: { type: "number", description: "Product variant ID" },
              quantity: { type: "number", description: "Quantity" },
              title: { type: "string", description: "Line item title" },
              price: { type: "string", description: "Price per item" },
            },
          },
        },
        customer: {
          type: "object",
          description: "Customer information",
          properties: {
            id: { type: "number", description: "Existing customer ID" },
            email: { type: "string", description: "Customer email" },
            first_name: { type: "string", description: "First name" },
            last_name: { type: "string", description: "Last name" },
          },
        },
        financial_status: { type: "string", description: "Financial status" },
        fulfillment_status: { type: "string", description: "Fulfillment status" },
        note: { type: "string", description: "Order note" },
        tags: { type: "string", description: "Comma-separated tags" },
        shipping_address: {
          type: "object",
          description: "Shipping address",
          properties: {
            first_name: { type: "string" },
            last_name: { type: "string" },
            address1: { type: "string" },
            city: { type: "string" },
            province: { type: "string" },
            country: { type: "string" },
            zip: { type: "string" },
          },
        },
      },
      required: ["line_items"],
    },
  },
  {
    name: "update_order",
    description: "Update an existing order.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID to update" },
        note: { type: "string", description: "New order note" },
        tags: { type: "string", description: "New comma-separated tags" },
        email: { type: "string", description: "New customer email" },
        shipping_address: {
          type: "object",
          description: "New shipping address",
        },
      },
      required: ["orderId"],
    },
  },
  {
    name: "cancel_order",
    description: "Cancel an order.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID to cancel" },
        reason: {
          type: "string",
          enum: ["customer", "fraud", "inventory", "declined", "other"],
          description: "Cancellation reason",
        },
        email: { type: "boolean", description: "Send cancellation email to customer" },
        restock: { type: "boolean", description: "Restock inventory items" },
      },
      required: ["orderId"],
    },
  },

  // Customer operations
  {
    name: "list_customers",
    description: "List customers from the Shopify store.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of customers to return" },
        created_at_min: { type: "string", description: "Minimum creation date (ISO 8601)" },
        updated_at_min: { type: "string", description: "Minimum update date (ISO 8601)" },
        since_id: { type: "string", description: "Return customers after this ID" },
      },
    },
  },
  {
    name: "get_customer",
    description: "Get detailed information about a specific customer.",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string", description: "The customer ID" },
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
        email: { type: "string", description: "Customer email address" },
        first_name: { type: "string", description: "First name" },
        last_name: { type: "string", description: "Last name" },
        phone: { type: "string", description: "Phone number" },
        tags: { type: "string", description: "Comma-separated tags" },
        note: { type: "string", description: "Customer note" },
        addresses: {
          type: "array",
          description: "Customer addresses",
          items: {
            type: "object",
            properties: {
              address1: { type: "string" },
              city: { type: "string" },
              province: { type: "string" },
              country: { type: "string" },
              zip: { type: "string" },
            },
          },
        },
        verified_email: { type: "boolean", description: "Whether email is verified" },
        send_email_welcome: { type: "boolean", description: "Send welcome email" },
      },
      required: ["email"],
    },
  },

  // Inventory operations
  {
    name: "list_inventory_items",
    description: "List inventory items with their stock levels.",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "string", description: "Comma-separated inventory item IDs" },
        limit: { type: "number", description: "Maximum number of items to return" },
      },
    },
  },
  {
    name: "update_inventory",
    description: "Update inventory level for an item at a location.",
    inputSchema: {
      type: "object",
      properties: {
        inventory_item_id: { type: "string", description: "Inventory item ID" },
        location_id: { type: "string", description: "Location ID" },
        available: { type: "number", description: "New available quantity (absolute)" },
        adjustment: { type: "number", description: "Quantity adjustment (relative, use instead of available)" },
      },
      required: ["inventory_item_id", "location_id"],
    },
  },

  // Collection operations
  {
    name: "list_collections",
    description: "List product collections.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of collections to return" },
        since_id: { type: "string", description: "Return collections after this ID" },
        title: { type: "string", description: "Filter by title" },
        product_id: { type: "string", description: "Return collections containing this product" },
      },
    },
  },

  // Fulfillment operations
  {
    name: "list_fulfillments",
    description: "List fulfillments for an order.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID" },
      },
      required: ["orderId"],
    },
  },
  {
    name: "create_fulfillment",
    description: "Create a fulfillment for an order.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID" },
        tracking_number: { type: "string", description: "Tracking number" },
        tracking_company: { type: "string", description: "Shipping carrier name" },
        tracking_url: { type: "string", description: "Tracking URL" },
        line_items: {
          type: "array",
          description: "Line items to fulfill",
          items: {
            type: "object",
            properties: {
              id: { type: "number", description: "Line item ID" },
              quantity: { type: "number", description: "Quantity to fulfill" },
            },
          },
        },
        notify_customer: { type: "boolean", description: "Send notification to customer" },
      },
      required: ["orderId"],
    },
  },

  // Transaction operations
  {
    name: "list_transactions",
    description: "List transactions for an order.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID" },
        since_id: { type: "string", description: "Return transactions after this ID" },
      },
      required: ["orderId"],
    },
  },

  // Shop operations
  {
    name: "get_shop",
    description: "Get information about the Shopify shop.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// =============================================================================
// Tool Implementations
// =============================================================================

// Product operations
async function listProducts(params: {
  limit?: number;
  collection_id?: string;
  product_type?: string;
  vendor?: string;
  status?: string;
  since_id?: string;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", params.limit.toString());
  if (params.collection_id) query.set("collection_id", params.collection_id);
  if (params.product_type) query.set("product_type", params.product_type);
  if (params.vendor) query.set("vendor", params.vendor);
  if (params.status) query.set("status", params.status);
  if (params.since_id) query.set("since_id", params.since_id);

  const queryStr = query.toString() ? `?${query}` : "";
  const res = await shopifyRequest("GET", `/products.json${queryStr}`);

  return {
    products: res.products.map((p: any) => ({
      id: p.id,
      title: p.title,
      vendor: p.vendor,
      product_type: p.product_type,
      status: p.status,
      tags: p.tags,
      variants_count: p.variants?.length || 0,
      created_at: p.created_at,
      updated_at: p.updated_at,
    })),
    count: res.products.length,
  };
}

async function getProduct(params: { productId: string }): Promise<any> {
  const res = await shopifyRequest("GET", `/products/${params.productId}.json`);
  return res.product;
}

async function createProduct(params: any): Promise<any> {
  const res = await shopifyRequest("POST", "/products.json", { product: params });
  return {
    id: res.product.id,
    title: res.product.title,
    status: res.product.status,
    created_at: res.product.created_at,
    variants: res.product.variants?.map((v: any) => ({
      id: v.id,
      title: v.title,
      price: v.price,
      sku: v.sku,
    })),
  };
}

async function updateProduct(params: {
  productId: string;
  [key: string]: any;
}): Promise<any> {
  const { productId, ...updates } = params;
  const res = await shopifyRequest("PUT", `/products/${productId}.json`, {
    product: updates,
  });
  return {
    id: res.product.id,
    title: res.product.title,
    status: res.product.status,
    updated_at: res.product.updated_at,
  };
}

async function deleteProduct(params: { productId: string }): Promise<any> {
  await shopifyRequest("DELETE", `/products/${params.productId}.json`);
  return { productId: params.productId, deleted: true };
}

// Order operations
async function listOrders(params: {
  status?: string;
  financial_status?: string;
  fulfillment_status?: string;
  limit?: number;
  since_id?: string;
  created_at_min?: string;
  created_at_max?: string;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.financial_status) query.set("financial_status", params.financial_status);
  if (params.fulfillment_status) query.set("fulfillment_status", params.fulfillment_status);
  if (params.limit) query.set("limit", params.limit.toString());
  if (params.since_id) query.set("since_id", params.since_id);
  if (params.created_at_min) query.set("created_at_min", params.created_at_min);
  if (params.created_at_max) query.set("created_at_max", params.created_at_max);

  const queryStr = query.toString() ? `?${query}` : "";
  const res = await shopifyRequest("GET", `/orders.json${queryStr}`);

  return {
    orders: res.orders.map((o: any) => ({
      id: o.id,
      order_number: o.order_number,
      email: o.email,
      financial_status: o.financial_status,
      fulfillment_status: o.fulfillment_status,
      total_price: o.total_price,
      currency: o.currency,
      created_at: o.created_at,
      line_items_count: o.line_items?.length || 0,
    })),
    count: res.orders.length,
  };
}

async function getOrder(params: { orderId: string }): Promise<any> {
  const res = await shopifyRequest("GET", `/orders/${params.orderId}.json`);
  return res.order;
}

async function createOrder(params: any): Promise<any> {
  const res = await shopifyRequest("POST", "/orders.json", { order: params });
  return {
    id: res.order.id,
    order_number: res.order.order_number,
    email: res.order.email,
    total_price: res.order.total_price,
    financial_status: res.order.financial_status,
    created_at: res.order.created_at,
  };
}

async function updateOrder(params: {
  orderId: string;
  [key: string]: any;
}): Promise<any> {
  const { orderId, ...updates } = params;
  const res = await shopifyRequest("PUT", `/orders/${orderId}.json`, {
    order: updates,
  });
  return {
    id: res.order.id,
    order_number: res.order.order_number,
    updated_at: res.order.updated_at,
  };
}

async function cancelOrder(params: {
  orderId: string;
  reason?: string;
  email?: boolean;
  restock?: boolean;
}): Promise<any> {
  const res = await shopifyRequest("POST", `/orders/${params.orderId}/cancel.json`, {
    reason: params.reason,
    email: params.email,
    restock: params.restock,
  });
  return {
    id: res.order.id,
    order_number: res.order.order_number,
    cancelled_at: res.order.cancelled_at,
    cancel_reason: res.order.cancel_reason,
  };
}

// Customer operations
async function listCustomers(params: {
  limit?: number;
  created_at_min?: string;
  updated_at_min?: string;
  since_id?: string;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", params.limit.toString());
  if (params.created_at_min) query.set("created_at_min", params.created_at_min);
  if (params.updated_at_min) query.set("updated_at_min", params.updated_at_min);
  if (params.since_id) query.set("since_id", params.since_id);

  const queryStr = query.toString() ? `?${query}` : "";
  const res = await shopifyRequest("GET", `/customers.json${queryStr}`);

  return {
    customers: res.customers.map((c: any) => ({
      id: c.id,
      email: c.email,
      first_name: c.first_name,
      last_name: c.last_name,
      orders_count: c.orders_count,
      total_spent: c.total_spent,
      created_at: c.created_at,
    })),
    count: res.customers.length,
  };
}

async function getCustomer(params: { customerId: string }): Promise<any> {
  const res = await shopifyRequest("GET", `/customers/${params.customerId}.json`);
  return res.customer;
}

async function createCustomer(params: any): Promise<any> {
  const res = await shopifyRequest("POST", "/customers.json", { customer: params });
  return {
    id: res.customer.id,
    email: res.customer.email,
    first_name: res.customer.first_name,
    last_name: res.customer.last_name,
    created_at: res.customer.created_at,
  };
}

// Inventory operations
async function listInventoryItems(params: {
  ids?: string;
  limit?: number;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.ids) query.set("ids", params.ids);
  if (params.limit) query.set("limit", params.limit.toString());

  const queryStr = query.toString() ? `?${query}` : "";
  const res = await shopifyRequest("GET", `/inventory_items.json${queryStr}`);

  return {
    inventory_items: res.inventory_items.map((item: any) => ({
      id: item.id,
      sku: item.sku,
      tracked: item.tracked,
      requires_shipping: item.requires_shipping,
      created_at: item.created_at,
      updated_at: item.updated_at,
    })),
    count: res.inventory_items.length,
  };
}

async function updateInventory(params: {
  inventory_item_id: string;
  location_id: string;
  available?: number;
  adjustment?: number;
}): Promise<any> {
  if (params.adjustment !== undefined) {
    // Use adjust endpoint for relative changes
    const res = await shopifyRequest("POST", "/inventory_levels/adjust.json", {
      inventory_item_id: params.inventory_item_id,
      location_id: params.location_id,
      available_adjustment: params.adjustment,
    });
    return {
      inventory_item_id: res.inventory_level.inventory_item_id,
      location_id: res.inventory_level.location_id,
      available: res.inventory_level.available,
      updated: true,
    };
  } else if (params.available !== undefined) {
    // Use set endpoint for absolute values
    const res = await shopifyRequest("POST", "/inventory_levels/set.json", {
      inventory_item_id: params.inventory_item_id,
      location_id: params.location_id,
      available: params.available,
    });
    return {
      inventory_item_id: res.inventory_level.inventory_item_id,
      location_id: res.inventory_level.location_id,
      available: res.inventory_level.available,
      updated: true,
    };
  } else {
    throw new Error("Either 'available' or 'adjustment' must be provided");
  }
}

// Collection operations
async function listCollections(params: {
  limit?: number;
  since_id?: string;
  title?: string;
  product_id?: string;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", params.limit.toString());
  if (params.since_id) query.set("since_id", params.since_id);
  if (params.title) query.set("title", params.title);
  if (params.product_id) query.set("product_id", params.product_id);

  const queryStr = query.toString() ? `?${query}` : "";

  // Get both custom collections and smart collections
  const [customRes, smartRes] = await Promise.all([
    shopifyRequest("GET", `/custom_collections.json${queryStr}`),
    shopifyRequest("GET", `/smart_collections.json${queryStr}`),
  ]);

  const collections = [
    ...customRes.custom_collections.map((c: any) => ({ ...c, type: "custom" })),
    ...smartRes.smart_collections.map((c: any) => ({ ...c, type: "smart" })),
  ];

  return {
    collections: collections.map((c: any) => ({
      id: c.id,
      title: c.title,
      handle: c.handle,
      type: c.type,
      products_count: c.products_count,
      published_at: c.published_at,
    })),
    count: collections.length,
  };
}

// Fulfillment operations
async function listFulfillments(params: { orderId: string }): Promise<any> {
  const res = await shopifyRequest(
    "GET",
    `/orders/${params.orderId}/fulfillments.json`
  );

  return {
    fulfillments: res.fulfillments.map((f: any) => ({
      id: f.id,
      order_id: f.order_id,
      status: f.status,
      tracking_number: f.tracking_number,
      tracking_company: f.tracking_company,
      tracking_url: f.tracking_url,
      created_at: f.created_at,
      line_items_count: f.line_items?.length || 0,
    })),
    count: res.fulfillments.length,
  };
}

async function createFulfillment(params: {
  orderId: string;
  tracking_number?: string;
  tracking_company?: string;
  tracking_url?: string;
  line_items?: any[];
  notify_customer?: boolean;
}): Promise<any> {
  const res = await shopifyRequest(
    "POST",
    `/orders/${params.orderId}/fulfillments.json`,
    {
      fulfillment: {
        tracking_number: params.tracking_number,
        tracking_company: params.tracking_company,
        tracking_url: params.tracking_url,
        line_items: params.line_items,
        notify_customer: params.notify_customer,
      },
    }
  );

  return {
    id: res.fulfillment.id,
    order_id: res.fulfillment.order_id,
    status: res.fulfillment.status,
    tracking_number: res.fulfillment.tracking_number,
    tracking_company: res.fulfillment.tracking_company,
    created_at: res.fulfillment.created_at,
  };
}

// Transaction operations
async function listTransactions(params: {
  orderId: string;
  since_id?: string;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params.since_id) query.set("since_id", params.since_id);

  const queryStr = query.toString() ? `?${query}` : "";
  const res = await shopifyRequest(
    "GET",
    `/orders/${params.orderId}/transactions.json${queryStr}`
  );

  return {
    transactions: res.transactions.map((t: any) => ({
      id: t.id,
      order_id: t.order_id,
      kind: t.kind,
      gateway: t.gateway,
      status: t.status,
      amount: t.amount,
      currency: t.currency,
      authorization: t.authorization,
      created_at: t.created_at,
      error_code: t.error_code,
    })),
    count: res.transactions.length,
  };
}

// Shop operations
async function getShop(): Promise<any> {
  const res = await shopifyRequest("GET", "/shop.json");
  return {
    id: res.shop.id,
    name: res.shop.name,
    email: res.shop.email,
    domain: res.shop.domain,
    myshopify_domain: res.shop.myshopify_domain,
    shop_owner: res.shop.shop_owner,
    currency: res.shop.currency,
    money_format: res.shop.money_format,
    timezone: res.shop.timezone,
    country: res.shop.country,
    plan_name: res.shop.plan_name,
    created_at: res.shop.created_at,
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  { name: "shopify-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // Product operations
      case "list_products":
        result = await listProducts(args as any);
        break;
      case "get_product":
        result = await getProduct(args as any);
        break;
      case "create_product":
        result = await createProduct(args as any);
        break;
      case "update_product":
        result = await updateProduct(args as any);
        break;
      case "delete_product":
        result = await deleteProduct(args as any);
        break;

      // Order operations
      case "list_orders":
        result = await listOrders(args as any);
        break;
      case "get_order":
        result = await getOrder(args as any);
        break;
      case "create_order":
        result = await createOrder(args as any);
        break;
      case "update_order":
        result = await updateOrder(args as any);
        break;
      case "cancel_order":
        result = await cancelOrder(args as any);
        break;

      // Customer operations
      case "list_customers":
        result = await listCustomers(args as any);
        break;
      case "get_customer":
        result = await getCustomer(args as any);
        break;
      case "create_customer":
        result = await createCustomer(args as any);
        break;

      // Inventory operations
      case "list_inventory_items":
        result = await listInventoryItems(args as any);
        break;
      case "update_inventory":
        result = await updateInventory(args as any);
        break;

      // Collection operations
      case "list_collections":
        result = await listCollections(args as any);
        break;

      // Fulfillment operations
      case "list_fulfillments":
        result = await listFulfillments(args as any);
        break;
      case "create_fulfillment":
        result = await createFulfillment(args as any);
        break;

      // Transaction operations
      case "list_transactions":
        result = await listTransactions(args as any);
        break;

      // Shop operations
      case "get_shop":
        result = await getShop();
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
  console.error("Shopify MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
