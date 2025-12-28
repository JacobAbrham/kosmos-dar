/**
 * Polygon.io MCP Server
 *
 * Provides Polygon.io market data operations for KOSMOS agents.
 * Features:
 * - Ticker details and search
 * - OHLCV aggregates (bars)
 * - Historical trades and quotes
 * - Market snapshots
 * - Gainers/losers
 * - Market status and holidays
 * - News and financials
 * - Dividends and splits
 *
 * Authentication: Uses POLYGON_API_KEY environment variable.
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
  apiKey: process.env.POLYGON_API_KEY || "",
  baseUrl: "https://api.polygon.io",
};

// =============================================================================
// API Helper
// =============================================================================

async function polygonRequest(path: string, params: Record<string, any> = {}): Promise<any> {
  const url = new URL(`${config.baseUrl}${path}`);

  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.append(key, String(value));
    }
  });

  // Add API key
  url.searchParams.append("apiKey", config.apiKey);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.status === "ERROR" || data.error) {
    throw new Error(data.error || data.message || "Polygon API error");
  }

  return data;
}

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Ticker Reference
  {
    name: "get_ticker_details",
    description: "Get detailed information about a ticker symbol including company name, market cap, description, and more.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "The ticker symbol (e.g., 'AAPL')" },
        date: { type: "string", description: "Optional date (YYYY-MM-DD) to get point-in-time data" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "list_tickers",
    description: "Search and list tickers with optional filters for type, market, exchange, etc.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Search by ticker prefix" },
        type: { type: "string", description: "Filter by type: CS (common stock), ADRC, ETF, FUND, etc." },
        market: { type: "string", description: "Filter by market: stocks, crypto, fx, otc" },
        exchange: { type: "string", description: "Filter by exchange MIC code" },
        cusip: { type: "string", description: "Filter by CUSIP" },
        cik: { type: "string", description: "Filter by CIK" },
        active: { type: "boolean", description: "Filter by active status" },
        search: { type: "string", description: "Search by company name" },
        limit: { type: "number", description: "Number of results (max 1000)" },
        sort: { type: "string", description: "Sort field: ticker, name, market, type" },
        order: { type: "string", enum: ["asc", "desc"], description: "Sort order" },
      },
    },
  },
  // Aggregates (Bars)
  {
    name: "get_aggregates",
    description: "Get OHLCV aggregates (bars) for a ticker over a date range.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "The ticker symbol" },
        multiplier: { type: "number", description: "Size of the timespan multiplier" },
        timespan: { type: "string", enum: ["second", "minute", "hour", "day", "week", "month", "quarter", "year"], description: "Size of the time window" },
        from: { type: "string", description: "Start date (YYYY-MM-DD) or timestamp" },
        to: { type: "string", description: "End date (YYYY-MM-DD) or timestamp" },
        adjusted: { type: "boolean", description: "Adjust for splits (default true)" },
        sort: { type: "string", enum: ["asc", "desc"], description: "Sort order by timestamp" },
        limit: { type: "number", description: "Number of results (max 50000)" },
      },
      required: ["ticker", "multiplier", "timespan", "from", "to"],
    },
  },
  {
    name: "get_grouped_daily",
    description: "Get grouped daily bars for all tickers on a specific date.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "The date (YYYY-MM-DD)" },
        adjusted: { type: "boolean", description: "Adjust for splits (default true)" },
        include_otc: { type: "boolean", description: "Include OTC securities" },
      },
      required: ["date"],
    },
  },
  {
    name: "get_previous_close",
    description: "Get the previous day's OHLCV bar for a ticker.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "The ticker symbol" },
        adjusted: { type: "boolean", description: "Adjust for splits (default true)" },
      },
      required: ["ticker"],
    },
  },
  // Trades
  {
    name: "get_trades",
    description: "Get historical trades for a ticker on a specific date.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "The ticker symbol" },
        date: { type: "string", description: "The date (YYYY-MM-DD)" },
        timestamp: { type: "string", description: "Query by nanosecond timestamp" },
        timestampLt: { type: "string", description: "Timestamp less than" },
        timestampLte: { type: "string", description: "Timestamp less than or equal" },
        timestampGt: { type: "string", description: "Timestamp greater than" },
        timestampGte: { type: "string", description: "Timestamp greater than or equal" },
        sort: { type: "string", enum: ["asc", "desc"], description: "Sort order by timestamp" },
        limit: { type: "number", description: "Number of results (max 50000)" },
      },
      required: ["ticker", "date"],
    },
  },
  // Quotes
  {
    name: "get_quotes",
    description: "Get historical NBBO quotes for a ticker on a specific date.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "The ticker symbol" },
        date: { type: "string", description: "The date (YYYY-MM-DD)" },
        timestamp: { type: "string", description: "Query by nanosecond timestamp" },
        timestampLt: { type: "string", description: "Timestamp less than" },
        timestampLte: { type: "string", description: "Timestamp less than or equal" },
        timestampGt: { type: "string", description: "Timestamp greater than" },
        timestampGte: { type: "string", description: "Timestamp greater than or equal" },
        sort: { type: "string", enum: ["asc", "desc"], description: "Sort order by timestamp" },
        limit: { type: "number", description: "Number of results (max 50000)" },
      },
      required: ["ticker", "date"],
    },
  },
  // Last Trade/Quote
  {
    name: "get_last_trade",
    description: "Get the most recent trade for a ticker.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "The ticker symbol" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "get_last_quote",
    description: "Get the most recent NBBO quote for a ticker.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "The ticker symbol" },
      },
      required: ["ticker"],
    },
  },
  // Snapshots
  {
    name: "get_snapshot",
    description: "Get current snapshot (price, volume, OHLC) for a ticker.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "The ticker symbol" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "get_gainers_losers",
    description: "Get the top gainers or losers for the day.",
    inputSchema: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["gainers", "losers"], description: "Direction to query" },
        include_otc: { type: "boolean", description: "Include OTC securities" },
      },
      required: ["direction"],
    },
  },
  // Market Status
  {
    name: "get_market_status",
    description: "Get the current market status (open/closed) for exchanges.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_market_holidays",
    description: "Get upcoming market holidays and their schedules.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  // Exchanges
  {
    name: "list_exchanges",
    description: "Get a list of stock exchanges.",
    inputSchema: {
      type: "object",
      properties: {
        asset_class: { type: "string", enum: ["stocks", "options", "crypto", "fx"], description: "Filter by asset class" },
        locale: { type: "string", enum: ["us", "global"], description: "Filter by locale" },
      },
    },
  },
  // News
  {
    name: "get_ticker_news",
    description: "Get news articles for a ticker or the market.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Filter by ticker symbol" },
        publishedUtc: { type: "string", description: "Filter by publication date" },
        publishedUtcLt: { type: "string", description: "Published before date" },
        publishedUtcLte: { type: "string", description: "Published before or on date" },
        publishedUtcGt: { type: "string", description: "Published after date" },
        publishedUtcGte: { type: "string", description: "Published after or on date" },
        sort: { type: "string", enum: ["published_utc"], description: "Sort field" },
        order: { type: "string", enum: ["asc", "desc"], description: "Sort order" },
        limit: { type: "number", description: "Number of results (max 1000)" },
      },
    },
  },
  // Financials
  {
    name: "get_stock_financials",
    description: "Get financial reports (income statement, balance sheet, cash flow) for a ticker.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "The ticker symbol" },
        cik: { type: "string", description: "Filter by CIK" },
        companyName: { type: "string", description: "Filter by company name" },
        sic: { type: "string", description: "Filter by SIC code" },
        filingDate: { type: "string", description: "Filter by filing date" },
        filingDateLt: { type: "string", description: "Filing date before" },
        filingDateLte: { type: "string", description: "Filing date before or on" },
        filingDateGt: { type: "string", description: "Filing date after" },
        filingDateGte: { type: "string", description: "Filing date after or on" },
        periodOfReportDate: { type: "string", description: "Filter by period date" },
        timeframe: { type: "string", enum: ["annual", "quarterly", "ttm"], description: "Filter by timeframe" },
        includeSources: { type: "boolean", description: "Include source URLs" },
        sort: { type: "string", description: "Sort field" },
        order: { type: "string", enum: ["asc", "desc"], description: "Sort order" },
        limit: { type: "number", description: "Number of results (max 100)" },
      },
    },
  },
  // Dividends
  {
    name: "get_dividends",
    description: "Get dividend history for a ticker.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Filter by ticker symbol" },
        exDividendDate: { type: "string", description: "Filter by ex-dividend date" },
        exDividendDateLt: { type: "string", description: "Ex-dividend date before" },
        exDividendDateLte: { type: "string", description: "Ex-dividend date before or on" },
        exDividendDateGt: { type: "string", description: "Ex-dividend date after" },
        exDividendDateGte: { type: "string", description: "Ex-dividend date after or on" },
        recordDate: { type: "string", description: "Filter by record date" },
        declarationDate: { type: "string", description: "Filter by declaration date" },
        payDate: { type: "string", description: "Filter by pay date" },
        frequency: { type: "number", description: "Filter by frequency (1=annual, 2=bi-annual, 4=quarterly, 12=monthly)" },
        cashAmount: { type: "number", description: "Filter by cash amount" },
        dividendType: { type: "string", enum: ["CD", "SC", "LT", "ST"], description: "Filter by dividend type" },
        sort: { type: "string", description: "Sort field" },
        order: { type: "string", enum: ["asc", "desc"], description: "Sort order" },
        limit: { type: "number", description: "Number of results (max 1000)" },
      },
    },
  },
  // Stock Splits
  {
    name: "get_stock_splits",
    description: "Get stock split history for a ticker.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Filter by ticker symbol" },
        executionDate: { type: "string", description: "Filter by execution date" },
        executionDateLt: { type: "string", description: "Execution date before" },
        executionDateLte: { type: "string", description: "Execution date before or on" },
        executionDateGt: { type: "string", description: "Execution date after" },
        executionDateGte: { type: "string", description: "Execution date after or on" },
        reverseSplit: { type: "boolean", description: "Filter for reverse splits" },
        sort: { type: "string", description: "Sort field" },
        order: { type: "string", enum: ["asc", "desc"], description: "Sort order" },
        limit: { type: "number", description: "Number of results (max 1000)" },
      },
    },
  },
  // Related Companies
  {
    name: "get_related_companies",
    description: "Get companies related to a ticker based on various criteria.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "The ticker symbol" },
      },
      required: ["ticker"],
    },
  },
  // Trade Conditions
  {
    name: "get_conditions",
    description: "Get trade condition codes and their meanings.",
    inputSchema: {
      type: "object",
      properties: {
        asset_class: { type: "string", enum: ["stocks", "options", "crypto", "fx"], description: "Filter by asset class" },
        data_type: { type: "string", enum: ["trade", "bbo", "nbbo"], description: "Filter by data type" },
        id: { type: "number", description: "Filter by condition ID" },
        sip: { type: "string", enum: ["CTA", "UTP", "OPRA"], description: "Filter by SIP" },
      },
    },
  },
];

// =============================================================================
// Tool Implementations
// =============================================================================

async function getTickerDetails(params: { ticker: string; date?: string }): Promise<any> {
  const path = params.date
    ? `/v3/reference/tickers/${params.ticker}?date=${params.date}`
    : `/v3/reference/tickers/${params.ticker}`;

  const data = await polygonRequest(path);
  return data.results || data;
}

async function listTickers(params: {
  ticker?: string;
  type?: string;
  market?: string;
  exchange?: string;
  cusip?: string;
  cik?: string;
  active?: boolean;
  search?: string;
  limit?: number;
  sort?: string;
  order?: string;
}): Promise<any> {
  const data = await polygonRequest("/v3/reference/tickers", {
    ticker: params.ticker,
    type: params.type,
    market: params.market,
    exchange: params.exchange,
    cusip: params.cusip,
    cik: params.cik,
    active: params.active,
    search: params.search,
    limit: params.limit || 100,
    sort: params.sort,
    order: params.order,
  });

  return {
    tickers: data.results || [],
    count: data.count,
    nextUrl: data.next_url,
  };
}

async function getAggregates(params: {
  ticker: string;
  multiplier: number;
  timespan: string;
  from: string;
  to: string;
  adjusted?: boolean;
  sort?: string;
  limit?: number;
}): Promise<any> {
  const path = `/v2/aggs/ticker/${params.ticker}/range/${params.multiplier}/${params.timespan}/${params.from}/${params.to}`;

  const data = await polygonRequest(path, {
    adjusted: params.adjusted !== false,
    sort: params.sort || "asc",
    limit: params.limit || 5000,
  });

  return {
    ticker: data.ticker,
    queryCount: data.queryCount,
    resultsCount: data.resultsCount,
    adjusted: data.adjusted,
    results: (data.results || []).map((bar: any) => ({
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      vwap: bar.vw,
      timestamp: bar.t,
      date: new Date(bar.t).toISOString(),
      transactions: bar.n,
    })),
  };
}

async function getGroupedDaily(params: {
  date: string;
  adjusted?: boolean;
  include_otc?: boolean;
}): Promise<any> {
  const path = `/v2/aggs/grouped/locale/us/market/stocks/${params.date}`;

  const data = await polygonRequest(path, {
    adjusted: params.adjusted !== false,
    include_otc: params.include_otc,
  });

  return {
    queryCount: data.queryCount,
    resultsCount: data.resultsCount,
    adjusted: data.adjusted,
    results: (data.results || []).map((bar: any) => ({
      ticker: bar.T,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      vwap: bar.vw,
      timestamp: bar.t,
      transactions: bar.n,
    })),
  };
}

async function getPreviousClose(params: { ticker: string; adjusted?: boolean }): Promise<any> {
  const path = `/v2/aggs/ticker/${params.ticker}/prev`;

  const data = await polygonRequest(path, {
    adjusted: params.adjusted !== false,
  });

  const bar = data.results?.[0];
  if (!bar) return { ticker: params.ticker, found: false };

  return {
    ticker: data.ticker,
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
    vwap: bar.vw,
    timestamp: bar.t,
    date: new Date(bar.t).toISOString(),
    transactions: bar.n,
  };
}

async function getTrades(params: {
  ticker: string;
  date: string;
  timestamp?: string;
  timestampLt?: string;
  timestampLte?: string;
  timestampGt?: string;
  timestampGte?: string;
  sort?: string;
  limit?: number;
}): Promise<any> {
  const path = `/v3/trades/${params.ticker}`;

  const queryParams: Record<string, any> = {
    "timestamp.gte": params.date,
    "timestamp.lt": params.date ? `${params.date}T23:59:59Z` : undefined,
    sort: params.sort || "timestamp",
    limit: params.limit || 1000,
  };

  if (params.timestamp) queryParams.timestamp = params.timestamp;
  if (params.timestampLt) queryParams["timestamp.lt"] = params.timestampLt;
  if (params.timestampLte) queryParams["timestamp.lte"] = params.timestampLte;
  if (params.timestampGt) queryParams["timestamp.gt"] = params.timestampGt;
  if (params.timestampGte) queryParams["timestamp.gte"] = params.timestampGte;

  const data = await polygonRequest(path, queryParams);

  return {
    trades: (data.results || []).map((trade: any) => ({
      id: trade.id,
      price: trade.price,
      size: trade.size,
      exchange: trade.exchange,
      timestamp: trade.sip_timestamp,
      conditions: trade.conditions,
      participantTimestamp: trade.participant_timestamp,
    })),
    nextUrl: data.next_url,
  };
}

async function getQuotes(params: {
  ticker: string;
  date: string;
  timestamp?: string;
  timestampLt?: string;
  timestampLte?: string;
  timestampGt?: string;
  timestampGte?: string;
  sort?: string;
  limit?: number;
}): Promise<any> {
  const path = `/v3/quotes/${params.ticker}`;

  const queryParams: Record<string, any> = {
    "timestamp.gte": params.date,
    "timestamp.lt": params.date ? `${params.date}T23:59:59Z` : undefined,
    sort: params.sort || "timestamp",
    limit: params.limit || 1000,
  };

  if (params.timestamp) queryParams.timestamp = params.timestamp;
  if (params.timestampLt) queryParams["timestamp.lt"] = params.timestampLt;
  if (params.timestampLte) queryParams["timestamp.lte"] = params.timestampLte;
  if (params.timestampGt) queryParams["timestamp.gt"] = params.timestampGt;
  if (params.timestampGte) queryParams["timestamp.gte"] = params.timestampGte;

  const data = await polygonRequest(path, queryParams);

  return {
    quotes: (data.results || []).map((quote: any) => ({
      bidPrice: quote.bid_price,
      bidSize: quote.bid_size,
      bidExchange: quote.bid_exchange,
      askPrice: quote.ask_price,
      askSize: quote.ask_size,
      askExchange: quote.ask_exchange,
      timestamp: quote.sip_timestamp,
      conditions: quote.conditions,
    })),
    nextUrl: data.next_url,
  };
}

async function getLastTrade(params: { ticker: string }): Promise<any> {
  const path = `/v2/last/trade/${params.ticker}`;
  const data = await polygonRequest(path);

  const trade = data.results;
  if (!trade) return { ticker: params.ticker, found: false };

  return {
    ticker: params.ticker,
    price: trade.p,
    size: trade.s,
    exchange: trade.x,
    timestamp: trade.t,
    conditions: trade.c,
  };
}

async function getLastQuote(params: { ticker: string }): Promise<any> {
  const path = `/v2/last/nbbo/${params.ticker}`;
  const data = await polygonRequest(path);

  const quote = data.results;
  if (!quote) return { ticker: params.ticker, found: false };

  return {
    ticker: params.ticker,
    bidPrice: quote.p,
    bidSize: quote.s,
    bidExchange: quote.x,
    askPrice: quote.P,
    askSize: quote.S,
    askExchange: quote.X,
    timestamp: quote.t,
  };
}

async function getSnapshot(params: { ticker: string }): Promise<any> {
  const path = `/v2/snapshot/locale/us/markets/stocks/tickers/${params.ticker}`;
  const data = await polygonRequest(path);

  const snap = data.ticker;
  if (!snap) return { ticker: params.ticker, found: false };

  return {
    ticker: snap.ticker,
    todaysChange: snap.todaysChange,
    todaysChangePerc: snap.todaysChangePerc,
    updated: snap.updated,
    day: snap.day ? {
      open: snap.day.o,
      high: snap.day.h,
      low: snap.day.l,
      close: snap.day.c,
      volume: snap.day.v,
      vwap: snap.day.vw,
    } : null,
    lastTrade: snap.lastTrade ? {
      price: snap.lastTrade.p,
      size: snap.lastTrade.s,
      timestamp: snap.lastTrade.t,
    } : null,
    lastQuote: snap.lastQuote ? {
      bidPrice: snap.lastQuote.p,
      bidSize: snap.lastQuote.s,
      askPrice: snap.lastQuote.P,
      askSize: snap.lastQuote.S,
    } : null,
    prevDay: snap.prevDay ? {
      open: snap.prevDay.o,
      high: snap.prevDay.h,
      low: snap.prevDay.l,
      close: snap.prevDay.c,
      volume: snap.prevDay.v,
      vwap: snap.prevDay.vw,
    } : null,
    min: snap.min ? {
      open: snap.min.o,
      high: snap.min.h,
      low: snap.min.l,
      close: snap.min.c,
      volume: snap.min.v,
      vwap: snap.min.vw,
    } : null,
  };
}

async function getGainersLosers(params: { direction: string; include_otc?: boolean }): Promise<any> {
  const path = `/v2/snapshot/locale/us/markets/stocks/${params.direction}`;
  const data = await polygonRequest(path, {
    include_otc: params.include_otc,
  });

  return {
    direction: params.direction,
    tickers: (data.tickers || []).map((snap: any) => ({
      ticker: snap.ticker,
      todaysChange: snap.todaysChange,
      todaysChangePerc: snap.todaysChangePerc,
      day: snap.day ? {
        open: snap.day.o,
        high: snap.day.h,
        low: snap.day.l,
        close: snap.day.c,
        volume: snap.day.v,
      } : null,
    })),
  };
}

async function getMarketStatus(): Promise<any> {
  const path = "/v1/marketstatus/now";
  const data = await polygonRequest(path);

  return {
    market: data.market,
    serverTime: data.serverTime,
    exchanges: data.exchanges,
    currencies: data.currencies,
    afterHours: data.afterHours,
    earlyHours: data.earlyHours,
  };
}

async function getMarketHolidays(): Promise<any> {
  const path = "/v1/marketstatus/upcoming";
  const data = await polygonRequest(path);

  return {
    holidays: data.map((h: any) => ({
      exchange: h.exchange,
      name: h.name,
      date: h.date,
      status: h.status,
      open: h.open,
      close: h.close,
    })),
  };
}

async function listExchanges(params: { asset_class?: string; locale?: string }): Promise<any> {
  const path = "/v3/reference/exchanges";
  const data = await polygonRequest(path, {
    asset_class: params.asset_class,
    locale: params.locale,
  });

  return {
    exchanges: (data.results || []).map((ex: any) => ({
      id: ex.id,
      type: ex.type,
      assetClass: ex.asset_class,
      locale: ex.locale,
      name: ex.name,
      acronym: ex.acronym,
      mic: ex.mic,
      operatingMic: ex.operating_mic,
      participantId: ex.participant_id,
      url: ex.url,
    })),
  };
}

async function getTickerNews(params: {
  ticker?: string;
  publishedUtc?: string;
  publishedUtcLt?: string;
  publishedUtcLte?: string;
  publishedUtcGt?: string;
  publishedUtcGte?: string;
  sort?: string;
  order?: string;
  limit?: number;
}): Promise<any> {
  const queryParams: Record<string, any> = {
    limit: params.limit || 100,
    sort: params.sort,
    order: params.order,
  };

  if (params.ticker) queryParams.ticker = params.ticker;
  if (params.publishedUtc) queryParams.published_utc = params.publishedUtc;
  if (params.publishedUtcLt) queryParams["published_utc.lt"] = params.publishedUtcLt;
  if (params.publishedUtcLte) queryParams["published_utc.lte"] = params.publishedUtcLte;
  if (params.publishedUtcGt) queryParams["published_utc.gt"] = params.publishedUtcGt;
  if (params.publishedUtcGte) queryParams["published_utc.gte"] = params.publishedUtcGte;

  const data = await polygonRequest("/v2/reference/news", queryParams);

  return {
    news: (data.results || []).map((article: any) => ({
      id: article.id,
      publisher: article.publisher,
      title: article.title,
      author: article.author,
      publishedUtc: article.published_utc,
      articleUrl: article.article_url,
      tickers: article.tickers,
      ampUrl: article.amp_url,
      imageUrl: article.image_url,
      description: article.description,
      keywords: article.keywords,
    })),
    nextUrl: data.next_url,
  };
}

async function getStockFinancials(params: {
  ticker?: string;
  cik?: string;
  companyName?: string;
  sic?: string;
  filingDate?: string;
  filingDateLt?: string;
  filingDateLte?: string;
  filingDateGt?: string;
  filingDateGte?: string;
  periodOfReportDate?: string;
  timeframe?: string;
  includeSources?: boolean;
  sort?: string;
  order?: string;
  limit?: number;
}): Promise<any> {
  const queryParams: Record<string, any> = {
    limit: params.limit || 10,
    sort: params.sort,
    order: params.order,
    include_sources: params.includeSources,
  };

  if (params.ticker) queryParams.ticker = params.ticker;
  if (params.cik) queryParams.cik = params.cik;
  if (params.companyName) queryParams.company_name = params.companyName;
  if (params.sic) queryParams.sic = params.sic;
  if (params.filingDate) queryParams.filing_date = params.filingDate;
  if (params.filingDateLt) queryParams["filing_date.lt"] = params.filingDateLt;
  if (params.filingDateLte) queryParams["filing_date.lte"] = params.filingDateLte;
  if (params.filingDateGt) queryParams["filing_date.gt"] = params.filingDateGt;
  if (params.filingDateGte) queryParams["filing_date.gte"] = params.filingDateGte;
  if (params.periodOfReportDate) queryParams.period_of_report_date = params.periodOfReportDate;
  if (params.timeframe) queryParams.timeframe = params.timeframe;

  const data = await polygonRequest("/vX/reference/financials", queryParams);

  return {
    financials: (data.results || []).map((fin: any) => ({
      id: fin.id,
      ticker: fin.tickers?.[0],
      cik: fin.cik,
      companyName: fin.company_name,
      startDate: fin.start_date,
      endDate: fin.end_date,
      filingDate: fin.filing_date,
      fiscalPeriod: fin.fiscal_period,
      fiscalYear: fin.fiscal_year,
      timeframe: fin.timeframe,
      sourceFilingUrl: fin.source_filing_url,
      sourceFilingFileUrl: fin.source_filing_file_url,
      financials: fin.financials,
    })),
    nextUrl: data.next_url,
  };
}

async function getDividends(params: {
  ticker?: string;
  exDividendDate?: string;
  exDividendDateLt?: string;
  exDividendDateLte?: string;
  exDividendDateGt?: string;
  exDividendDateGte?: string;
  recordDate?: string;
  declarationDate?: string;
  payDate?: string;
  frequency?: number;
  cashAmount?: number;
  dividendType?: string;
  sort?: string;
  order?: string;
  limit?: number;
}): Promise<any> {
  const queryParams: Record<string, any> = {
    limit: params.limit || 100,
    sort: params.sort,
    order: params.order,
  };

  if (params.ticker) queryParams.ticker = params.ticker;
  if (params.exDividendDate) queryParams.ex_dividend_date = params.exDividendDate;
  if (params.exDividendDateLt) queryParams["ex_dividend_date.lt"] = params.exDividendDateLt;
  if (params.exDividendDateLte) queryParams["ex_dividend_date.lte"] = params.exDividendDateLte;
  if (params.exDividendDateGt) queryParams["ex_dividend_date.gt"] = params.exDividendDateGt;
  if (params.exDividendDateGte) queryParams["ex_dividend_date.gte"] = params.exDividendDateGte;
  if (params.recordDate) queryParams.record_date = params.recordDate;
  if (params.declarationDate) queryParams.declaration_date = params.declarationDate;
  if (params.payDate) queryParams.pay_date = params.payDate;
  if (params.frequency) queryParams.frequency = params.frequency;
  if (params.cashAmount) queryParams.cash_amount = params.cashAmount;
  if (params.dividendType) queryParams.dividend_type = params.dividendType;

  const data = await polygonRequest("/v3/reference/dividends", queryParams);

  return {
    dividends: (data.results || []).map((div: any) => ({
      ticker: div.ticker,
      cashAmount: div.cash_amount,
      currency: div.currency,
      declarationDate: div.declaration_date,
      dividendType: div.dividend_type,
      exDividendDate: div.ex_dividend_date,
      frequency: div.frequency,
      payDate: div.pay_date,
      recordDate: div.record_date,
    })),
    nextUrl: data.next_url,
  };
}

async function getStockSplits(params: {
  ticker?: string;
  executionDate?: string;
  executionDateLt?: string;
  executionDateLte?: string;
  executionDateGt?: string;
  executionDateGte?: string;
  reverseSplit?: boolean;
  sort?: string;
  order?: string;
  limit?: number;
}): Promise<any> {
  const queryParams: Record<string, any> = {
    limit: params.limit || 100,
    sort: params.sort,
    order: params.order,
  };

  if (params.ticker) queryParams.ticker = params.ticker;
  if (params.executionDate) queryParams.execution_date = params.executionDate;
  if (params.executionDateLt) queryParams["execution_date.lt"] = params.executionDateLt;
  if (params.executionDateLte) queryParams["execution_date.lte"] = params.executionDateLte;
  if (params.executionDateGt) queryParams["execution_date.gt"] = params.executionDateGt;
  if (params.executionDateGte) queryParams["execution_date.gte"] = params.executionDateGte;
  if (params.reverseSplit !== undefined) queryParams.reverse_split = params.reverseSplit;

  const data = await polygonRequest("/v3/reference/splits", queryParams);

  return {
    splits: (data.results || []).map((split: any) => ({
      ticker: split.ticker,
      executionDate: split.execution_date,
      splitFrom: split.split_from,
      splitTo: split.split_to,
    })),
    nextUrl: data.next_url,
  };
}

async function getRelatedCompanies(params: { ticker: string }): Promise<any> {
  const path = `/v1/related-companies/${params.ticker}`;
  const data = await polygonRequest(path);

  return {
    ticker: params.ticker,
    relatedCompanies: (data.results || []).map((company: any) => ({
      ticker: company.ticker,
    })),
  };
}

async function getConditions(params: {
  asset_class?: string;
  data_type?: string;
  id?: number;
  sip?: string;
}): Promise<any> {
  const data = await polygonRequest("/v3/reference/conditions", {
    asset_class: params.asset_class,
    data_type: params.data_type,
    id: params.id,
    sip: params.sip,
  });

  return {
    conditions: (data.results || []).map((cond: any) => ({
      id: cond.id,
      type: cond.type,
      name: cond.name,
      assetClass: cond.asset_class,
      dataTypes: cond.data_types,
      legacy: cond.legacy,
      description: cond.description,
      sip_mapping: cond.sip_mapping,
      updateRules: cond.update_rules,
    })),
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  { name: "polygon-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case "get_ticker_details": result = await getTickerDetails(args as any); break;
      case "list_tickers": result = await listTickers(args as any); break;
      case "get_aggregates": result = await getAggregates(args as any); break;
      case "get_grouped_daily": result = await getGroupedDaily(args as any); break;
      case "get_previous_close": result = await getPreviousClose(args as any); break;
      case "get_trades": result = await getTrades(args as any); break;
      case "get_quotes": result = await getQuotes(args as any); break;
      case "get_last_trade": result = await getLastTrade(args as any); break;
      case "get_last_quote": result = await getLastQuote(args as any); break;
      case "get_snapshot": result = await getSnapshot(args as any); break;
      case "get_gainers_losers": result = await getGainersLosers(args as any); break;
      case "get_market_status": result = await getMarketStatus(); break;
      case "get_market_holidays": result = await getMarketHolidays(); break;
      case "list_exchanges": result = await listExchanges(args as any); break;
      case "get_ticker_news": result = await getTickerNews(args as any); break;
      case "get_stock_financials": result = await getStockFinancials(args as any); break;
      case "get_dividends": result = await getDividends(args as any); break;
      case "get_stock_splits": result = await getStockSplits(args as any); break;
      case "get_related_companies": result = await getRelatedCompanies(args as any); break;
      case "get_conditions": result = await getConditions(args as any); break;
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
  console.error("Polygon.io MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
