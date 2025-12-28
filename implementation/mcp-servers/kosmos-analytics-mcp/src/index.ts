/**
 * KOSMOS Analytics MCP Server
 *
 * Implements comprehensive analytics tools for the KOSMOS platform:
 *
 * Event Tracking:
 * 1. track_event - Track custom event
 * 2. track_agent_action - Track agent action
 * 3. track_tool_usage - Track tool invocation
 *
 * Metrics Retrieval:
 * 4. get_agent_metrics - Get agent performance metrics
 * 5. get_tool_metrics - Get tool usage statistics
 * 6. get_session_metrics - Get session analytics
 * 7. get_user_metrics - Get user activity metrics
 * 8. get_cost_metrics - Get token/cost analytics
 *
 * Dashboards:
 * 9. create_dashboard - Create analytics dashboard
 * 10. get_dashboard - Get dashboard data
 * 11. list_dashboards - List dashboards
 *
 * Reports:
 * 12. create_report - Generate analytics report
 * 13. schedule_report - Schedule recurring report
 *
 * Real-time & Queries:
 * 14. get_real_time_stats - Get real-time statistics
 * 15. query_analytics - Custom analytics query
 * 16. export_analytics - Export analytics data
 *
 * Alerts:
 * 17. set_alert - Set metric alert threshold
 * 18. list_alerts - List configured alerts
 *
 * System:
 * 19. get_system_health - Get KOSMOS system health
 * 20. get_audit_log - Get audit trail
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// Types and Interfaces
// =============================================================================

type EventType = "custom" | "agent_action" | "tool_usage" | "session" | "error" | "system";
type MetricPeriod = "hour" | "day" | "week" | "month" | "year";
type AlertSeverity = "info" | "warning" | "critical";
type AlertStatus = "active" | "triggered" | "acknowledged" | "resolved" | "disabled";
type ReportFormat = "json" | "csv" | "markdown";
type ReportFrequency = "hourly" | "daily" | "weekly" | "monthly";

interface AnalyticsEvent {
  id: string;
  type: EventType;
  name: string;
  timestamp: Date;
  sessionId?: string;
  userId?: string;
  agentId?: string;
  toolName?: string;
  properties: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

interface AgentMetrics {
  agentId: string;
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  averageLatencyMs: number;
  tokensConsumed: number;
  costUsd: number;
  lastActiveAt: Date;
  actionsByType: Record<string, number>;
}

interface ToolMetrics {
  toolName: string;
  totalInvocations: number;
  successfulInvocations: number;
  failedInvocations: number;
  averageLatencyMs: number;
  invocationsByAgent: Record<string, number>;
  lastUsedAt: Date;
}

interface SessionMetrics {
  sessionId: string;
  userId: string;
  startedAt: Date;
  endedAt?: Date;
  durationMs: number;
  eventCount: number;
  agentsUsed: string[];
  toolsUsed: string[];
  tokensConsumed: number;
  costUsd: number;
}

interface UserMetrics {
  userId: string;
  totalSessions: number;
  totalEvents: number;
  totalTokensConsumed: number;
  totalCostUsd: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  topAgents: Array<{ agentId: string; usageCount: number }>;
  topTools: Array<{ toolName: string; usageCount: number }>;
}

interface CostMetrics {
  period: MetricPeriod;
  startDate: Date;
  endDate: Date;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCostUsd: number;
  costByModel: Record<string, number>;
  costByAgent: Record<string, number>;
  costByUser: Record<string, number>;
}

interface Dashboard {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  widgets: DashboardWidget[];
  isPublic: boolean;
  refreshInterval: number;
}

interface DashboardWidget {
  id: string;
  type: "counter" | "chart" | "table" | "gauge" | "heatmap";
  title: string;
  query: string;
  position: { x: number; y: number; width: number; height: number };
  config: Record<string, unknown>;
}

interface Report {
  id: string;
  name: string;
  description: string;
  query: string;
  format: ReportFormat;
  generatedAt: Date;
  generatedBy: string;
  data: unknown;
  metadata: Record<string, unknown>;
}

interface ScheduledReport {
  id: string;
  reportName: string;
  query: string;
  format: ReportFormat;
  frequency: ReportFrequency;
  recipients: string[];
  lastRunAt?: Date;
  nextRunAt: Date;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
}

interface Alert {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: "gt" | "lt" | "eq" | "gte" | "lte";
  threshold: number;
  severity: AlertSeverity;
  status: AlertStatus;
  recipients: string[];
  cooldownMinutes: number;
  lastTriggeredAt?: Date;
  createdBy: string;
  createdAt: Date;
}

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  actor: string;
  resource: string;
  resourceId?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: Date;
  uptime: number;
  components: Record<string, ComponentHealth>;
  activeConnections: number;
  queuedTasks: number;
  memoryUsage: number;
  cpuUsage: number;
}

interface ComponentHealth {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs: number;
  lastCheckAt: Date;
  errorCount: number;
  details?: Record<string, unknown>;
}

// =============================================================================
// Zod Schemas
// =============================================================================

const TrackEventSchema = z.object({
  name: z.string().min(1).max(200),
  properties: z.record(z.unknown()).optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const TrackAgentActionSchema = z.object({
  agentId: z.string(),
  action: z.string(),
  success: z.boolean().default(true),
  latencyMs: z.number().optional(),
  tokensUsed: z.number().optional(),
  costUsd: z.number().optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  input: z.record(z.unknown()).optional(),
  output: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const TrackToolUsageSchema = z.object({
  toolName: z.string(),
  agentId: z.string().optional(),
  success: z.boolean().default(true),
  latencyMs: z.number().optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  input: z.record(z.unknown()).optional(),
  output: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const GetAgentMetricsSchema = z.object({
  agentId: z.string().optional(),
  period: z.enum(["hour", "day", "week", "month", "year"]).default("day"),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

const GetToolMetricsSchema = z.object({
  toolName: z.string().optional(),
  period: z.enum(["hour", "day", "week", "month", "year"]).default("day"),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

const GetSessionMetricsSchema = z.object({
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  period: z.enum(["hour", "day", "week", "month", "year"]).default("day"),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.number().min(1).max(1000).default(100),
});

const GetUserMetricsSchema = z.object({
  userId: z.string().optional(),
  period: z.enum(["hour", "day", "week", "month", "year"]).default("day"),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.number().min(1).max(1000).default(100),
});

const GetCostMetricsSchema = z.object({
  period: z.enum(["hour", "day", "week", "month", "year"]).default("day"),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  groupBy: z.enum(["model", "agent", "user", "none"]).default("none"),
});

const CreateDashboardSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  createdBy: z.string(),
  widgets: z.array(z.object({
    type: z.enum(["counter", "chart", "table", "gauge", "heatmap"]),
    title: z.string(),
    query: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }).optional(),
    config: z.record(z.unknown()).optional(),
  })).default([]),
  isPublic: z.boolean().default(false),
  refreshInterval: z.number().min(10).max(3600).default(60),
});

const GetDashboardSchema = z.object({
  dashboardId: z.string(),
});

const ListDashboardsSchema = z.object({
  createdBy: z.string().optional(),
  isPublic: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(50),
});

const CreateReportSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  query: z.string(),
  format: z.enum(["json", "csv", "markdown"]).default("json"),
  generatedBy: z.string(),
  parameters: z.record(z.unknown()).optional(),
});

const ScheduleReportSchema = z.object({
  reportName: z.string().min(1).max(200),
  query: z.string(),
  format: z.enum(["json", "csv", "markdown"]).default("json"),
  frequency: z.enum(["hourly", "daily", "weekly", "monthly"]),
  recipients: z.array(z.string()).min(1),
  createdBy: z.string(),
  startAt: z.string().optional(),
});

const GetRealTimeStatsSchema = z.object({
  metrics: z.array(z.string()).optional(),
  windowMinutes: z.number().min(1).max(60).default(5),
});

const QueryAnalyticsSchema = z.object({
  query: z.string(),
  parameters: z.record(z.unknown()).optional(),
  limit: z.number().min(1).max(10000).default(1000),
  offset: z.number().min(0).default(0),
});

const ExportAnalyticsSchema = z.object({
  eventTypes: z.array(z.enum(["custom", "agent_action", "tool_usage", "session", "error", "system"])).optional(),
  fromDate: z.string(),
  toDate: z.string(),
  format: z.enum(["json", "csv"]).default("json"),
  includeMetadata: z.boolean().default(true),
});

const SetAlertSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  metric: z.string(),
  condition: z.enum(["gt", "lt", "eq", "gte", "lte"]),
  threshold: z.number(),
  severity: z.enum(["info", "warning", "critical"]).default("warning"),
  recipients: z.array(z.string()).default([]),
  cooldownMinutes: z.number().min(1).max(1440).default(15),
  createdBy: z.string(),
});

const ListAlertsSchema = z.object({
  status: z.enum(["active", "triggered", "acknowledged", "resolved", "disabled"]).optional(),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  limit: z.number().min(1).max(100).default(50),
});

const GetSystemHealthSchema = z.object({
  includeComponents: z.boolean().default(true),
});

const GetAuditLogSchema = z.object({
  actor: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  successOnly: z.boolean().optional(),
  limit: z.number().min(1).max(1000).default(100),
});

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Event Tracking Tools
  {
    name: "track_event",
    description: "Track a custom event in the KOSMOS analytics system",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Event name (max 200 chars)" },
        properties: { type: "object", description: "Custom event properties" },
        sessionId: { type: "string", description: "Session identifier" },
        userId: { type: "string", description: "User identifier" },
        metadata: { type: "object", description: "Additional metadata" },
      },
      required: ["name"],
    },
  },
  {
    name: "track_agent_action",
    description: "Track an agent action with performance metrics",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Agent identifier" },
        action: { type: "string", description: "Action name/type" },
        success: { type: "boolean", description: "Whether action succeeded" },
        latencyMs: { type: "number", description: "Action latency in milliseconds" },
        tokensUsed: { type: "number", description: "Tokens consumed" },
        costUsd: { type: "number", description: "Cost in USD" },
        sessionId: { type: "string", description: "Session identifier" },
        userId: { type: "string", description: "User identifier" },
        input: { type: "object", description: "Action input" },
        output: { type: "object", description: "Action output" },
        error: { type: "string", description: "Error message if failed" },
        metadata: { type: "object", description: "Additional metadata" },
      },
      required: ["agentId", "action"],
    },
  },
  {
    name: "track_tool_usage",
    description: "Track a tool invocation with metrics",
    inputSchema: {
      type: "object",
      properties: {
        toolName: { type: "string", description: "Tool name" },
        agentId: { type: "string", description: "Agent that used the tool" },
        success: { type: "boolean", description: "Whether invocation succeeded" },
        latencyMs: { type: "number", description: "Invocation latency in milliseconds" },
        sessionId: { type: "string", description: "Session identifier" },
        userId: { type: "string", description: "User identifier" },
        input: { type: "object", description: "Tool input" },
        output: { type: "object", description: "Tool output" },
        error: { type: "string", description: "Error message if failed" },
        metadata: { type: "object", description: "Additional metadata" },
      },
      required: ["toolName"],
    },
  },

  // Metrics Retrieval Tools
  {
    name: "get_agent_metrics",
    description: "Get performance metrics for agents",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Specific agent ID (optional for all agents)" },
        period: { type: "string", enum: ["hour", "day", "week", "month", "year"], description: "Time period for aggregation" },
        fromDate: { type: "string", description: "Start date (ISO format)" },
        toDate: { type: "string", description: "End date (ISO format)" },
      },
    },
  },
  {
    name: "get_tool_metrics",
    description: "Get usage statistics for tools",
    inputSchema: {
      type: "object",
      properties: {
        toolName: { type: "string", description: "Specific tool name (optional for all tools)" },
        period: { type: "string", enum: ["hour", "day", "week", "month", "year"], description: "Time period for aggregation" },
        fromDate: { type: "string", description: "Start date (ISO format)" },
        toDate: { type: "string", description: "End date (ISO format)" },
      },
    },
  },
  {
    name: "get_session_metrics",
    description: "Get session analytics",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "Specific session ID" },
        userId: { type: "string", description: "Filter by user ID" },
        period: { type: "string", enum: ["hour", "day", "week", "month", "year"], description: "Time period" },
        fromDate: { type: "string", description: "Start date (ISO format)" },
        toDate: { type: "string", description: "End date (ISO format)" },
        limit: { type: "number", description: "Maximum results to return" },
      },
    },
  },
  {
    name: "get_user_metrics",
    description: "Get user activity metrics",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "Specific user ID (optional for all users)" },
        period: { type: "string", enum: ["hour", "day", "week", "month", "year"], description: "Time period" },
        fromDate: { type: "string", description: "Start date (ISO format)" },
        toDate: { type: "string", description: "End date (ISO format)" },
        limit: { type: "number", description: "Maximum results to return" },
      },
    },
  },
  {
    name: "get_cost_metrics",
    description: "Get token usage and cost analytics",
    inputSchema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["hour", "day", "week", "month", "year"], description: "Time period for aggregation" },
        fromDate: { type: "string", description: "Start date (ISO format)" },
        toDate: { type: "string", description: "End date (ISO format)" },
        groupBy: { type: "string", enum: ["model", "agent", "user", "none"], description: "Grouping for breakdown" },
      },
    },
  },

  // Dashboard Tools
  {
    name: "create_dashboard",
    description: "Create an analytics dashboard",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Dashboard name" },
        description: { type: "string", description: "Dashboard description" },
        createdBy: { type: "string", description: "Creator identifier" },
        widgets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["counter", "chart", "table", "gauge", "heatmap"] },
              title: { type: "string" },
              query: { type: "string" },
              position: {
                type: "object",
                properties: {
                  x: { type: "number" },
                  y: { type: "number" },
                  width: { type: "number" },
                  height: { type: "number" },
                },
              },
              config: { type: "object" },
            },
            required: ["type", "title", "query"],
          },
          description: "Dashboard widgets",
        },
        isPublic: { type: "boolean", description: "Whether dashboard is public" },
        refreshInterval: { type: "number", description: "Auto-refresh interval in seconds" },
      },
      required: ["name", "createdBy"],
    },
  },
  {
    name: "get_dashboard",
    description: "Get dashboard data with widget results",
    inputSchema: {
      type: "object",
      properties: {
        dashboardId: { type: "string", description: "Dashboard ID" },
      },
      required: ["dashboardId"],
    },
  },
  {
    name: "list_dashboards",
    description: "List available dashboards",
    inputSchema: {
      type: "object",
      properties: {
        createdBy: { type: "string", description: "Filter by creator" },
        isPublic: { type: "boolean", description: "Filter by public status" },
        limit: { type: "number", description: "Maximum results to return" },
      },
    },
  },

  // Report Tools
  {
    name: "create_report",
    description: "Generate an analytics report",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Report name" },
        description: { type: "string", description: "Report description" },
        query: { type: "string", description: "Analytics query to run" },
        format: { type: "string", enum: ["json", "csv", "markdown"], description: "Output format" },
        generatedBy: { type: "string", description: "Generator identifier" },
        parameters: { type: "object", description: "Query parameters" },
      },
      required: ["name", "query", "generatedBy"],
    },
  },
  {
    name: "schedule_report",
    description: "Schedule a recurring report",
    inputSchema: {
      type: "object",
      properties: {
        reportName: { type: "string", description: "Report name" },
        query: { type: "string", description: "Analytics query" },
        format: { type: "string", enum: ["json", "csv", "markdown"], description: "Output format" },
        frequency: { type: "string", enum: ["hourly", "daily", "weekly", "monthly"], description: "Report frequency" },
        recipients: { type: "array", items: { type: "string" }, description: "Email recipients" },
        createdBy: { type: "string", description: "Creator identifier" },
        startAt: { type: "string", description: "Start time (ISO format)" },
      },
      required: ["reportName", "query", "frequency", "recipients", "createdBy"],
    },
  },

  // Real-time & Query Tools
  {
    name: "get_real_time_stats",
    description: "Get real-time statistics for the platform",
    inputSchema: {
      type: "object",
      properties: {
        metrics: { type: "array", items: { type: "string" }, description: "Specific metrics to retrieve" },
        windowMinutes: { type: "number", description: "Time window in minutes (1-60)" },
      },
    },
  },
  {
    name: "query_analytics",
    description: "Run a custom analytics query",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Query string (supports SQL-like syntax)" },
        parameters: { type: "object", description: "Query parameters" },
        limit: { type: "number", description: "Maximum results" },
        offset: { type: "number", description: "Result offset for pagination" },
      },
      required: ["query"],
    },
  },
  {
    name: "export_analytics",
    description: "Export analytics data",
    inputSchema: {
      type: "object",
      properties: {
        eventTypes: {
          type: "array",
          items: { type: "string", enum: ["custom", "agent_action", "tool_usage", "session", "error", "system"] },
          description: "Event types to export",
        },
        fromDate: { type: "string", description: "Start date (ISO format)" },
        toDate: { type: "string", description: "End date (ISO format)" },
        format: { type: "string", enum: ["json", "csv"], description: "Export format" },
        includeMetadata: { type: "boolean", description: "Include event metadata" },
      },
      required: ["fromDate", "toDate"],
    },
  },

  // Alert Tools
  {
    name: "set_alert",
    description: "Set a metric alert threshold",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Alert name" },
        description: { type: "string", description: "Alert description" },
        metric: { type: "string", description: "Metric to monitor" },
        condition: { type: "string", enum: ["gt", "lt", "eq", "gte", "lte"], description: "Alert condition" },
        threshold: { type: "number", description: "Threshold value" },
        severity: { type: "string", enum: ["info", "warning", "critical"], description: "Alert severity" },
        recipients: { type: "array", items: { type: "string" }, description: "Notification recipients" },
        cooldownMinutes: { type: "number", description: "Cooldown between alerts" },
        createdBy: { type: "string", description: "Creator identifier" },
      },
      required: ["name", "metric", "condition", "threshold", "createdBy"],
    },
  },
  {
    name: "list_alerts",
    description: "List configured alerts",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["active", "triggered", "acknowledged", "resolved", "disabled"], description: "Filter by status" },
        severity: { type: "string", enum: ["info", "warning", "critical"], description: "Filter by severity" },
        limit: { type: "number", description: "Maximum results to return" },
      },
    },
  },

  // System Tools
  {
    name: "get_system_health",
    description: "Get KOSMOS system health status",
    inputSchema: {
      type: "object",
      properties: {
        includeComponents: { type: "boolean", description: "Include component-level health details" },
      },
    },
  },
  {
    name: "get_audit_log",
    description: "Get audit trail of system actions",
    inputSchema: {
      type: "object",
      properties: {
        actor: { type: "string", description: "Filter by actor" },
        action: { type: "string", description: "Filter by action type" },
        resource: { type: "string", description: "Filter by resource type" },
        fromDate: { type: "string", description: "Start date (ISO format)" },
        toDate: { type: "string", description: "End date (ISO format)" },
        successOnly: { type: "boolean", description: "Only successful actions" },
        limit: { type: "number", description: "Maximum results to return" },
      },
    },
  },
];

// =============================================================================
// In-Memory Storage
// =============================================================================

const events: Map<string, AnalyticsEvent> = new Map();
const dashboards: Map<string, Dashboard> = new Map();
const reports: Map<string, Report> = new Map();
const scheduledReports: Map<string, ScheduledReport> = new Map();
const alerts: Map<string, Alert> = new Map();
const auditLog: Map<string, AuditLogEntry> = new Map();

// Aggregated metrics caches
const agentMetricsCache: Map<string, AgentMetrics> = new Map();
const toolMetricsCache: Map<string, ToolMetrics> = new Map();
const sessionMetricsCache: Map<string, SessionMetrics> = new Map();
const userMetricsCache: Map<string, UserMetrics> = new Map();

// System start time for uptime calculation
const systemStartTime = Date.now();

// =============================================================================
// Helper Functions
// =============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getDateRange(period: MetricPeriod, fromDate?: string, toDate?: string): { start: Date; end: Date } {
  const end = toDate ? new Date(toDate) : new Date();
  let start: Date;

  if (fromDate) {
    start = new Date(fromDate);
  } else {
    switch (period) {
      case "hour":
        start = new Date(end.getTime() - 60 * 60 * 1000);
        break;
      case "day":
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
    }
  }

  return { start, end };
}

function filterEventsByDateRange(start: Date, end: Date): AnalyticsEvent[] {
  return Array.from(events.values()).filter(
    (e) => e.timestamp >= start && e.timestamp <= end
  );
}

function updateAgentMetrics(agentId: string, action: { success: boolean; latencyMs?: number; tokensUsed?: number; costUsd?: number; actionType?: string }) {
  let metrics = agentMetricsCache.get(agentId);
  if (!metrics) {
    metrics = {
      agentId,
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
      averageLatencyMs: 0,
      tokensConsumed: 0,
      costUsd: 0,
      lastActiveAt: new Date(),
      actionsByType: {},
    };
  }

  metrics.totalActions++;
  if (action.success) {
    metrics.successfulActions++;
  } else {
    metrics.failedActions++;
  }

  if (action.latencyMs !== undefined) {
    // Incremental average calculation
    metrics.averageLatencyMs = ((metrics.averageLatencyMs * (metrics.totalActions - 1)) + action.latencyMs) / metrics.totalActions;
  }

  if (action.tokensUsed !== undefined) {
    metrics.tokensConsumed += action.tokensUsed;
  }

  if (action.costUsd !== undefined) {
    metrics.costUsd += action.costUsd;
  }

  if (action.actionType) {
    metrics.actionsByType[action.actionType] = (metrics.actionsByType[action.actionType] || 0) + 1;
  }

  metrics.lastActiveAt = new Date();
  agentMetricsCache.set(agentId, metrics);
}

function updateToolMetrics(toolName: string, usage: { success: boolean; latencyMs?: number; agentId?: string }) {
  let metrics = toolMetricsCache.get(toolName);
  if (!metrics) {
    metrics = {
      toolName,
      totalInvocations: 0,
      successfulInvocations: 0,
      failedInvocations: 0,
      averageLatencyMs: 0,
      invocationsByAgent: {},
      lastUsedAt: new Date(),
    };
  }

  metrics.totalInvocations++;
  if (usage.success) {
    metrics.successfulInvocations++;
  } else {
    metrics.failedInvocations++;
  }

  if (usage.latencyMs !== undefined) {
    metrics.averageLatencyMs = ((metrics.averageLatencyMs * (metrics.totalInvocations - 1)) + usage.latencyMs) / metrics.totalInvocations;
  }

  if (usage.agentId) {
    metrics.invocationsByAgent[usage.agentId] = (metrics.invocationsByAgent[usage.agentId] || 0) + 1;
  }

  metrics.lastUsedAt = new Date();
  toolMetricsCache.set(toolName, metrics);
}

function updateUserMetrics(userId: string, event: { tokensUsed?: number; costUsd?: number; agentId?: string; toolName?: string }) {
  let metrics = userMetricsCache.get(userId);
  if (!metrics) {
    metrics = {
      userId,
      totalSessions: 0,
      totalEvents: 0,
      totalTokensConsumed: 0,
      totalCostUsd: 0,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      topAgents: [],
      topTools: [],
    };
  }

  metrics.totalEvents++;
  metrics.lastSeenAt = new Date();

  if (event.tokensUsed !== undefined) {
    metrics.totalTokensConsumed += event.tokensUsed;
  }

  if (event.costUsd !== undefined) {
    metrics.totalCostUsd += event.costUsd;
  }

  userMetricsCache.set(userId, metrics);
}

function logAudit(action: string, actor: string, resource: string, details: Record<string, unknown>, success: boolean, errorMessage?: string) {
  const entry: AuditLogEntry = {
    id: generateId("audit"),
    timestamp: new Date(),
    action,
    actor,
    resource,
    details,
    success,
    errorMessage,
  };
  auditLog.set(entry.id, entry);
}

// =============================================================================
// Tool Handlers
// =============================================================================

// Event Tracking Handlers

async function trackEvent(params: z.infer<typeof TrackEventSchema>): Promise<AnalyticsEvent> {
  const id = generateId("evt");
  const event: AnalyticsEvent = {
    id,
    type: "custom",
    name: params.name,
    timestamp: new Date(),
    sessionId: params.sessionId,
    userId: params.userId,
    properties: params.properties ?? {},
    metadata: params.metadata ?? {},
  };

  events.set(id, event);

  if (params.userId) {
    updateUserMetrics(params.userId, {});
  }

  logAudit("track_event", params.userId || "system", "event", { eventName: params.name }, true);

  return event;
}

async function trackAgentAction(params: z.infer<typeof TrackAgentActionSchema>): Promise<AnalyticsEvent> {
  const id = generateId("evt");
  const event: AnalyticsEvent = {
    id,
    type: "agent_action",
    name: params.action,
    timestamp: new Date(),
    sessionId: params.sessionId,
    userId: params.userId,
    agentId: params.agentId,
    properties: {
      success: params.success,
      latencyMs: params.latencyMs,
      tokensUsed: params.tokensUsed,
      costUsd: params.costUsd,
      input: params.input,
      output: params.output,
      error: params.error,
    },
    metadata: params.metadata ?? {},
  };

  events.set(id, event);

  updateAgentMetrics(params.agentId, {
    success: params.success ?? true,
    latencyMs: params.latencyMs,
    tokensUsed: params.tokensUsed,
    costUsd: params.costUsd,
    actionType: params.action,
  });

  if (params.userId) {
    updateUserMetrics(params.userId, {
      tokensUsed: params.tokensUsed,
      costUsd: params.costUsd,
      agentId: params.agentId,
    });
  }

  logAudit("track_agent_action", params.agentId, "agent", { action: params.action, success: params.success }, true);

  return event;
}

async function trackToolUsage(params: z.infer<typeof TrackToolUsageSchema>): Promise<AnalyticsEvent> {
  const id = generateId("evt");
  const event: AnalyticsEvent = {
    id,
    type: "tool_usage",
    name: params.toolName,
    timestamp: new Date(),
    sessionId: params.sessionId,
    userId: params.userId,
    agentId: params.agentId,
    toolName: params.toolName,
    properties: {
      success: params.success,
      latencyMs: params.latencyMs,
      input: params.input,
      output: params.output,
      error: params.error,
    },
    metadata: params.metadata ?? {},
  };

  events.set(id, event);

  updateToolMetrics(params.toolName, {
    success: params.success ?? true,
    latencyMs: params.latencyMs,
    agentId: params.agentId,
  });

  if (params.userId) {
    updateUserMetrics(params.userId, {
      toolName: params.toolName,
    });
  }

  logAudit("track_tool_usage", params.agentId || "system", "tool", { toolName: params.toolName, success: params.success }, true);

  return event;
}

// Metrics Retrieval Handlers

async function getAgentMetrics(params: z.infer<typeof GetAgentMetricsSchema>) {
  const { start, end } = getDateRange(params.period ?? "day", params.fromDate, params.toDate);

  if (params.agentId) {
    const metrics = agentMetricsCache.get(params.agentId);
    if (!metrics) {
      return { agentId: params.agentId, message: "No metrics found for this agent", period: { start, end } };
    }
    return { ...metrics, period: { start, end } };
  }

  // Return all agent metrics
  const allMetrics = Array.from(agentMetricsCache.values());
  return {
    agents: allMetrics,
    summary: {
      totalAgents: allMetrics.length,
      totalActions: allMetrics.reduce((sum, m) => sum + m.totalActions, 0),
      totalTokens: allMetrics.reduce((sum, m) => sum + m.tokensConsumed, 0),
      totalCost: allMetrics.reduce((sum, m) => sum + m.costUsd, 0),
      averageSuccessRate: allMetrics.length > 0
        ? allMetrics.reduce((sum, m) => sum + (m.successfulActions / (m.totalActions || 1)), 0) / allMetrics.length
        : 0,
    },
    period: { start, end },
  };
}

async function getToolMetrics(params: z.infer<typeof GetToolMetricsSchema>) {
  const { start, end } = getDateRange(params.period ?? "day", params.fromDate, params.toDate);

  if (params.toolName) {
    const metrics = toolMetricsCache.get(params.toolName);
    if (!metrics) {
      return { toolName: params.toolName, message: "No metrics found for this tool", period: { start, end } };
    }
    return { ...metrics, period: { start, end } };
  }

  // Return all tool metrics
  const allMetrics = Array.from(toolMetricsCache.values());
  return {
    tools: allMetrics.sort((a, b) => b.totalInvocations - a.totalInvocations),
    summary: {
      totalTools: allMetrics.length,
      totalInvocations: allMetrics.reduce((sum, m) => sum + m.totalInvocations, 0),
      averageSuccessRate: allMetrics.length > 0
        ? allMetrics.reduce((sum, m) => sum + (m.successfulInvocations / (m.totalInvocations || 1)), 0) / allMetrics.length
        : 0,
      averageLatencyMs: allMetrics.length > 0
        ? allMetrics.reduce((sum, m) => sum + m.averageLatencyMs, 0) / allMetrics.length
        : 0,
    },
    period: { start, end },
  };
}

async function getSessionMetrics(params: z.infer<typeof GetSessionMetricsSchema>) {
  const { start, end } = getDateRange(params.period ?? "day", params.fromDate, params.toDate);
  const filteredEvents = filterEventsByDateRange(start, end);

  // Group events by session
  const sessionMap = new Map<string, AnalyticsEvent[]>();
  for (const event of filteredEvents) {
    if (event.sessionId) {
      const existing = sessionMap.get(event.sessionId) || [];
      existing.push(event);
      sessionMap.set(event.sessionId, existing);
    }
  }

  // If specific session requested
  if (params.sessionId) {
    const sessionEvents = sessionMap.get(params.sessionId) || [];
    if (sessionEvents.length === 0) {
      return { sessionId: params.sessionId, message: "No events found for this session", period: { start, end } };
    }

    const agentsUsed = [...new Set(sessionEvents.filter(e => e.agentId).map(e => e.agentId!))];
    const toolsUsed = [...new Set(sessionEvents.filter(e => e.toolName).map(e => e.toolName!))];
    const tokensConsumed = sessionEvents.reduce((sum, e) => sum + ((e.properties.tokensUsed as number) || 0), 0);
    const costUsd = sessionEvents.reduce((sum, e) => sum + ((e.properties.costUsd as number) || 0), 0);

    return {
      sessionId: params.sessionId,
      eventCount: sessionEvents.length,
      agentsUsed,
      toolsUsed,
      tokensConsumed,
      costUsd,
      firstEvent: sessionEvents[0]?.timestamp,
      lastEvent: sessionEvents[sessionEvents.length - 1]?.timestamp,
      period: { start, end },
    };
  }

  // Filter by user if specified
  let sessions = Array.from(sessionMap.entries());
  if (params.userId) {
    sessions = sessions.filter(([, evts]) => evts.some(e => e.userId === params.userId));
  }

  // Return session summaries
  const sessionSummaries = sessions.slice(0, params.limit ?? 100).map(([sessionId, evts]) => ({
    sessionId,
    eventCount: evts.length,
    userId: evts[0]?.userId,
    startedAt: evts[0]?.timestamp,
    endedAt: evts[evts.length - 1]?.timestamp,
  }));

  return {
    sessions: sessionSummaries,
    summary: {
      totalSessions: sessions.length,
      totalEvents: filteredEvents.filter(e => e.sessionId).length,
    },
    period: { start, end },
  };
}

async function getUserMetrics(params: z.infer<typeof GetUserMetricsSchema>) {
  const { start, end } = getDateRange(params.period ?? "day", params.fromDate, params.toDate);

  if (params.userId) {
    const metrics = userMetricsCache.get(params.userId);
    if (!metrics) {
      return { userId: params.userId, message: "No metrics found for this user", period: { start, end } };
    }
    return { ...metrics, period: { start, end } };
  }

  // Return all user metrics
  const allMetrics = Array.from(userMetricsCache.values());
  return {
    users: allMetrics.slice(0, params.limit ?? 100).sort((a, b) => b.totalEvents - a.totalEvents),
    summary: {
      totalUsers: allMetrics.length,
      totalEvents: allMetrics.reduce((sum, m) => sum + m.totalEvents, 0),
      totalTokens: allMetrics.reduce((sum, m) => sum + m.totalTokensConsumed, 0),
      totalCost: allMetrics.reduce((sum, m) => sum + m.totalCostUsd, 0),
    },
    period: { start, end },
  };
}

async function getCostMetrics(params: z.infer<typeof GetCostMetricsSchema>) {
  const { start, end } = getDateRange(params.period ?? "day", params.fromDate, params.toDate);
  const filteredEvents = filterEventsByDateRange(start, end);

  // Aggregate cost data from events
  let totalTokens = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalCostUsd = 0;
  const costByModel: Record<string, number> = {};
  const costByAgent: Record<string, number> = {};
  const costByUser: Record<string, number> = {};

  for (const event of filteredEvents) {
    const tokens = (event.properties.tokensUsed as number) || 0;
    const cost = (event.properties.costUsd as number) || 0;
    const model = (event.metadata.model as string) || "unknown";

    totalTokens += tokens;
    totalCostUsd += cost;

    // Estimate prompt/completion split (60/40 default)
    promptTokens += Math.floor(tokens * 0.6);
    completionTokens += Math.floor(tokens * 0.4);

    costByModel[model] = (costByModel[model] || 0) + cost;

    if (event.agentId) {
      costByAgent[event.agentId] = (costByAgent[event.agentId] || 0) + cost;
    }

    if (event.userId) {
      costByUser[event.userId] = (costByUser[event.userId] || 0) + cost;
    }
  }

  const result: CostMetrics = {
    period: params.period ?? "day",
    startDate: start,
    endDate: end,
    totalTokens,
    promptTokens,
    completionTokens,
    totalCostUsd,
    costByModel,
    costByAgent,
    costByUser,
  };

  // Apply groupBy filter
  switch (params.groupBy) {
    case "model":
      return { ...result, breakdown: costByModel };
    case "agent":
      return { ...result, breakdown: costByAgent };
    case "user":
      return { ...result, breakdown: costByUser };
    default:
      return result;
  }
}

// Dashboard Handlers

async function createDashboard(params: z.infer<typeof CreateDashboardSchema>): Promise<Dashboard> {
  const id = generateId("dash");
  const now = new Date();

  const widgets: DashboardWidget[] = (params.widgets || []).map((w, idx) => ({
    id: generateId("widget"),
    type: w.type,
    title: w.title,
    query: w.query,
    position: w.position || { x: 0, y: idx * 4, width: 6, height: 4 },
    config: w.config || {},
  }));

  const dashboard: Dashboard = {
    id,
    name: params.name,
    description: params.description || "",
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
    widgets,
    isPublic: params.isPublic ?? false,
    refreshInterval: params.refreshInterval ?? 60,
  };

  dashboards.set(id, dashboard);
  logAudit("create_dashboard", params.createdBy, "dashboard", { dashboardId: id, name: params.name }, true);

  return dashboard;
}

async function getDashboard(params: z.infer<typeof GetDashboardSchema>) {
  const dashboard = dashboards.get(params.dashboardId);
  if (!dashboard) {
    throw new Error(`Dashboard not found: ${params.dashboardId}`);
  }

  // Execute each widget's query and attach results
  const widgetsWithData = dashboard.widgets.map(widget => {
    // Simulate query execution based on widget type
    let data: unknown;
    switch (widget.type) {
      case "counter":
        data = { value: events.size, label: widget.title };
        break;
      case "gauge":
        data = { value: Math.random() * 100, min: 0, max: 100 };
        break;
      case "chart":
        data = {
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
          values: Array.from({ length: 5 }, () => Math.floor(Math.random() * 100)),
        };
        break;
      case "table":
        data = {
          columns: ["Name", "Value"],
          rows: Array.from(events.values()).slice(0, 10).map(e => [e.name, e.type]),
        };
        break;
      case "heatmap":
        data = {
          xLabels: ["00", "06", "12", "18"],
          yLabels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
          values: Array.from({ length: 20 }, () => Math.floor(Math.random() * 100)),
        };
        break;
    }
    return { ...widget, data };
  });

  return {
    ...dashboard,
    widgets: widgetsWithData,
    retrievedAt: new Date(),
  };
}

async function listDashboards(params: z.infer<typeof ListDashboardsSchema>) {
  let dashboardList = Array.from(dashboards.values());

  if (params.createdBy) {
    dashboardList = dashboardList.filter(d => d.createdBy === params.createdBy);
  }

  if (params.isPublic !== undefined) {
    dashboardList = dashboardList.filter(d => d.isPublic === params.isPublic);
  }

  return {
    dashboards: dashboardList.slice(0, params.limit ?? 50).map(d => ({
      id: d.id,
      name: d.name,
      description: d.description,
      createdBy: d.createdBy,
      createdAt: d.createdAt,
      widgetCount: d.widgets.length,
      isPublic: d.isPublic,
    })),
    total: dashboardList.length,
  };
}

// Report Handlers

async function createReport(params: z.infer<typeof CreateReportSchema>): Promise<Report> {
  const id = generateId("report");

  // Execute the query (simplified - in production would parse and execute properly)
  let data: unknown;

  // Simple query parsing for demo
  if (params.query.toLowerCase().includes("agent")) {
    data = Array.from(agentMetricsCache.values());
  } else if (params.query.toLowerCase().includes("tool")) {
    data = Array.from(toolMetricsCache.values());
  } else if (params.query.toLowerCase().includes("user")) {
    data = Array.from(userMetricsCache.values());
  } else if (params.query.toLowerCase().includes("event")) {
    data = Array.from(events.values()).slice(-100);
  } else {
    data = { message: "Query executed", query: params.query, eventCount: events.size };
  }

  // Format the data
  let formattedData: unknown = data;
  if (params.format === "csv") {
    // Convert to CSV-like structure
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]);
      const rows = data.map(item => headers.map(h => (item as Record<string, unknown>)[h]));
      formattedData = { headers, rows };
    }
  } else if (params.format === "markdown") {
    // Convert to markdown table
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]);
      let markdown = `| ${headers.join(" | ")} |\n`;
      markdown += `| ${headers.map(() => "---").join(" | ")} |\n`;
      for (const item of data.slice(0, 20)) {
        markdown += `| ${headers.map(h => String((item as Record<string, unknown>)[h] ?? "")).join(" | ")} |\n`;
      }
      formattedData = { markdown, recordCount: data.length };
    }
  }

  const report: Report = {
    id,
    name: params.name,
    description: params.description || "",
    query: params.query,
    format: params.format ?? "json",
    generatedAt: new Date(),
    generatedBy: params.generatedBy,
    data: formattedData,
    metadata: params.parameters || {},
  };

  reports.set(id, report);
  logAudit("create_report", params.generatedBy, "report", { reportId: id, name: params.name }, true);

  return report;
}

async function scheduleReport(params: z.infer<typeof ScheduleReportSchema>): Promise<ScheduledReport> {
  const id = generateId("sched");
  const now = new Date();

  // Calculate next run time
  let nextRunAt = params.startAt ? new Date(params.startAt) : new Date();
  if (nextRunAt <= now) {
    switch (params.frequency) {
      case "hourly":
        nextRunAt = new Date(now.getTime() + 60 * 60 * 1000);
        break;
      case "daily":
        nextRunAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case "weekly":
        nextRunAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case "monthly":
        nextRunAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
    }
  }

  const scheduledReport: ScheduledReport = {
    id,
    reportName: params.reportName,
    query: params.query,
    format: params.format ?? "json",
    frequency: params.frequency,
    recipients: params.recipients,
    nextRunAt,
    isActive: true,
    createdBy: params.createdBy,
    createdAt: now,
  };

  scheduledReports.set(id, scheduledReport);
  logAudit("schedule_report", params.createdBy, "scheduled_report", { scheduleId: id, reportName: params.reportName }, true);

  return scheduledReport;
}

// Real-time & Query Handlers

async function getRealTimeStats(params: z.infer<typeof GetRealTimeStatsSchema>) {
  const windowMs = (params.windowMinutes ?? 5) * 60 * 1000;
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  const recentEvents = Array.from(events.values()).filter(
    (e) => e.timestamp >= windowStart
  );

  const stats = {
    timestamp: now,
    windowMinutes: params.windowMinutes ?? 5,
    eventCount: recentEvents.length,
    eventsPerMinute: recentEvents.length / (params.windowMinutes ?? 5),
    eventsByType: {} as Record<EventType, number>,
    activeAgents: new Set(recentEvents.filter(e => e.agentId).map(e => e.agentId)).size,
    activeUsers: new Set(recentEvents.filter(e => e.userId).map(e => e.userId)).size,
    activeSessions: new Set(recentEvents.filter(e => e.sessionId).map(e => e.sessionId)).size,
    errorCount: recentEvents.filter(e => e.type === "error").length,
    totalTokens: recentEvents.reduce((sum, e) => sum + ((e.properties.tokensUsed as number) || 0), 0),
    totalCost: recentEvents.reduce((sum, e) => sum + ((e.properties.costUsd as number) || 0), 0),
  };

  // Count events by type
  for (const event of recentEvents) {
    stats.eventsByType[event.type] = (stats.eventsByType[event.type] || 0) + 1;
  }

  // Filter to specific metrics if requested
  if (params.metrics && params.metrics.length > 0) {
    const filteredStats: Record<string, unknown> = {
      timestamp: stats.timestamp,
      windowMinutes: stats.windowMinutes,
    };
    for (const metric of params.metrics) {
      if (metric in stats) {
        filteredStats[metric] = (stats as Record<string, unknown>)[metric];
      }
    }
    return filteredStats;
  }

  return stats;
}

async function queryAnalytics(params: z.infer<typeof QueryAnalyticsSchema>) {
  const query = params.query.toLowerCase();
  let results: unknown[] = [];

  // Simple query parser for demo purposes
  if (query.includes("select") && query.includes("from events")) {
    results = Array.from(events.values()).map(e => ({
      id: e.id,
      type: e.type,
      name: e.name,
      timestamp: e.timestamp,
      userId: e.userId,
      agentId: e.agentId,
      sessionId: e.sessionId,
    }));
  } else if (query.includes("from agents") || query.includes("agent_metrics")) {
    results = Array.from(agentMetricsCache.values());
  } else if (query.includes("from tools") || query.includes("tool_metrics")) {
    results = Array.from(toolMetricsCache.values());
  } else if (query.includes("from users") || query.includes("user_metrics")) {
    results = Array.from(userMetricsCache.values());
  } else if (query.includes("from dashboards")) {
    results = Array.from(dashboards.values()).map(d => ({
      id: d.id,
      name: d.name,
      createdBy: d.createdBy,
      widgetCount: d.widgets.length,
    }));
  } else if (query.includes("from alerts")) {
    results = Array.from(alerts.values());
  } else if (query.includes("count")) {
    // Simple count query
    if (query.includes("events")) {
      return { count: events.size };
    } else if (query.includes("agents")) {
      return { count: agentMetricsCache.size };
    } else if (query.includes("tools")) {
      return { count: toolMetricsCache.size };
    }
  } else {
    // Default: return event summary
    results = [
      {
        totalEvents: events.size,
        totalAgents: agentMetricsCache.size,
        totalTools: toolMetricsCache.size,
        totalUsers: userMetricsCache.size,
        totalDashboards: dashboards.size,
        totalAlerts: alerts.size,
      },
    ];
  }

  // Apply pagination
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 1000;
  const paginatedResults = results.slice(offset, offset + limit);

  return {
    query: params.query,
    results: paginatedResults,
    total: results.length,
    offset,
    limit,
    hasMore: offset + limit < results.length,
  };
}

async function exportAnalytics(params: z.infer<typeof ExportAnalyticsSchema>) {
  const start = new Date(params.fromDate);
  const end = new Date(params.toDate);

  let filteredEvents = filterEventsByDateRange(start, end);

  // Filter by event types if specified
  if (params.eventTypes && params.eventTypes.length > 0) {
    filteredEvents = filteredEvents.filter(e => params.eventTypes!.includes(e.type));
  }

  // Format the export data
  const exportData = filteredEvents.map(e => {
    const base = {
      id: e.id,
      type: e.type,
      name: e.name,
      timestamp: e.timestamp.toISOString(),
      sessionId: e.sessionId,
      userId: e.userId,
      agentId: e.agentId,
      toolName: e.toolName,
      properties: e.properties,
    };

    if (params.includeMetadata) {
      return { ...base, metadata: e.metadata };
    }
    return base;
  });

  if (params.format === "csv") {
    // Convert to CSV format
    if (exportData.length === 0) {
      return { format: "csv", headers: [], rows: [], recordCount: 0 };
    }

    const headers = ["id", "type", "name", "timestamp", "sessionId", "userId", "agentId", "toolName"];
    const rows = exportData.map(item => headers.map(h => String((item as Record<string, unknown>)[h] ?? "")));

    return {
      format: "csv",
      headers,
      rows,
      recordCount: exportData.length,
      period: { start, end },
    };
  }

  return {
    format: "json",
    data: exportData,
    recordCount: exportData.length,
    period: { start, end },
  };
}

// Alert Handlers

async function setAlert(params: z.infer<typeof SetAlertSchema>): Promise<Alert> {
  const id = generateId("alert");

  const alert: Alert = {
    id,
    name: params.name,
    description: params.description || "",
    metric: params.metric,
    condition: params.condition,
    threshold: params.threshold,
    severity: params.severity ?? "warning",
    status: "active",
    recipients: params.recipients ?? [],
    cooldownMinutes: params.cooldownMinutes ?? 15,
    createdBy: params.createdBy,
    createdAt: new Date(),
  };

  alerts.set(id, alert);
  logAudit("set_alert", params.createdBy, "alert", { alertId: id, name: params.name, metric: params.metric }, true);

  return alert;
}

async function listAlerts(params: z.infer<typeof ListAlertsSchema>) {
  let alertList = Array.from(alerts.values());

  if (params.status) {
    alertList = alertList.filter(a => a.status === params.status);
  }

  if (params.severity) {
    alertList = alertList.filter(a => a.severity === params.severity);
  }

  return {
    alerts: alertList.slice(0, params.limit ?? 50).map(a => ({
      id: a.id,
      name: a.name,
      metric: a.metric,
      condition: a.condition,
      threshold: a.threshold,
      severity: a.severity,
      status: a.status,
      lastTriggeredAt: a.lastTriggeredAt,
      createdAt: a.createdAt,
    })),
    total: alertList.length,
  };
}

// System Handlers

async function getSystemHealth(params: z.infer<typeof GetSystemHealthSchema>): Promise<SystemHealth> {
  const now = Date.now();
  const uptime = now - systemStartTime;

  const components: Record<string, ComponentHealth> = {};

  if (params.includeComponents) {
    components["event_store"] = {
      name: "Event Store",
      status: "healthy",
      latencyMs: Math.random() * 10,
      lastCheckAt: new Date(),
      errorCount: 0,
      details: { eventCount: events.size },
    };

    components["metrics_aggregator"] = {
      name: "Metrics Aggregator",
      status: "healthy",
      latencyMs: Math.random() * 5,
      lastCheckAt: new Date(),
      errorCount: 0,
      details: {
        agentMetrics: agentMetricsCache.size,
        toolMetrics: toolMetricsCache.size,
        userMetrics: userMetricsCache.size,
      },
    };

    components["dashboard_service"] = {
      name: "Dashboard Service",
      status: dashboards.size > 0 ? "healthy" : "healthy",
      latencyMs: Math.random() * 8,
      lastCheckAt: new Date(),
      errorCount: 0,
      details: { dashboardCount: dashboards.size },
    };

    components["alert_engine"] = {
      name: "Alert Engine",
      status: "healthy",
      latencyMs: Math.random() * 3,
      lastCheckAt: new Date(),
      errorCount: 0,
      details: { activeAlerts: Array.from(alerts.values()).filter(a => a.status === "active").length },
    };

    components["audit_log"] = {
      name: "Audit Log",
      status: "healthy",
      latencyMs: Math.random() * 2,
      lastCheckAt: new Date(),
      errorCount: 0,
      details: { entryCount: auditLog.size },
    };
  }

  // Determine overall status
  const componentStatuses = Object.values(components).map(c => c.status);
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (componentStatuses.includes("unhealthy")) {
    overallStatus = "unhealthy";
  } else if (componentStatuses.includes("degraded")) {
    overallStatus = "degraded";
  }

  return {
    status: overallStatus,
    timestamp: new Date(),
    uptime,
    components,
    activeConnections: Math.floor(Math.random() * 50) + 10,
    queuedTasks: Math.floor(Math.random() * 20),
    memoryUsage: Math.random() * 0.7 + 0.2, // 20-90%
    cpuUsage: Math.random() * 0.5 + 0.1, // 10-60%
  };
}

async function getAuditLog(params: z.infer<typeof GetAuditLogSchema>) {
  let entries = Array.from(auditLog.values());

  // Apply filters
  if (params.actor) {
    entries = entries.filter(e => e.actor === params.actor);
  }

  if (params.action) {
    entries = entries.filter(e => e.action === params.action);
  }

  if (params.resource) {
    entries = entries.filter(e => e.resource === params.resource);
  }

  if (params.fromDate) {
    const from = new Date(params.fromDate);
    entries = entries.filter(e => e.timestamp >= from);
  }

  if (params.toDate) {
    const to = new Date(params.toDate);
    entries = entries.filter(e => e.timestamp <= to);
  }

  if (params.successOnly !== undefined) {
    entries = entries.filter(e => e.success === params.successOnly);
  }

  // Sort by timestamp descending
  entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return {
    entries: entries.slice(0, params.limit ?? 100).map(e => ({
      id: e.id,
      timestamp: e.timestamp,
      action: e.action,
      actor: e.actor,
      resource: e.resource,
      resourceId: e.resourceId,
      success: e.success,
      errorMessage: e.errorMessage,
      details: e.details,
    })),
    total: entries.length,
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "kosmos-analytics-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      // Event Tracking
      case "track_event":
        result = await trackEvent(TrackEventSchema.parse(args));
        break;
      case "track_agent_action":
        result = await trackAgentAction(TrackAgentActionSchema.parse(args));
        break;
      case "track_tool_usage":
        result = await trackToolUsage(TrackToolUsageSchema.parse(args));
        break;

      // Metrics Retrieval
      case "get_agent_metrics":
        result = await getAgentMetrics(GetAgentMetricsSchema.parse(args ?? {}));
        break;
      case "get_tool_metrics":
        result = await getToolMetrics(GetToolMetricsSchema.parse(args ?? {}));
        break;
      case "get_session_metrics":
        result = await getSessionMetrics(GetSessionMetricsSchema.parse(args ?? {}));
        break;
      case "get_user_metrics":
        result = await getUserMetrics(GetUserMetricsSchema.parse(args ?? {}));
        break;
      case "get_cost_metrics":
        result = await getCostMetrics(GetCostMetricsSchema.parse(args ?? {}));
        break;

      // Dashboards
      case "create_dashboard":
        result = await createDashboard(CreateDashboardSchema.parse(args));
        break;
      case "get_dashboard":
        result = await getDashboard(GetDashboardSchema.parse(args));
        break;
      case "list_dashboards":
        result = await listDashboards(ListDashboardsSchema.parse(args ?? {}));
        break;

      // Reports
      case "create_report":
        result = await createReport(CreateReportSchema.parse(args));
        break;
      case "schedule_report":
        result = await scheduleReport(ScheduleReportSchema.parse(args));
        break;

      // Real-time & Queries
      case "get_real_time_stats":
        result = await getRealTimeStats(GetRealTimeStatsSchema.parse(args ?? {}));
        break;
      case "query_analytics":
        result = await queryAnalytics(QueryAnalyticsSchema.parse(args));
        break;
      case "export_analytics":
        result = await exportAnalytics(ExportAnalyticsSchema.parse(args));
        break;

      // Alerts
      case "set_alert":
        result = await setAlert(SetAlertSchema.parse(args));
        break;
      case "list_alerts":
        result = await listAlerts(ListAlertsSchema.parse(args ?? {}));
        break;

      // System
      case "get_system_health":
        result = await getSystemHealth(GetSystemHealthSchema.parse(args ?? {}));
        break;
      case "get_audit_log":
        result = await getAuditLog(GetAuditLogSchema.parse(args ?? {}));
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("KOSMOS Analytics MCP Server started");
}

main().catch(console.error);
