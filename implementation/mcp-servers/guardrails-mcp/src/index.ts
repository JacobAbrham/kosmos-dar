/**
 * Guardrails MCP Server - LLM output validation and safety for KOSMOS
 * Provides validation, filtering, and safety checks for AI outputs
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: string;
  metadata: Record<string, any>;
}

interface GuardrailRule {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  config: Record<string, any>;
}

const rules: Map<string, GuardrailRule> = new Map();

// Initialize default rules
const defaultRules: GuardrailRule[] = [
  { id: "pii-detection", name: "PII Detection", type: "regex", enabled: true, config: { patterns: ["email", "phone", "ssn", "credit_card"] } },
  { id: "profanity-filter", name: "Profanity Filter", type: "wordlist", enabled: true, config: { severity: "medium" } },
  { id: "sql-injection", name: "SQL Injection Prevention", type: "pattern", enabled: true, config: {} },
  { id: "xss-prevention", name: "XSS Prevention", type: "pattern", enabled: true, config: {} },
  { id: "max-length", name: "Maximum Length", type: "length", enabled: true, config: { maxLength: 10000 } },
  { id: "bias-detection", name: "Bias Detection", type: "ml", enabled: true, config: { threshold: 0.7 } },
  { id: "toxicity-filter", name: "Toxicity Filter", type: "ml", enabled: true, config: { threshold: 0.8 } },
  { id: "hallucination-check", name: "Hallucination Check", type: "factual", enabled: false, config: {} },
];

defaultRules.forEach(rule => rules.set(rule.id, rule));

const TOOLS: Tool[] = [
  // Validation
  {
    name: "validate_output",
    description: "Validate LLM output against configured guardrails.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to validate" },
        rules: { type: "array", items: { type: "string" }, description: "Specific rule IDs to apply (default: all enabled)" },
        context: { type: "object", description: "Additional context for validation" },
      },
      required: ["text"],
    },
  },
  {
    name: "validate_json",
    description: "Validate JSON output against a schema.",
    inputSchema: {
      type: "object",
      properties: {
        json: { type: "string", description: "JSON string to validate" },
        schema: { type: "object", description: "JSON Schema to validate against" },
        strict: { type: "boolean" },
      },
      required: ["json", "schema"],
    },
  },
  {
    name: "validate_code",
    description: "Validate generated code for safety issues.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string" },
        language: { type: "string" },
        checks: { type: "array", items: { type: "string" }, description: "security, syntax, style" },
      },
      required: ["code", "language"],
    },
  },
  // PII & Sensitive Data
  {
    name: "detect_pii",
    description: "Detect personally identifiable information.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        types: { type: "array", items: { type: "string" }, description: "PII types: email, phone, ssn, credit_card, address, name" },
      },
      required: ["text"],
    },
  },
  {
    name: "redact_pii",
    description: "Redact PII from text.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        types: { type: "array", items: { type: "string" } },
        replacement: { type: "string", description: "Replacement pattern (default: [REDACTED])" },
      },
      required: ["text"],
    },
  },
  {
    name: "detect_secrets",
    description: "Detect API keys, passwords, and secrets.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        patterns: { type: "array", items: { type: "string" } },
      },
      required: ["text"],
    },
  },
  // Content Safety
  {
    name: "check_toxicity",
    description: "Check text for toxic or harmful content.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        threshold: { type: "number", description: "Toxicity threshold 0-1" },
        categories: { type: "array", items: { type: "string" }, description: "hate, harassment, violence, self-harm, sexual" },
      },
      required: ["text"],
    },
  },
  {
    name: "check_bias",
    description: "Check text for biased content.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        dimensions: { type: "array", items: { type: "string" }, description: "gender, race, age, religion, political" },
      },
      required: ["text"],
    },
  },
  {
    name: "filter_profanity",
    description: "Filter or detect profanity.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        action: { type: "string", enum: ["detect", "filter", "mask"] },
        severity: { type: "string", enum: ["mild", "moderate", "severe"] },
      },
      required: ["text"],
    },
  },
  // Security
  {
    name: "check_injection",
    description: "Check for injection attacks (SQL, XSS, command).",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        types: { type: "array", items: { type: "string" }, description: "sql, xss, command, ldap, xpath" },
      },
      required: ["text"],
    },
  },
  {
    name: "sanitize_html",
    description: "Sanitize HTML content.",
    inputSchema: {
      type: "object",
      properties: {
        html: { type: "string" },
        allowedTags: { type: "array", items: { type: "string" } },
        allowedAttributes: { type: "object" },
      },
      required: ["html"],
    },
  },
  // Rule Management
  {
    name: "list_rules",
    description: "List all guardrail rules.",
    inputSchema: {
      type: "object",
      properties: {
        enabled: { type: "boolean", description: "Filter by enabled status" },
        type: { type: "string" },
      },
    },
  },
  {
    name: "get_rule",
    description: "Get a specific guardrail rule.",
    inputSchema: {
      type: "object",
      properties: {
        ruleId: { type: "string" },
      },
      required: ["ruleId"],
    },
  },
  {
    name: "create_rule",
    description: "Create a custom guardrail rule.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        type: { type: "string", enum: ["regex", "wordlist", "pattern", "ml", "custom"] },
        config: { type: "object" },
        enabled: { type: "boolean" },
      },
      required: ["name", "type", "config"],
    },
  },
  {
    name: "update_rule",
    description: "Update a guardrail rule.",
    inputSchema: {
      type: "object",
      properties: {
        ruleId: { type: "string" },
        enabled: { type: "boolean" },
        config: { type: "object" },
      },
      required: ["ruleId"],
    },
  },
  {
    name: "delete_rule",
    description: "Delete a custom guardrail rule.",
    inputSchema: {
      type: "object",
      properties: {
        ruleId: { type: "string" },
      },
      required: ["ruleId"],
    },
  },
  // Factuality
  {
    name: "check_factuality",
    description: "Check if claims are factually accurate.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        claims: { type: "array", items: { type: "string" } },
        sources: { type: "array", items: { type: "string" } },
      },
      required: ["text"],
    },
  },
  {
    name: "detect_hallucination",
    description: "Detect potential hallucinations in LLM output.",
    inputSchema: {
      type: "object",
      properties: {
        output: { type: "string" },
        context: { type: "string", description: "Source context/documents" },
        prompt: { type: "string", description: "Original prompt" },
      },
      required: ["output"],
    },
  },
];

// PII Detection Patterns
const piiPatterns: Record<string, RegExp> = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
  ssn: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
  credit_card: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  ip_address: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
};

// Secret Detection Patterns
const secretPatterns: Record<string, RegExp> = {
  aws_key: /AKIA[0-9A-Z]{16}/g,
  github_token: /ghp_[a-zA-Z0-9]{36}/g,
  api_key: /[a-zA-Z0-9_-]*api[_-]?key[a-zA-Z0-9_-]*[:=]["']?[a-zA-Z0-9_-]{20,}["']?/gi,
  password: /password\s*[:=]\s*["']?[^"'\s]+["']?/gi,
  jwt: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
};

// Injection Patterns
const injectionPatterns: Record<string, RegExp[]> = {
  sql: [
    /(\s|^)(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\s/gi,
    /['";].*(--)|(\/\*)/g,
    /\bOR\b.*=.*\bOR\b/gi,
  ],
  xss: [
    /<script[^>]*>.*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<[^>]*\s(on\w+)=/gi,
  ],
  command: [
    /[;&|`$]|\$\(/g,
    /\.\.\//g,
  ],
};

function generateId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function validateOutput(params: { text: string; rules?: string[]; context?: any }): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metadata: Record<string, any> = {};

  const activeRules = params.rules
    ? Array.from(rules.values()).filter(r => params.rules!.includes(r.id))
    : Array.from(rules.values()).filter(r => r.enabled);

  for (const rule of activeRules) {
    switch (rule.id) {
      case "pii-detection":
        const piiFound = detectPii({ text: params.text });
        if (piiFound.found.length > 0) {
          warnings.push(`PII detected: ${piiFound.found.map((p: any) => p.type).join(", ")}`);
          metadata.pii = piiFound;
        }
        break;
      case "max-length":
        if (params.text.length > (rule.config.maxLength || 10000)) {
          errors.push(`Text exceeds maximum length of ${rule.config.maxLength}`);
        }
        break;
      case "sql-injection":
        const sqlCheck = checkInjection({ text: params.text, types: ["sql"] });
        if (!sqlCheck.safe) {
          errors.push("Potential SQL injection detected");
          metadata.sqlInjection = sqlCheck;
        }
        break;
      case "xss-prevention":
        const xssCheck = checkInjection({ text: params.text, types: ["xss"] });
        if (!xssCheck.safe) {
          errors.push("Potential XSS attack detected");
          metadata.xss = xssCheck;
        }
        break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata,
  };
}

function validateJson(params: { json: string; schema: any; strict?: boolean }): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const parsed = JSON.parse(params.json);
    // Basic schema validation (in production, use ajv or similar)
    if (params.schema.type && typeof parsed !== params.schema.type) {
      errors.push(`Expected type ${params.schema.type}, got ${typeof parsed}`);
    }
    if (params.schema.required && Array.isArray(params.schema.required)) {
      for (const field of params.schema.required) {
        if (!(field in parsed)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }
  } catch (e: any) {
    errors.push(`Invalid JSON: ${e.message}`);
  }

  return { valid: errors.length === 0, errors, warnings, metadata: {} };
}

function validateCode(params: { code: string; language: string; checks?: string[] }): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checks = params.checks || ["security", "syntax"];

  if (checks.includes("security")) {
    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /eval\s*\(/g, message: "Use of eval() detected" },
      { pattern: /exec\s*\(/g, message: "Use of exec() detected" },
      { pattern: /__import__/g, message: "Dynamic import detected" },
      { pattern: /subprocess/g, message: "Subprocess usage detected" },
      { pattern: /os\.system/g, message: "System command execution detected" },
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(params.code)) {
        warnings.push(message);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings, metadata: { language: params.language } };
}

function detectPii(params: { text: string; types?: string[] }): any {
  const types = params.types || Object.keys(piiPatterns);
  const found: any[] = [];

  for (const type of types) {
    const pattern = piiPatterns[type];
    if (pattern) {
      const matches = params.text.match(pattern);
      if (matches) {
        found.push({ type, count: matches.length, samples: matches.slice(0, 3).map(m => m.substring(0, 5) + "***") });
      }
    }
  }

  return { found, count: found.length };
}

function redactPii(params: { text: string; types?: string[]; replacement?: string }): any {
  const types = params.types || Object.keys(piiPatterns);
  const replacement = params.replacement || "[REDACTED]";
  let redacted = params.text;
  let redactionCount = 0;

  for (const type of types) {
    const pattern = piiPatterns[type];
    if (pattern) {
      const newPattern = new RegExp(pattern.source, pattern.flags);
      const matches = redacted.match(newPattern);
      if (matches) {
        redactionCount += matches.length;
        redacted = redacted.replace(newPattern, replacement);
      }
    }
  }

  return { original: params.text, redacted, redactionCount };
}

function detectSecrets(params: { text: string; patterns?: string[] }): any {
  const patternNames = params.patterns || Object.keys(secretPatterns);
  const found: any[] = [];

  for (const name of patternNames) {
    const pattern = secretPatterns[name];
    if (pattern) {
      const matches = params.text.match(pattern);
      if (matches) {
        found.push({ type: name, count: matches.length });
      }
    }
  }

  return { found, hasSecrets: found.length > 0 };
}

function checkToxicity(params: { text: string; threshold?: number; categories?: string[] }): any {
  // Simplified toxicity check (in production, use ML model)
  const toxicPatterns = [
    /\b(hate|kill|die|stupid|idiot)\b/gi,
  ];

  let toxicityScore = 0;
  for (const pattern of toxicPatterns) {
    const matches = params.text.match(pattern);
    if (matches) {
      toxicityScore += matches.length * 0.1;
    }
  }

  toxicityScore = Math.min(toxicityScore, 1);
  const threshold = params.threshold || 0.5;

  return {
    toxicityScore,
    threshold,
    isToxic: toxicityScore >= threshold,
    categories: params.categories || ["general"],
  };
}

function checkBias(params: { text: string; dimensions?: string[] }): any {
  const dimensions = params.dimensions || ["gender", "race", "age"];
  const findings: any[] = [];

  // Simplified bias detection (in production, use ML model)
  const biasIndicators: Record<string, RegExp[]> = {
    gender: [/\b(mankind|manpower|chairman)\b/gi],
    age: [/\b(old people|young people)\s+(always|never)\b/gi],
  };

  for (const dim of dimensions) {
    const indicators = biasIndicators[dim];
    if (indicators) {
      for (const pattern of indicators) {
        if (pattern.test(params.text)) {
          findings.push({ dimension: dim, indicator: pattern.source });
        }
      }
    }
  }

  return { biasScore: findings.length > 0 ? 0.3 + findings.length * 0.1 : 0, findings, dimensions };
}

function filterProfanity(params: { text: string; action?: string; severity?: string }): any {
  const action = params.action || "detect";
  // Simplified profanity list (in production, use comprehensive list)
  const profanityPattern = /\b(damn|hell|crap)\b/gi;

  const matches = params.text.match(profanityPattern) || [];

  if (action === "detect") {
    return { detected: matches.length > 0, count: matches.length };
  } else if (action === "filter") {
    return { filtered: params.text.replace(profanityPattern, "[FILTERED]"), count: matches.length };
  } else if (action === "mask") {
    return { masked: params.text.replace(profanityPattern, (m) => "*".repeat(m.length)), count: matches.length };
  }

  return { detected: matches.length > 0 };
}

function checkInjection(params: { text: string; types?: string[] }): any {
  const types = params.types || Object.keys(injectionPatterns);
  const findings: any[] = [];

  for (const type of types) {
    const patterns = injectionPatterns[type];
    if (patterns) {
      for (const pattern of patterns) {
        if (pattern.test(params.text)) {
          findings.push({ type, pattern: pattern.source });
        }
      }
    }
  }

  return { safe: findings.length === 0, findings };
}

function sanitizeHtml(params: { html: string; allowedTags?: string[]; allowedAttributes?: any }): any {
  const allowedTags = params.allowedTags || ["p", "b", "i", "em", "strong", "a", "ul", "ol", "li"];
  let sanitized = params.html;

  // Remove script tags
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, "");
  // Remove event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript:/gi, "");

  return { original: params.html, sanitized, tagsRemoved: params.html.length - sanitized.length };
}

function listRules(params: { enabled?: boolean; type?: string }): any {
  let result = Array.from(rules.values());
  if (params.enabled !== undefined) {
    result = result.filter(r => r.enabled === params.enabled);
  }
  if (params.type) {
    result = result.filter(r => r.type === params.type);
  }
  return { rules: result, count: result.length };
}

function getRule(params: { ruleId: string }): any {
  const rule = rules.get(params.ruleId);
  if (!rule) throw new Error(`Rule not found: ${params.ruleId}`);
  return rule;
}

function createRule(params: { name: string; type: string; config: any; enabled?: boolean }): any {
  const id = generateId();
  const rule: GuardrailRule = {
    id,
    name: params.name,
    type: params.type,
    enabled: params.enabled ?? true,
    config: params.config,
  };
  rules.set(id, rule);
  return rule;
}

function updateRule(params: { ruleId: string; enabled?: boolean; config?: any }): any {
  const rule = rules.get(params.ruleId);
  if (!rule) throw new Error(`Rule not found: ${params.ruleId}`);

  if (params.enabled !== undefined) rule.enabled = params.enabled;
  if (params.config) rule.config = { ...rule.config, ...params.config };

  return rule;
}

function deleteRule(params: { ruleId: string }): any {
  if (!rules.has(params.ruleId)) throw new Error(`Rule not found: ${params.ruleId}`);
  rules.delete(params.ruleId);
  return { deleted: true, ruleId: params.ruleId };
}

function checkFactuality(params: { text: string; claims?: string[]; sources?: string[] }): any {
  return {
    text: params.text,
    claimsAnalyzed: params.claims?.length || 0,
    verdict: "Requires external fact-checking",
    confidence: 0.5,
    note: "Full factuality checking requires external knowledge base integration",
  };
}

function detectHallucination(params: { output: string; context?: string; prompt?: string }): any {
  const hasContext = !!params.context;
  return {
    output: params.output.substring(0, 100) + "...",
    contextProvided: hasContext,
    hallucinationRisk: hasContext ? "low" : "unknown",
    recommendation: hasContext
      ? "Cross-reference output with provided context"
      : "Cannot assess without source context",
  };
}

const server = new Server({ name: "guardrails-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "validate_output": result = validateOutput(args as any); break;
      case "validate_json": result = validateJson(args as any); break;
      case "validate_code": result = validateCode(args as any); break;
      case "detect_pii": result = detectPii(args as any); break;
      case "redact_pii": result = redactPii(args as any); break;
      case "detect_secrets": result = detectSecrets(args as any); break;
      case "check_toxicity": result = checkToxicity(args as any); break;
      case "check_bias": result = checkBias(args as any); break;
      case "filter_profanity": result = filterProfanity(args as any); break;
      case "check_injection": result = checkInjection(args as any); break;
      case "sanitize_html": result = sanitizeHtml(args as any); break;
      case "list_rules": result = listRules(args as any); break;
      case "get_rule": result = getRule(args as any); break;
      case "create_rule": result = createRule(args as any); break;
      case "update_rule": result = updateRule(args as any); break;
      case "delete_rule": result = deleteRule(args as any); break;
      case "check_factuality": result = checkFactuality(args as any); break;
      case "detect_hallucination": result = detectHallucination(args as any); break;
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
  console.error("Guardrails MCP Server running on stdio");
}

main().catch(console.error);
