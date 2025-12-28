/**
 * Alpaca MCP Server
 *
 * Provides Alpaca trading operations for KOSMOS agents.
 * Features:
 * - Account management
 * - Position tracking
 * - Order management
 * - Asset information
 * - Market data (bars, quotes, trades)
 * - Watchlist management
 * - Market clock and calendar
 * - Account activities
 *
 * Authentication: Uses Alpaca API Key and Secret Key.
 * Supports both paper and live trading environments.
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
  apiKey: process.env.ALPACA_API_KEY || "",
  secretKey: process.env.ALPACA_SECRET_KEY || "",
  paper: process.env.ALPACA_PAPER !== "false", // Default to paper trading
};

const tradingBaseUrl = config.paper
  ? "https://paper-api.alpaca.markets"
  : "https://api.alpaca.markets";

const dataBaseUrl = "https://data.alpaca.markets";

// =============================================================================
// API Helper
// =============================================================================

async function alpacaRequest(
  baseUrl: string,
  path: string,
  method: string = "GET",
  body?: any
): Promise<any> {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    "APCA-API-KEY-ID": config.apiKey,
    "APCA-API-SECRET-KEY": config.secretKey,
    "Content-Type": "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    let errorMessage = text;
    try {
      const errorJson = JSON.parse(text);
      errorMessage = errorJson.message || errorJson.error || text;
    } catch {
      // Keep text as is
    }
    throw new Error(`Alpaca API error (${response.status}): ${errorMessage}`);
  }

  if (!text) {
    return { success: true };
  }

  return JSON.parse(text);
}

function tradingApi(path: string, method: string = "GET", body?: any): Promise<any> {
  return alpacaRequest(tradingBaseUrl, path, method, body);
}

function dataApi(path: string, method: string = "GET", body?: any): Promise<any> {
  return alpacaRequest(dataBaseUrl, path, method, body);
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Account
  {
    name: "get_account",
    description: "Get account information including buying power, cash, portfolio value, and account status.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // Positions
  {
    name: "list_positions",
    description: "List all open positions in the account.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_position",
    description: "Get an open position for a specific symbol.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock symbol (e.g., AAPL)" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "close_position",
    description: "Close an open position for a specific symbol.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock symbol to close" },
        qty: { type: "string", description: "Number of shares to close (optional, closes all if not specified)" },
        percentage: { type: "string", description: "Percentage of position to close (0-100)" },
      },
      required: ["symbol"],
    },
  },
  {
    name: "close_all_positions",
    description: "Close all open positions in the account. Use with caution.",
    inputSchema: {
      type: "object",
      properties: {
        cancel_orders: { type: "boolean", description: "Cancel all open orders before closing positions" },
      },
    },
  },

  // Orders
  {
    name: "list_orders",
    description: "List orders with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["open", "closed", "all"],
          description: "Order status filter (default: open)",
        },
        limit: { type: "number", description: "Max number of orders (default: 50, max: 500)" },
        after: { type: "string", description: "Filter orders after this timestamp (RFC3339)" },
        until: { type: "string", description: "Filter orders until this timestamp (RFC3339)" },
        direction: { type: "string", enum: ["asc", "desc"], description: "Sort direction" },
        nested: { type: "boolean", description: "Include nested multi-leg orders" },
        symbols: { type: "string", description: "Comma-separated list of symbols to filter" },
        side: { type: "string", enum: ["buy", "sell"], description: "Filter by side" },
      },
    },
  },
  {
    name: "get_order",
    description: "Get details for a specific order.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Order ID" },
        nested: { type: "boolean", description: "Include nested multi-leg orders" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "create_order",
    description: "Place a new order. Supports market, limit, stop, stop_limit, and trailing_stop orders.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock symbol (e.g., AAPL)" },
        qty: { type: "string", description: "Number of shares (use qty OR notional, not both)" },
        notional: { type: "string", description: "Dollar amount to trade (use qty OR notional, not both)" },
        side: { type: "string", enum: ["buy", "sell"], description: "Order side" },
        type: {
          type: "string",
          enum: ["market", "limit", "stop", "stop_limit", "trailing_stop"],
          description: "Order type",
        },
        time_in_force: {
          type: "string",
          enum: ["day", "gtc", "opg", "cls", "ioc", "fok"],
          description: "Time in force (day, gtc, opg, cls, ioc, fok)",
        },
        limit_price: { type: "string", description: "Limit price (required for limit and stop_limit orders)" },
        stop_price: { type: "string", description: "Stop price (required for stop and stop_limit orders)" },
        trail_price: { type: "string", description: "Trail price for trailing_stop orders" },
        trail_percent: { type: "string", description: "Trail percent for trailing_stop orders" },
        extended_hours: { type: "boolean", description: "Allow extended hours trading" },
        client_order_id: { type: "string", description: "Unique client order ID (max 48 chars)" },
        order_class: {
          type: "string",
          enum: ["simple", "bracket", "oco", "oto"],
          description: "Order class for advanced orders",
        },
        take_profit: {
          type: "object",
          properties: {
            limit_price: { type: "string", description: "Take profit limit price" },
          },
          description: "Take profit leg for bracket orders",
        },
        stop_loss: {
          type: "object",
          properties: {
            stop_price: { type: "string", description: "Stop loss stop price" },
            limit_price: { type: "string", description: "Stop loss limit price" },
          },
          description: "Stop loss leg for bracket orders",
        },
      },
      required: ["symbol", "side", "type", "time_in_force"],
    },
  },
  {
    name: "cancel_order",
    description: "Cancel an open order by ID.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Order ID to cancel" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "cancel_all_orders",
    description: "Cancel all open orders. Use with caution.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // Assets
  {
    name: "list_assets",
    description: "List tradeable assets with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["active", "inactive"], description: "Asset status filter" },
        asset_class: { type: "string", enum: ["us_equity", "crypto"], description: "Asset class filter" },
        exchange: { type: "string", description: "Exchange filter (e.g., NYSE, NASDAQ)" },
      },
    },
  },
  {
    name: "get_asset",
    description: "Get details for a specific asset by symbol.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Asset symbol (e.g., AAPL)" },
      },
      required: ["symbol"],
    },
  },

  // Market Data
  {
    name: "get_bars",
    description: "Get OHLCV bars (candlesticks) for a symbol.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock symbol (e.g., AAPL)" },
        timeframe: {
          type: "string",
          description: "Bar timeframe (e.g., 1Min, 5Min, 15Min, 1Hour, 1Day, 1Week, 1Month)",
        },
        start: { type: "string", description: "Start timestamp (RFC3339 or YYYY-MM-DD)" },
        end: { type: "string", description: "End timestamp (RFC3339 or YYYY-MM-DD)" },
        limit: { type: "number", description: "Max number of bars (default: 1000, max: 10000)" },
        adjustment: {
          type: "string",
          enum: ["raw", "split", "dividend", "all"],
          description: "Price adjustment type",
        },
        feed: { type: "string", enum: ["iex", "sip"], description: "Data feed (sip requires subscription)" },
      },
      required: ["symbol", "timeframe"],
    },
  },
  {
    name: "get_quotes",
    description: "Get latest quotes for one or more symbols.",
    inputSchema: {
      type: "object",
      properties: {
        symbols: { type: "string", description: "Comma-separated symbols (e.g., AAPL,MSFT,GOOGL)" },
        feed: { type: "string", enum: ["iex", "sip"], description: "Data feed" },
      },
      required: ["symbols"],
    },
  },
  {
    name: "get_trades",
    description: "Get recent trades for a symbol.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock symbol (e.g., AAPL)" },
        start: { type: "string", description: "Start timestamp (RFC3339 or YYYY-MM-DD)" },
        end: { type: "string", description: "End timestamp (RFC3339 or YYYY-MM-DD)" },
        limit: { type: "number", description: "Max number of trades (default: 1000, max: 10000)" },
        feed: { type: "string", enum: ["iex", "sip"], description: "Data feed" },
      },
      required: ["symbol"],
    },
  },

  // Watchlists
  {
    name: "list_watchlists",
    description: "List all watchlists for the account.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_watchlist",
    description: "Create a new watchlist.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Watchlist name" },
        symbols: {
          type: "array",
          items: { type: "string" },
          description: "Array of symbols to add to watchlist",
        },
      },
      required: ["name"],
    },
  },

  // Clock & Calendar
  {
    name: "get_clock",
    description: "Get current market clock (open/close times, trading status).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_calendar",
    description: "Get market calendar for a date range.",
    inputSchema: {
      type: "object",
      properties: {
        start: { type: "string", description: "Start date (YYYY-MM-DD)" },
        end: { type: "string", description: "End date (YYYY-MM-DD)" },
      },
    },
  },

  // Account Activities
  {
    name: "list_activities",
    description: "List account activities (fills, dividends, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        activity_types: {
          type: "string",
          description: "Comma-separated activity types (e.g., FILL,DIV,ACATC)",
        },
        date: { type: "string", description: "Filter by date (YYYY-MM-DD)" },
        until: { type: "string", description: "Filter until date (YYYY-MM-DD)" },
        after: { type: "string", description: "Filter after date (YYYY-MM-DD)" },
        direction: { type: "string", enum: ["asc", "desc"], description: "Sort direction" },
        page_size: { type: "number", description: "Number of results per page (max: 100)" },
        page_token: { type: "string", description: "Pagination token" },
      },
    },
  },
];

// =============================================================================
// Tool Implementations
// =============================================================================

// Account
async function getAccount(): Promise<any> {
  const account = await tradingApi("/v2/account");
  return {
    id: account.id,
    account_number: account.account_number,
    status: account.status,
    currency: account.currency,
    cash: account.cash,
    portfolio_value: account.portfolio_value,
    buying_power: account.buying_power,
    daytrading_buying_power: account.daytrading_buying_power,
    regt_buying_power: account.regt_buying_power,
    equity: account.equity,
    last_equity: account.last_equity,
    long_market_value: account.long_market_value,
    short_market_value: account.short_market_value,
    initial_margin: account.initial_margin,
    maintenance_margin: account.maintenance_margin,
    daytrade_count: account.daytrade_count,
    pattern_day_trader: account.pattern_day_trader,
    trading_blocked: account.trading_blocked,
    transfers_blocked: account.transfers_blocked,
    account_blocked: account.account_blocked,
    created_at: account.created_at,
  };
}

// Positions
async function listPositions(): Promise<any> {
  const positions = await tradingApi("/v2/positions");
  return {
    positions: positions.map((p: any) => ({
      asset_id: p.asset_id,
      symbol: p.symbol,
      exchange: p.exchange,
      asset_class: p.asset_class,
      qty: p.qty,
      qty_available: p.qty_available,
      avg_entry_price: p.avg_entry_price,
      side: p.side,
      market_value: p.market_value,
      cost_basis: p.cost_basis,
      unrealized_pl: p.unrealized_pl,
      unrealized_plpc: p.unrealized_plpc,
      unrealized_intraday_pl: p.unrealized_intraday_pl,
      unrealized_intraday_plpc: p.unrealized_intraday_plpc,
      current_price: p.current_price,
      lastday_price: p.lastday_price,
      change_today: p.change_today,
    })),
  };
}

async function getPosition(params: { symbol: string }): Promise<any> {
  const position = await tradingApi(`/v2/positions/${params.symbol.toUpperCase()}`);
  return {
    asset_id: position.asset_id,
    symbol: position.symbol,
    exchange: position.exchange,
    asset_class: position.asset_class,
    qty: position.qty,
    qty_available: position.qty_available,
    avg_entry_price: position.avg_entry_price,
    side: position.side,
    market_value: position.market_value,
    cost_basis: position.cost_basis,
    unrealized_pl: position.unrealized_pl,
    unrealized_plpc: position.unrealized_plpc,
    unrealized_intraday_pl: position.unrealized_intraday_pl,
    unrealized_intraday_plpc: position.unrealized_intraday_plpc,
    current_price: position.current_price,
    lastday_price: position.lastday_price,
    change_today: position.change_today,
  };
}

async function closePosition(params: {
  symbol: string;
  qty?: string;
  percentage?: string;
}): Promise<any> {
  let path = `/v2/positions/${params.symbol.toUpperCase()}`;
  const queryParams: string[] = [];

  if (params.qty) {
    queryParams.push(`qty=${params.qty}`);
  }
  if (params.percentage) {
    queryParams.push(`percentage=${params.percentage}`);
  }

  if (queryParams.length > 0) {
    path += `?${queryParams.join("&")}`;
  }

  const result = await tradingApi(path, "DELETE");
  return {
    order_id: result.id,
    symbol: result.symbol,
    qty: result.qty,
    side: result.side,
    type: result.type,
    status: result.status,
    submitted_at: result.submitted_at,
    message: `Position close order submitted for ${params.symbol}`,
  };
}

async function closeAllPositions(params: { cancel_orders?: boolean }): Promise<any> {
  const path = params.cancel_orders
    ? "/v2/positions?cancel_orders=true"
    : "/v2/positions";

  const result = await tradingApi(path, "DELETE");
  return {
    closed_positions: result,
    message: "All positions close orders submitted",
  };
}

// Orders
async function listOrders(params: {
  status?: string;
  limit?: number;
  after?: string;
  until?: string;
  direction?: string;
  nested?: boolean;
  symbols?: string;
  side?: string;
}): Promise<any> {
  const queryParams: string[] = [];

  if (params.status) queryParams.push(`status=${params.status}`);
  if (params.limit) queryParams.push(`limit=${params.limit}`);
  if (params.after) queryParams.push(`after=${params.after}`);
  if (params.until) queryParams.push(`until=${params.until}`);
  if (params.direction) queryParams.push(`direction=${params.direction}`);
  if (params.nested) queryParams.push(`nested=${params.nested}`);
  if (params.symbols) queryParams.push(`symbols=${params.symbols}`);
  if (params.side) queryParams.push(`side=${params.side}`);

  const path = queryParams.length > 0
    ? `/v2/orders?${queryParams.join("&")}`
    : "/v2/orders";

  const orders = await tradingApi(path);
  return {
    orders: orders.map((o: any) => ({
      id: o.id,
      client_order_id: o.client_order_id,
      symbol: o.symbol,
      side: o.side,
      type: o.type,
      qty: o.qty,
      filled_qty: o.filled_qty,
      filled_avg_price: o.filled_avg_price,
      limit_price: o.limit_price,
      stop_price: o.stop_price,
      status: o.status,
      time_in_force: o.time_in_force,
      extended_hours: o.extended_hours,
      created_at: o.created_at,
      updated_at: o.updated_at,
      submitted_at: o.submitted_at,
      filled_at: o.filled_at,
      expired_at: o.expired_at,
      canceled_at: o.canceled_at,
      order_class: o.order_class,
      legs: o.legs,
    })),
  };
}

async function getOrder(params: { order_id: string; nested?: boolean }): Promise<any> {
  const path = params.nested
    ? `/v2/orders/${params.order_id}?nested=true`
    : `/v2/orders/${params.order_id}`;

  const order = await tradingApi(path);
  return {
    id: order.id,
    client_order_id: order.client_order_id,
    symbol: order.symbol,
    asset_id: order.asset_id,
    side: order.side,
    type: order.type,
    qty: order.qty,
    notional: order.notional,
    filled_qty: order.filled_qty,
    filled_avg_price: order.filled_avg_price,
    limit_price: order.limit_price,
    stop_price: order.stop_price,
    trail_price: order.trail_price,
    trail_percent: order.trail_percent,
    hwm: order.hwm,
    status: order.status,
    time_in_force: order.time_in_force,
    extended_hours: order.extended_hours,
    created_at: order.created_at,
    updated_at: order.updated_at,
    submitted_at: order.submitted_at,
    filled_at: order.filled_at,
    expired_at: order.expired_at,
    canceled_at: order.canceled_at,
    failed_at: order.failed_at,
    order_class: order.order_class,
    legs: order.legs,
  };
}

async function createOrder(params: {
  symbol: string;
  qty?: string;
  notional?: string;
  side: string;
  type: string;
  time_in_force: string;
  limit_price?: string;
  stop_price?: string;
  trail_price?: string;
  trail_percent?: string;
  extended_hours?: boolean;
  client_order_id?: string;
  order_class?: string;
  take_profit?: { limit_price: string };
  stop_loss?: { stop_price: string; limit_price?: string };
}): Promise<any> {
  const orderData: any = {
    symbol: params.symbol.toUpperCase(),
    side: params.side,
    type: params.type,
    time_in_force: params.time_in_force,
  };

  if (params.qty) orderData.qty = params.qty;
  if (params.notional) orderData.notional = params.notional;
  if (params.limit_price) orderData.limit_price = params.limit_price;
  if (params.stop_price) orderData.stop_price = params.stop_price;
  if (params.trail_price) orderData.trail_price = params.trail_price;
  if (params.trail_percent) orderData.trail_percent = params.trail_percent;
  if (params.extended_hours !== undefined) orderData.extended_hours = params.extended_hours;
  if (params.client_order_id) orderData.client_order_id = params.client_order_id;
  if (params.order_class) orderData.order_class = params.order_class;
  if (params.take_profit) orderData.take_profit = params.take_profit;
  if (params.stop_loss) orderData.stop_loss = params.stop_loss;

  const order = await tradingApi("/v2/orders", "POST", orderData);
  return {
    id: order.id,
    client_order_id: order.client_order_id,
    symbol: order.symbol,
    side: order.side,
    type: order.type,
    qty: order.qty,
    notional: order.notional,
    limit_price: order.limit_price,
    stop_price: order.stop_price,
    status: order.status,
    time_in_force: order.time_in_force,
    extended_hours: order.extended_hours,
    created_at: order.created_at,
    submitted_at: order.submitted_at,
    order_class: order.order_class,
    legs: order.legs,
    message: `Order submitted: ${order.side} ${order.qty || order.notional} ${order.symbol}`,
  };
}

async function cancelOrder(params: { order_id: string }): Promise<any> {
  await tradingApi(`/v2/orders/${params.order_id}`, "DELETE");
  return {
    order_id: params.order_id,
    message: `Order ${params.order_id} canceled`,
    canceled: true,
  };
}

async function cancelAllOrders(): Promise<any> {
  const result = await tradingApi("/v2/orders", "DELETE");
  return {
    canceled_orders: result,
    message: "All open orders canceled",
  };
}

// Assets
async function listAssets(params: {
  status?: string;
  asset_class?: string;
  exchange?: string;
}): Promise<any> {
  const queryParams: string[] = [];

  if (params.status) queryParams.push(`status=${params.status}`);
  if (params.asset_class) queryParams.push(`asset_class=${params.asset_class}`);
  if (params.exchange) queryParams.push(`exchange=${params.exchange}`);

  const path = queryParams.length > 0
    ? `/v2/assets?${queryParams.join("&")}`
    : "/v2/assets";

  const assets = await tradingApi(path);
  return {
    count: assets.length,
    assets: assets.slice(0, 100).map((a: any) => ({
      id: a.id,
      class: a.class,
      exchange: a.exchange,
      symbol: a.symbol,
      name: a.name,
      status: a.status,
      tradable: a.tradable,
      marginable: a.marginable,
      shortable: a.shortable,
      easy_to_borrow: a.easy_to_borrow,
      fractionable: a.fractionable,
    })),
    note: assets.length > 100 ? `Showing first 100 of ${assets.length} assets. Use filters to narrow results.` : undefined,
  };
}

async function getAsset(params: { symbol: string }): Promise<any> {
  const asset = await tradingApi(`/v2/assets/${params.symbol.toUpperCase()}`);
  return {
    id: asset.id,
    class: asset.class,
    exchange: asset.exchange,
    symbol: asset.symbol,
    name: asset.name,
    status: asset.status,
    tradable: asset.tradable,
    marginable: asset.marginable,
    shortable: asset.shortable,
    easy_to_borrow: asset.easy_to_borrow,
    fractionable: asset.fractionable,
    maintenance_margin_requirement: asset.maintenance_margin_requirement,
    attributes: asset.attributes,
  };
}

// Market Data
async function getBars(params: {
  symbol: string;
  timeframe: string;
  start?: string;
  end?: string;
  limit?: number;
  adjustment?: string;
  feed?: string;
}): Promise<any> {
  const queryParams: string[] = [`timeframe=${params.timeframe}`];

  if (params.start) queryParams.push(`start=${params.start}`);
  if (params.end) queryParams.push(`end=${params.end}`);
  if (params.limit) queryParams.push(`limit=${params.limit}`);
  if (params.adjustment) queryParams.push(`adjustment=${params.adjustment}`);
  if (params.feed) queryParams.push(`feed=${params.feed}`);

  const path = `/v2/stocks/${params.symbol.toUpperCase()}/bars?${queryParams.join("&")}`;
  const result = await dataApi(path);

  return {
    symbol: result.symbol || params.symbol.toUpperCase(),
    bars: result.bars?.map((b: any) => ({
      timestamp: b.t,
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v,
      trade_count: b.n,
      vwap: b.vw,
    })) || [],
    next_page_token: result.next_page_token,
  };
}

async function getQuotes(params: { symbols: string; feed?: string }): Promise<any> {
  const queryParams: string[] = [`symbols=${params.symbols}`];
  if (params.feed) queryParams.push(`feed=${params.feed}`);

  const path = `/v2/stocks/quotes/latest?${queryParams.join("&")}`;
  const result = await dataApi(path);

  const quotes: any = {};
  for (const [symbol, quote] of Object.entries(result.quotes || {})) {
    const q = quote as any;
    quotes[symbol] = {
      ask_price: q.ap,
      ask_size: q.as,
      ask_exchange: q.ax,
      bid_price: q.bp,
      bid_size: q.bs,
      bid_exchange: q.bx,
      timestamp: q.t,
      conditions: q.c,
    };
  }

  return { quotes };
}

async function getTrades(params: {
  symbol: string;
  start?: string;
  end?: string;
  limit?: number;
  feed?: string;
}): Promise<any> {
  const queryParams: string[] = [];

  if (params.start) queryParams.push(`start=${params.start}`);
  if (params.end) queryParams.push(`end=${params.end}`);
  if (params.limit) queryParams.push(`limit=${params.limit}`);
  if (params.feed) queryParams.push(`feed=${params.feed}`);

  const path = queryParams.length > 0
    ? `/v2/stocks/${params.symbol.toUpperCase()}/trades?${queryParams.join("&")}`
    : `/v2/stocks/${params.symbol.toUpperCase()}/trades`;

  const result = await dataApi(path);

  return {
    symbol: result.symbol || params.symbol.toUpperCase(),
    trades: result.trades?.map((t: any) => ({
      timestamp: t.t,
      price: t.p,
      size: t.s,
      exchange: t.x,
      trade_id: t.i,
      conditions: t.c,
      tape: t.z,
    })) || [],
    next_page_token: result.next_page_token,
  };
}

// Watchlists
async function listWatchlists(): Promise<any> {
  const watchlists = await tradingApi("/v2/watchlists");
  return {
    watchlists: watchlists.map((w: any) => ({
      id: w.id,
      account_id: w.account_id,
      name: w.name,
      created_at: w.created_at,
      updated_at: w.updated_at,
    })),
  };
}

async function createWatchlist(params: {
  name: string;
  symbols?: string[];
}): Promise<any> {
  const watchlist = await tradingApi("/v2/watchlists", "POST", {
    name: params.name,
    symbols: params.symbols || [],
  });

  return {
    id: watchlist.id,
    account_id: watchlist.account_id,
    name: watchlist.name,
    assets: watchlist.assets,
    created_at: watchlist.created_at,
    updated_at: watchlist.updated_at,
    message: `Watchlist "${params.name}" created`,
  };
}

// Clock & Calendar
async function getClock(): Promise<any> {
  const clock = await tradingApi("/v2/clock");
  return {
    timestamp: clock.timestamp,
    is_open: clock.is_open,
    next_open: clock.next_open,
    next_close: clock.next_close,
  };
}

async function getCalendar(params: { start?: string; end?: string }): Promise<any> {
  const queryParams: string[] = [];

  if (params.start) queryParams.push(`start=${params.start}`);
  if (params.end) queryParams.push(`end=${params.end}`);

  const path = queryParams.length > 0
    ? `/v2/calendar?${queryParams.join("&")}`
    : "/v2/calendar";

  const calendar = await tradingApi(path);
  return {
    calendar: calendar.map((day: any) => ({
      date: day.date,
      open: day.open,
      close: day.close,
      session_open: day.session_open,
      session_close: day.session_close,
    })),
  };
}

// Account Activities
async function listActivities(params: {
  activity_types?: string;
  date?: string;
  until?: string;
  after?: string;
  direction?: string;
  page_size?: number;
  page_token?: string;
}): Promise<any> {
  const queryParams: string[] = [];

  if (params.activity_types) queryParams.push(`activity_types=${params.activity_types}`);
  if (params.date) queryParams.push(`date=${params.date}`);
  if (params.until) queryParams.push(`until=${params.until}`);
  if (params.after) queryParams.push(`after=${params.after}`);
  if (params.direction) queryParams.push(`direction=${params.direction}`);
  if (params.page_size) queryParams.push(`page_size=${params.page_size}`);
  if (params.page_token) queryParams.push(`page_token=${params.page_token}`);

  const path = queryParams.length > 0
    ? `/v2/account/activities?${queryParams.join("&")}`
    : "/v2/account/activities";

  const activities = await tradingApi(path);
  return {
    activities: activities.map((a: any) => ({
      id: a.id,
      activity_type: a.activity_type,
      transaction_time: a.transaction_time,
      type: a.type,
      symbol: a.symbol,
      side: a.side,
      qty: a.qty,
      price: a.price,
      cum_qty: a.cum_qty,
      leaves_qty: a.leaves_qty,
      order_id: a.order_id,
      net_amount: a.net_amount,
      description: a.description,
      status: a.status,
      date: a.date,
    })),
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  { name: "alpaca-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // Account
      case "get_account":
        result = await getAccount();
        break;

      // Positions
      case "list_positions":
        result = await listPositions();
        break;
      case "get_position":
        result = await getPosition(args as any);
        break;
      case "close_position":
        result = await closePosition(args as any);
        break;
      case "close_all_positions":
        result = await closeAllPositions(args as any);
        break;

      // Orders
      case "list_orders":
        result = await listOrders(args as any);
        break;
      case "get_order":
        result = await getOrder(args as any);
        break;
      case "create_order":
        result = await createOrder(args as any);
        break;
      case "cancel_order":
        result = await cancelOrder(args as any);
        break;
      case "cancel_all_orders":
        result = await cancelAllOrders();
        break;

      // Assets
      case "list_assets":
        result = await listAssets(args as any);
        break;
      case "get_asset":
        result = await getAsset(args as any);
        break;

      // Market Data
      case "get_bars":
        result = await getBars(args as any);
        break;
      case "get_quotes":
        result = await getQuotes(args as any);
        break;
      case "get_trades":
        result = await getTrades(args as any);
        break;

      // Watchlists
      case "list_watchlists":
        result = await listWatchlists();
        break;
      case "create_watchlist":
        result = await createWatchlist(args as any);
        break;

      // Clock & Calendar
      case "get_clock":
        result = await getClock();
        break;
      case "get_calendar":
        result = await getCalendar(args as any);
        break;

      // Account Activities
      case "list_activities":
        result = await listActivities(args as any);
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

// =============================================================================
// Main Entry Point
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Alpaca MCP Server running on stdio");
  console.error(`Mode: ${config.paper ? "PAPER TRADING" : "LIVE TRADING"}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
