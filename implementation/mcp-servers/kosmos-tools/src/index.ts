/**
 * KOSMOS Tools MCP Server
 *
 * Core tools for KOSMOS agent operations including:
 * - Cost estimation
 * - Agent routing
 * - Tenant context
 * - Audit logging
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Tool schemas
const EstimateCostSchema = z.object({
  model: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  toolCalls: z.array(z.string()).optional(),
});

const CheckBudgetSchema = z.object({
  tenantId: z.string(),
  estimatedCost: z.number(),
  period: z.enum(["daily", "weekly", "monthly"]).default("daily"),
});

const RouteAgentSchema = z.object({
  query: z.string(),
  context: z.record(z.unknown()).optional(),
});

const AuditLogSchema = z.object({
  eventType: z.string(),
  actor: z.string(),
  resource: z.string(),
  action: z.string(),
  outcome: z.enum(["success", "failure"]),
  metadata: z.record(z.unknown()).optional(),
});

const GetTenantContextSchema = z.object({
  tenantId: z.string(),
});

const ValidatePermissionSchema = z.object({
  userId: z.string(),
  resource: z.string(),
  action: z.string(),
});

// Model costs per 1K tokens
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "claude-3-5-sonnet": { input: 0.003, output: 0.015 },
  "claude-3-5-haiku": { input: 0.0008, output: 0.004 },
  "mistral-7b": { input: 0.0001, output: 0.0001 },
  "llama-3.2-3b": { input: 0.00005, output: 0.00005 },
};

// Tool costs (estimated)
const TOOL_COSTS: Record<string, number> = {
  web_search: 0.01,
  code_execution: 0.005,
  database_query: 0.002,
  file_read: 0.001,
  file_write: 0.001,
};

// Agent routing keywords
const AGENT_ROUTING: Record<string, string[]> = {
  zeus: ["orchestrate", "coordinate", "manage"],
  hermes: ["data", "fetch", "integrate", "transform"],
  aegis: ["security", "authenticate", "authorize", "protect"],
  athena: ["analyze", "insight", "report", "strategy"],
  chronos: ["schedule", "calendar", "remind", "time"],
  hephaestus: ["code", "develop", "build", "deploy"],
  nur_prometheus: ["cost", "budget", "finance", "expense"],
  iris: ["notify", "message", "communicate", "alert"],
  memorix: ["remember", "memory", "recall", "knowledge"],
  hestia: ["monitor", "health", "operations", "infrastructure"],
  morpheus: ["predict", "forecast", "simulate", "scenario"],
};

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "estimate_cost",
    description: "Estimate the cost of an LLM operation",
    inputSchema: {
      type: "object",
      properties: {
        model: {
          type: "string",
          description: "Model name (e.g., gpt-4o, claude-3-5-sonnet)",
        },
        inputTokens: {
          type: "number",
          description: "Estimated input tokens",
        },
        outputTokens: {
          type: "number",
          description: "Estimated output tokens",
        },
        toolCalls: {
          type: "array",
          items: { type: "string" },
          description: "Tool names to be called",
        },
      },
      required: ["model", "inputTokens", "outputTokens"],
    },
  },
  {
    name: "check_budget",
    description: "Check if a cost is within budget limits",
    inputSchema: {
      type: "object",
      properties: {
        tenantId: {
          type: "string",
          description: "Tenant ID",
        },
        estimatedCost: {
          type: "number",
          description: "Estimated cost in USD",
        },
        period: {
          type: "string",
          enum: ["daily", "weekly", "monthly"],
          default: "daily",
        },
      },
      required: ["tenantId", "estimatedCost"],
    },
  },
  {
    name: "route_agent",
    description: "Determine which agent should handle a request",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "User query to route",
        },
        context: {
          type: "object",
          description: "Additional context",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "audit_log",
    description: "Log an audit event",
    inputSchema: {
      type: "object",
      properties: {
        eventType: {
          type: "string",
          description: "Type of event",
        },
        actor: {
          type: "string",
          description: "Who performed the action",
        },
        resource: {
          type: "string",
          description: "Resource affected",
        },
        action: {
          type: "string",
          description: "Action performed",
        },
        outcome: {
          type: "string",
          enum: ["success", "failure"],
        },
        metadata: {
          type: "object",
          description: "Additional metadata",
        },
      },
      required: ["eventType", "actor", "resource", "action", "outcome"],
    },
  },
  {
    name: "get_tenant_context",
    description: "Get tenant configuration and limits",
    inputSchema: {
      type: "object",
      properties: {
        tenantId: {
          type: "string",
          description: "Tenant ID",
        },
      },
      required: ["tenantId"],
    },
  },
  {
    name: "validate_permission",
    description: "Validate if a user has permission for an action",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "User ID",
        },
        resource: {
          type: "string",
          description: "Resource to access",
        },
        action: {
          type: "string",
          description: "Action to perform",
        },
      },
      required: ["userId", "resource", "action"],
    },
  },
];

// Tool implementations
async function estimateCost(params: z.infer<typeof EstimateCostSchema>) {
  const modelCost = MODEL_COSTS[params.model] ?? MODEL_COSTS["gpt-4o"];

  let llmCost =
    (modelCost.input * params.inputTokens) / 1000 +
    (modelCost.output * params.outputTokens) / 1000;

  let toolCost = 0;
  if (params.toolCalls) {
    for (const tool of params.toolCalls) {
      toolCost += TOOL_COSTS[tool] ?? 0.001;
    }
  }

  const totalCost = llmCost + toolCost;

  return {
    model: params.model,
    llmCost: llmCost.toFixed(6),
    toolCost: toolCost.toFixed(6),
    totalCost: totalCost.toFixed(6),
    breakdown: {
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      inputCostPer1k: modelCost.input,
      outputCostPer1k: modelCost.output,
      tools: params.toolCalls ?? [],
    },
  };
}

async function checkBudget(params: z.infer<typeof CheckBudgetSchema>) {
  // In production, query actual usage from database
  const mockUsage: Record<string, { daily: number; weekly: number; monthly: number }> = {
    default: { daily: 25, weekly: 150, monthly: 450 },
  };

  const limits: Record<string, { daily: number; weekly: number; monthly: number }> = {
    default: { daily: 500, weekly: 2000, monthly: 10000 },
  };

  const usage = mockUsage[params.tenantId] ?? mockUsage.default;
  const limit = limits[params.tenantId] ?? limits.default;

  const currentUsage = usage[params.period];
  const currentLimit = limit[params.period];
  const remaining = currentLimit - currentUsage;
  const withinBudget = params.estimatedCost <= remaining;

  return {
    tenantId: params.tenantId,
    period: params.period,
    currentUsage,
    limit: currentLimit,
    remaining,
    estimatedCost: params.estimatedCost,
    withinBudget,
    utilizationPercent: ((currentUsage / currentLimit) * 100).toFixed(1),
    autoApprove: params.estimatedCost <= 50,
    requiresPentarchy: params.estimatedCost > 50 && params.estimatedCost <= 100,
    denied: params.estimatedCost > 100 || !withinBudget,
  };
}

async function routeAgent(params: z.infer<typeof RouteAgentSchema>) {
  const queryLower = params.query.toLowerCase();
  const scores: Record<string, number> = {};

  // Score each agent based on keyword matches
  for (const [agent, keywords] of Object.entries(AGENT_ROUTING)) {
    scores[agent] = 0;
    for (const keyword of keywords) {
      if (queryLower.includes(keyword)) {
        scores[agent] += 1;
      }
    }
  }

  // Sort by score
  const ranked = Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort(([, a], [, b]) => b - a);

  if (ranked.length === 0) {
    // Default to athena for analysis
    return {
      primaryAgent: "athena",
      confidence: 0.5,
      reason: "No specific domain detected, defaulting to analysis",
      allScores: scores,
    };
  }

  const [primaryAgent, primaryScore] = ranked[0];
  const confidence = Math.min(primaryScore / 3, 1);

  return {
    primaryAgent,
    confidence,
    reason: `Matched keywords for ${primaryAgent}`,
    secondaryAgents: ranked.slice(1, 3).map(([agent]) => agent),
    allScores: scores,
  };
}

async function auditLog(params: z.infer<typeof AuditLogSchema>) {
  const auditEntry = {
    id: `audit_${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...params,
  };

  // In production, write to database
  console.error("AUDIT:", JSON.stringify(auditEntry));

  return auditEntry;
}

async function getTenantContext(params: z.infer<typeof GetTenantContextSchema>) {
  // In production, fetch from database
  return {
    tenantId: params.tenantId,
    name: `Tenant ${params.tenantId}`,
    tier: "enterprise",
    features: {
      pentarchyEnabled: true,
      customAgents: true,
      advancedAnalytics: true,
      slaGuarantee: "99.9%",
    },
    limits: {
      dailyCost: 500,
      monthlyCost: 10000,
      concurrentAgents: 11,
      mcpServers: 88,
    },
    settings: {
      defaultModel: "claude-3-5-sonnet",
      memoryRetention: "90d",
      auditRetention: "365d",
    },
  };
}

async function validatePermission(params: z.infer<typeof ValidatePermissionSchema>) {
  // In production, check against RBAC/ABAC policies
  const permission = `${params.resource}:${params.action}`;

  // Mock permissions
  const allowed = true; // Simplified

  return {
    userId: params.userId,
    resource: params.resource,
    action: params.action,
    permission,
    allowed,
    checkedAt: new Date().toISOString(),
  };
}

// Create server
const server = new Server(
  {
    name: "kosmos-tools-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Call tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "estimate_cost":
        result = await estimateCost(EstimateCostSchema.parse(args));
        break;
      case "check_budget":
        result = await checkBudget(CheckBudgetSchema.parse(args));
        break;
      case "route_agent":
        result = await routeAgent(RouteAgentSchema.parse(args));
        break;
      case "audit_log":
        result = await auditLog(AuditLogSchema.parse(args));
        break;
      case "get_tenant_context":
        result = await getTenantContext(GetTenantContextSchema.parse(args));
        break;
      case "validate_permission":
        result = await validatePermission(ValidatePermissionSchema.parse(args));
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

// Start
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("KOSMOS Tools MCP Server started");
}

main().catch(console.error);
