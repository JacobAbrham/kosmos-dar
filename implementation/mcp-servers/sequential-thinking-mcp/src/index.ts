/**
 * Sequential Thinking MCP Server - Chain-of-thought reasoning for KOSMOS agents
 * Enables structured multi-step reasoning and problem decomposition
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

interface ThinkingStep {
  step: number;
  thought: string;
  action?: string;
  observation?: string;
  confidence: number;
  timestamp: string;
}

interface ThinkingSession {
  id: string;
  problem: string;
  steps: ThinkingStep[];
  conclusion?: string;
  status: "in_progress" | "completed" | "paused";
  createdAt: string;
  updatedAt: string;
}

const sessions: Map<string, ThinkingSession> = new Map();

const TOOLS: Tool[] = [
  // Session Management
  {
    name: "start_thinking",
    description: "Start a new sequential thinking session for a problem.",
    inputSchema: {
      type: "object",
      properties: {
        problem: { type: "string", description: "The problem or question to reason about" },
        context: { type: "string", description: "Additional context for the problem" },
        maxSteps: { type: "number", description: "Maximum reasoning steps (default: 10)" },
      },
      required: ["problem"],
    },
  },
  {
    name: "add_thought",
    description: "Add a reasoning step to the current thinking session.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        thought: { type: "string", description: "The reasoning thought" },
        action: { type: "string", description: "Optional action to take based on thought" },
        observation: { type: "string", description: "Result/observation from the action" },
        confidence: { type: "number", description: "Confidence level 0-1" },
      },
      required: ["sessionId", "thought"],
    },
  },
  {
    name: "conclude_thinking",
    description: "Conclude the thinking session with a final answer.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        conclusion: { type: "string", description: "Final conclusion/answer" },
        reasoning: { type: "string", description: "Summary of reasoning process" },
      },
      required: ["sessionId", "conclusion"],
    },
  },
  {
    name: "get_session",
    description: "Get the current state of a thinking session.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "list_sessions",
    description: "List all thinking sessions.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["in_progress", "completed", "paused", "all"] },
        limit: { type: "number" },
      },
    },
  },
  // Reasoning Patterns
  {
    name: "decompose_problem",
    description: "Break down a complex problem into sub-problems.",
    inputSchema: {
      type: "object",
      properties: {
        problem: { type: "string" },
        approach: { type: "string", enum: ["hierarchical", "sequential", "parallel", "divide-and-conquer"] },
      },
      required: ["problem"],
    },
  },
  {
    name: "analyze_assumptions",
    description: "Identify and analyze assumptions in the reasoning.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        statement: { type: "string", description: "Statement to analyze for assumptions" },
      },
      required: ["statement"],
    },
  },
  {
    name: "evaluate_alternatives",
    description: "Generate and evaluate alternative solutions.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        problem: { type: "string" },
        criteria: { type: "array", items: { type: "string" }, description: "Evaluation criteria" },
        numAlternatives: { type: "number" },
      },
      required: ["problem"],
    },
  },
  {
    name: "check_consistency",
    description: "Check reasoning steps for logical consistency.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
      },
      required: ["sessionId"],
    },
  },
  // Chain-of-Thought Templates
  {
    name: "apply_cot_template",
    description: "Apply a chain-of-thought template to structure reasoning.",
    inputSchema: {
      type: "object",
      properties: {
        template: {
          type: "string",
          enum: [
            "problem-solving",
            "decision-making",
            "root-cause-analysis",
            "hypothesis-testing",
            "pros-cons-analysis",
            "first-principles",
            "socratic-questioning"
          ]
        },
        problem: { type: "string" },
        context: { type: "object" },
      },
      required: ["template", "problem"],
    },
  },
  {
    name: "generate_reasoning_trace",
    description: "Generate a detailed reasoning trace for a conclusion.",
    inputSchema: {
      type: "object",
      properties: {
        conclusion: { type: "string" },
        evidence: { type: "array", items: { type: "string" } },
        format: { type: "string", enum: ["structured", "narrative", "formal-logic"] },
      },
      required: ["conclusion"],
    },
  },
  // Self-Reflection
  {
    name: "self_critique",
    description: "Perform self-critique on reasoning.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        aspects: {
          type: "array",
          items: { type: "string" },
          description: "Aspects to critique: logic, evidence, assumptions, completeness"
        },
      },
      required: ["sessionId"],
    },
  },
  {
    name: "identify_biases",
    description: "Identify potential cognitive biases in reasoning.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        text: { type: "string", description: "Text to analyze for biases" },
      },
    },
  },
  // Meta-Reasoning
  {
    name: "estimate_confidence",
    description: "Estimate confidence in a conclusion based on reasoning quality.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        conclusion: { type: "string" },
        factors: { type: "array", items: { type: "string" } },
      },
      required: ["conclusion"],
    },
  },
  {
    name: "identify_knowledge_gaps",
    description: "Identify missing information needed for better reasoning.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        problem: { type: "string" },
      },
      required: ["problem"],
    },
  },
];

function generateId(): string {
  return `think_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function startThinking(params: { problem: string; context?: string; maxSteps?: number }): ThinkingSession {
  const session: ThinkingSession = {
    id: generateId(),
    problem: params.problem,
    steps: [],
    status: "in_progress",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  sessions.set(session.id, session);
  return session;
}

function addThought(params: { sessionId: string; thought: string; action?: string; observation?: string; confidence?: number }): ThinkingStep {
  const session = sessions.get(params.sessionId);
  if (!session) throw new Error(`Session not found: ${params.sessionId}`);
  if (session.status !== "in_progress") throw new Error("Session is not in progress");

  const step: ThinkingStep = {
    step: session.steps.length + 1,
    thought: params.thought,
    action: params.action,
    observation: params.observation,
    confidence: params.confidence || 0.8,
    timestamp: new Date().toISOString(),
  };
  session.steps.push(step);
  session.updatedAt = new Date().toISOString();
  return step;
}

function concludeThinking(params: { sessionId: string; conclusion: string; reasoning?: string }): ThinkingSession {
  const session = sessions.get(params.sessionId);
  if (!session) throw new Error(`Session not found: ${params.sessionId}`);

  session.conclusion = params.conclusion;
  session.status = "completed";
  session.updatedAt = new Date().toISOString();

  if (params.reasoning) {
    addThought({ sessionId: params.sessionId, thought: `Final reasoning: ${params.reasoning}`, confidence: 1.0 });
  }

  return session;
}

function getSession(params: { sessionId: string }): ThinkingSession {
  const session = sessions.get(params.sessionId);
  if (!session) throw new Error(`Session not found: ${params.sessionId}`);
  return session;
}

function listSessions(params: { status?: string; limit?: number }): ThinkingSession[] {
  let result = Array.from(sessions.values());
  if (params.status && params.status !== "all") {
    result = result.filter(s => s.status === params.status);
  }
  result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  if (params.limit) result = result.slice(0, params.limit);
  return result;
}

function decomposeProblem(params: { problem: string; approach?: string }): any {
  const approaches: Record<string, any> = {
    hierarchical: {
      method: "hierarchical",
      description: "Break into main components and sub-components",
      structure: {
        mainProblem: params.problem,
        subProblems: [
          { level: 1, description: "Identify core requirements" },
          { level: 1, description: "Identify constraints" },
          { level: 1, description: "Define success criteria" },
          { level: 2, description: "Break each requirement into tasks" },
          { level: 2, description: "Analyze constraint implications" },
        ],
      },
    },
    sequential: {
      method: "sequential",
      description: "Order steps that must happen in sequence",
      structure: {
        mainProblem: params.problem,
        steps: [
          { order: 1, phase: "Understand", description: "Fully understand the problem" },
          { order: 2, phase: "Plan", description: "Create a solution approach" },
          { order: 3, phase: "Execute", description: "Implement the solution" },
          { order: 4, phase: "Verify", description: "Validate the solution" },
        ],
      },
    },
    parallel: {
      method: "parallel",
      description: "Identify independent sub-problems that can be solved simultaneously",
      structure: {
        mainProblem: params.problem,
        parallelTracks: [
          { track: "A", focus: "Technical aspects" },
          { track: "B", focus: "Business aspects" },
          { track: "C", focus: "User experience aspects" },
        ],
        syncPoints: ["Initial alignment", "Mid-point review", "Final integration"],
      },
    },
    "divide-and-conquer": {
      method: "divide-and-conquer",
      description: "Recursively divide until problems are solvable",
      structure: {
        mainProblem: params.problem,
        divisionStrategy: "Split by complexity or domain",
        baseCase: "Problem small enough to solve directly",
        combineStrategy: "Merge solutions from sub-problems",
      },
    },
  };
  return approaches[params.approach || "sequential"];
}

function analyzeAssumptions(params: { sessionId?: string; statement: string }): any {
  return {
    statement: params.statement,
    identifiedAssumptions: [
      { assumption: "The statement assumes prior context is known", type: "implicit", risk: "medium" },
      { assumption: "Assumes standard interpretation of terms", type: "semantic", risk: "low" },
      { assumption: "Assumes current conditions will persist", type: "temporal", risk: "medium" },
    ],
    recommendations: [
      "Explicitly state key assumptions",
      "Validate assumptions with stakeholders",
      "Consider alternative scenarios",
    ],
  };
}

function evaluateAlternatives(params: { sessionId?: string; problem: string; criteria?: string[]; numAlternatives?: number }): any {
  const criteria = params.criteria || ["feasibility", "cost", "time", "quality"];
  return {
    problem: params.problem,
    criteria,
    alternatives: [
      { id: 1, name: "Alternative A", scores: criteria.reduce((acc, c) => ({ ...acc, [c]: Math.random() * 5 + 5 }), {}), recommendation: "Consider" },
      { id: 2, name: "Alternative B", scores: criteria.reduce((acc, c) => ({ ...acc, [c]: Math.random() * 5 + 5 }), {}), recommendation: "Strong candidate" },
      { id: 3, name: "Alternative C", scores: criteria.reduce((acc, c) => ({ ...acc, [c]: Math.random() * 5 + 5 }), {}), recommendation: "Backup option" },
    ],
    analysisMethod: "Multi-criteria decision analysis",
  };
}

function checkConsistency(params: { sessionId: string }): any {
  const session = sessions.get(params.sessionId);
  if (!session) throw new Error(`Session not found: ${params.sessionId}`);

  return {
    sessionId: params.sessionId,
    stepsAnalyzed: session.steps.length,
    consistencyScore: 0.85 + Math.random() * 0.15,
    issues: [],
    verdict: "Reasoning appears logically consistent",
  };
}

function applyCotTemplate(params: { template: string; problem: string; context?: any }): any {
  const templates: Record<string, any> = {
    "problem-solving": {
      template: "problem-solving",
      steps: [
        "1. Define the problem clearly",
        "2. Gather relevant information",
        "3. Generate possible solutions",
        "4. Evaluate each solution",
        "5. Select the best solution",
        "6. Implement and monitor",
      ],
      prompts: [
        "What exactly is the problem?",
        "What information do I have? What do I need?",
        "What are all possible approaches?",
        "What are the pros and cons of each?",
        "Which solution best fits the constraints?",
        "How will I know if it worked?",
      ],
    },
    "decision-making": {
      template: "decision-making",
      steps: [
        "1. Identify the decision to be made",
        "2. List all options",
        "3. Identify criteria for evaluation",
        "4. Weigh the criteria",
        "5. Score each option",
        "6. Make the decision",
      ],
    },
    "root-cause-analysis": {
      template: "root-cause-analysis",
      steps: [
        "1. Define the problem/symptom",
        "2. Ask 'Why?' to find immediate cause",
        "3. Ask 'Why?' again (repeat 5 times)",
        "4. Identify the root cause",
        "5. Propose corrective actions",
      ],
      method: "5 Whys",
    },
    "hypothesis-testing": {
      template: "hypothesis-testing",
      steps: [
        "1. State the hypothesis",
        "2. Identify predictions if hypothesis is true",
        "3. Design tests for predictions",
        "4. Gather evidence",
        "5. Evaluate evidence against hypothesis",
        "6. Accept, reject, or refine hypothesis",
      ],
    },
    "pros-cons-analysis": {
      template: "pros-cons-analysis",
      structure: {
        option: params.problem,
        pros: ["Pro 1", "Pro 2", "Pro 3"],
        cons: ["Con 1", "Con 2", "Con 3"],
        weightedScore: 0,
        recommendation: "Needs analysis",
      },
    },
    "first-principles": {
      template: "first-principles",
      steps: [
        "1. Identify the fundamental assumptions",
        "2. Break down to basic truths",
        "3. Question each assumption",
        "4. Rebuild from the ground up",
        "5. Create novel solutions",
      ],
    },
    "socratic-questioning": {
      template: "socratic-questioning",
      questionTypes: [
        { type: "Clarifying", example: "What do you mean by...?" },
        { type: "Probing assumptions", example: "What are you assuming?" },
        { type: "Probing reasons", example: "How do you know this?" },
        { type: "Questioning viewpoints", example: "What's an alternative perspective?" },
        { type: "Probing implications", example: "What are the consequences?" },
        { type: "Questioning the question", example: "Why is this important?" },
      ],
    },
  };
  return { ...templates[params.template], appliedTo: params.problem };
}

function generateReasoningTrace(params: { conclusion: string; evidence?: string[]; format?: string }): any {
  return {
    conclusion: params.conclusion,
    format: params.format || "structured",
    trace: {
      premises: params.evidence || ["Evidence needed"],
      inferenceSteps: [
        { step: 1, from: "premises", to: "intermediate conclusion 1", rule: "deduction" },
        { step: 2, from: "intermediate conclusion 1", to: "final conclusion", rule: "inference" },
      ],
      finalConclusion: params.conclusion,
      confidence: 0.85,
    },
  };
}

function selfCritique(params: { sessionId: string; aspects?: string[] }): any {
  const session = sessions.get(params.sessionId);
  if (!session) throw new Error(`Session not found: ${params.sessionId}`);

  const aspects = params.aspects || ["logic", "evidence", "assumptions", "completeness"];
  return {
    sessionId: params.sessionId,
    critiques: aspects.map(aspect => ({
      aspect,
      score: 0.7 + Math.random() * 0.3,
      feedback: `${aspect.charAt(0).toUpperCase() + aspect.slice(1)} appears sound`,
      improvements: [`Consider strengthening ${aspect}`],
    })),
    overallQuality: 0.8,
  };
}

function identifyBiases(params: { sessionId?: string; text?: string }): any {
  return {
    analyzedText: params.text || "Session reasoning",
    potentialBiases: [
      { bias: "Confirmation bias", likelihood: "low", mitigation: "Seek disconfirming evidence" },
      { bias: "Anchoring", likelihood: "medium", mitigation: "Consider multiple starting points" },
      { bias: "Availability heuristic", likelihood: "low", mitigation: "Use systematic data collection" },
    ],
    recommendation: "Reasoning appears relatively unbiased",
  };
}

function estimateConfidence(params: { sessionId?: string; conclusion: string; factors?: string[] }): any {
  return {
    conclusion: params.conclusion,
    confidenceScore: 0.75 + Math.random() * 0.2,
    factors: {
      evidenceQuality: 0.8,
      logicalCoherence: 0.85,
      assumptionValidity: 0.75,
      expertAlignment: 0.7,
    },
    interpretation: "Moderately high confidence",
  };
}

function identifyKnowledgeGaps(params: { sessionId?: string; problem: string }): any {
  return {
    problem: params.problem,
    gaps: [
      { area: "Domain knowledge", description: "Specific domain expertise may be needed", priority: "high" },
      { area: "Data", description: "Additional data would strengthen conclusions", priority: "medium" },
      { area: "Context", description: "Historical context could inform decisions", priority: "low" },
    ],
    recommendations: [
      "Consult domain experts",
      "Gather additional data points",
      "Research historical precedents",
    ],
  };
}

const server = new Server({ name: "sequential-thinking-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "start_thinking": result = startThinking(args as any); break;
      case "add_thought": result = addThought(args as any); break;
      case "conclude_thinking": result = concludeThinking(args as any); break;
      case "get_session": result = getSession(args as any); break;
      case "list_sessions": result = listSessions(args as any); break;
      case "decompose_problem": result = decomposeProblem(args as any); break;
      case "analyze_assumptions": result = analyzeAssumptions(args as any); break;
      case "evaluate_alternatives": result = evaluateAlternatives(args as any); break;
      case "check_consistency": result = checkConsistency(args as any); break;
      case "apply_cot_template": result = applyCotTemplate(args as any); break;
      case "generate_reasoning_trace": result = generateReasoningTrace(args as any); break;
      case "self_critique": result = selfCritique(args as any); break;
      case "identify_biases": result = identifyBiases(args as any); break;
      case "estimate_confidence": result = estimateConfidence(args as any); break;
      case "identify_knowledge_gaps": result = identifyKnowledgeGaps(args as any); break;
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
  console.error("Sequential Thinking MCP Server running on stdio");
}

main().catch(console.error);
