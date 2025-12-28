/**
 * LangSmith MCP Server - LLM tracing, evaluation, and observability for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  apiKey: process.env.LANGSMITH_API_KEY || "",
  project: process.env.LANGSMITH_PROJECT || "default",
  baseUrl: process.env.LANGSMITH_BASE_URL || "https://api.smith.langchain.com",
};

// Helper function for LangSmith API requests
async function langsmithRequest(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  body?: any
): Promise<any> {
  const url = `${config.baseUrl}${endpoint}`;
  const headers: Record<string, string> = {
    "x-api-key": config.apiKey,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LangSmith API error ${response.status}: ${errorText}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

// Tool definitions
const TOOLS: Tool[] = [
  // Project Operations
  {
    name: "list_projects",
    description: "List all projects in the LangSmith workspace.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of projects to return" },
        offset: { type: "number", description: "Number of projects to skip" },
      },
    },
  },
  {
    name: "create_project",
    description: "Create a new project in LangSmith.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Project name" },
        description: { type: "string", description: "Project description" },
        metadata: { type: "object", description: "Additional metadata" },
      },
      required: ["name"],
    },
  },
  {
    name: "get_project",
    description: "Get details of a specific project.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID or name" },
      },
      required: ["project_id"],
    },
  },
  // Run/Trace Operations
  {
    name: "list_runs",
    description: "List runs/traces for a project with optional filtering.",
    inputSchema: {
      type: "object",
      properties: {
        project_name: { type: "string", description: "Project name to list runs from" },
        project_id: { type: "string", description: "Project ID to list runs from" },
        run_type: { type: "string", enum: ["llm", "chain", "tool", "retriever"], description: "Filter by run type" },
        is_root: { type: "boolean", description: "Filter for root runs only" },
        error: { type: "boolean", description: "Filter for runs with errors" },
        limit: { type: "number", description: "Maximum number of runs to return" },
        offset: { type: "number", description: "Number of runs to skip" },
        start_time: { type: "string", description: "Filter runs after this ISO datetime" },
        end_time: { type: "string", description: "Filter runs before this ISO datetime" },
      },
    },
  },
  {
    name: "get_run",
    description: "Get details of a specific run/trace.",
    inputSchema: {
      type: "object",
      properties: {
        run_id: { type: "string", description: "Run ID" },
      },
      required: ["run_id"],
    },
  },
  {
    name: "create_run",
    description: "Create a new run/trace manually.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Run name" },
        run_type: { type: "string", enum: ["llm", "chain", "tool", "retriever"], description: "Type of run" },
        inputs: { type: "object", description: "Input data for the run" },
        outputs: { type: "object", description: "Output data for the run" },
        parent_run_id: { type: "string", description: "Parent run ID for nested runs" },
        project_name: { type: "string", description: "Project name (defaults to LANGSMITH_PROJECT)" },
        start_time: { type: "string", description: "Run start time (ISO format)" },
        end_time: { type: "string", description: "Run end time (ISO format)" },
        extra: { type: "object", description: "Extra metadata" },
        error: { type: "string", description: "Error message if run failed" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for the run" },
      },
      required: ["name", "run_type"],
    },
  },
  {
    name: "update_run",
    description: "Update an existing run/trace.",
    inputSchema: {
      type: "object",
      properties: {
        run_id: { type: "string", description: "Run ID to update" },
        outputs: { type: "object", description: "Output data for the run" },
        end_time: { type: "string", description: "Run end time (ISO format)" },
        error: { type: "string", description: "Error message if run failed" },
        extra: { type: "object", description: "Extra metadata" },
        events: { type: "array", description: "Events to add to the run" },
      },
      required: ["run_id"],
    },
  },
  // Dataset Operations
  {
    name: "list_datasets",
    description: "List all datasets in the workspace.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of datasets to return" },
        offset: { type: "number", description: "Number of datasets to skip" },
        name: { type: "string", description: "Filter by dataset name" },
      },
    },
  },
  {
    name: "create_dataset",
    description: "Create a new dataset for evaluation.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Dataset name" },
        description: { type: "string", description: "Dataset description" },
        data_type: { type: "string", enum: ["kv", "llm", "chat"], description: "Dataset type" },
      },
      required: ["name"],
    },
  },
  {
    name: "get_dataset",
    description: "Get details of a specific dataset.",
    inputSchema: {
      type: "object",
      properties: {
        dataset_id: { type: "string", description: "Dataset ID or name" },
      },
      required: ["dataset_id"],
    },
  },
  // Example Operations
  {
    name: "list_examples",
    description: "List examples in a dataset.",
    inputSchema: {
      type: "object",
      properties: {
        dataset_id: { type: "string", description: "Dataset ID" },
        dataset_name: { type: "string", description: "Dataset name" },
        limit: { type: "number", description: "Maximum number of examples to return" },
        offset: { type: "number", description: "Number of examples to skip" },
      },
    },
  },
  {
    name: "create_example",
    description: "Add an example to a dataset.",
    inputSchema: {
      type: "object",
      properties: {
        dataset_id: { type: "string", description: "Dataset ID" },
        dataset_name: { type: "string", description: "Dataset name" },
        inputs: { type: "object", description: "Example inputs" },
        outputs: { type: "object", description: "Expected outputs" },
        metadata: { type: "object", description: "Example metadata" },
      },
      required: ["inputs"],
    },
  },
  // Evaluation Operations
  {
    name: "run_evaluation",
    description: "Run an evaluation on a dataset.",
    inputSchema: {
      type: "object",
      properties: {
        dataset_id: { type: "string", description: "Dataset ID to evaluate" },
        dataset_name: { type: "string", description: "Dataset name to evaluate" },
        project_name: { type: "string", description: "Project to store evaluation results" },
        evaluators: { type: "array", items: { type: "string" }, description: "List of evaluator names to use" },
        experiment_name: { type: "string", description: "Name for the evaluation experiment" },
        max_concurrency: { type: "number", description: "Maximum concurrent evaluations" },
      },
    },
  },
  {
    name: "list_evaluators",
    description: "List available evaluators for evaluation runs.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of evaluators to return" },
      },
    },
  },
  // Feedback Operations
  {
    name: "get_feedback",
    description: "Get feedback for a specific run.",
    inputSchema: {
      type: "object",
      properties: {
        run_id: { type: "string", description: "Run ID to get feedback for" },
        limit: { type: "number", description: "Maximum number of feedback items" },
      },
      required: ["run_id"],
    },
  },
  {
    name: "create_feedback",
    description: "Add feedback to a run.",
    inputSchema: {
      type: "object",
      properties: {
        run_id: { type: "string", description: "Run ID to add feedback to" },
        key: { type: "string", description: "Feedback key/name" },
        score: { type: "number", description: "Feedback score (0-1)" },
        value: { type: "string", description: "Feedback value/label" },
        comment: { type: "string", description: "Feedback comment" },
        correction: { type: "object", description: "Correction data" },
      },
      required: ["run_id", "key"],
    },
  },
  // Session Operations
  {
    name: "list_sessions",
    description: "List tracing sessions.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID to filter sessions" },
        project_name: { type: "string", description: "Project name to filter sessions" },
        limit: { type: "number", description: "Maximum number of sessions to return" },
        offset: { type: "number", description: "Number of sessions to skip" },
      },
    },
  },
  // Metrics Operations
  {
    name: "get_metrics",
    description: "Get metrics for a project.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID" },
        project_name: { type: "string", description: "Project name" },
        start_time: { type: "string", description: "Start time for metrics (ISO format)" },
        end_time: { type: "string", description: "End time for metrics (ISO format)" },
      },
    },
  },
  // Export Operations
  {
    name: "export_runs",
    description: "Export runs from a project.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project ID to export from" },
        project_name: { type: "string", description: "Project name to export from" },
        format: { type: "string", enum: ["json", "csv"], description: "Export format" },
        limit: { type: "number", description: "Maximum number of runs to export" },
        start_time: { type: "string", description: "Filter runs after this time" },
        end_time: { type: "string", description: "Filter runs before this time" },
      },
    },
  },
  // Share Operations
  {
    name: "share_run",
    description: "Share a run publicly.",
    inputSchema: {
      type: "object",
      properties: {
        run_id: { type: "string", description: "Run ID to share" },
        share_id: { type: "string", description: "Custom share ID (optional)" },
      },
      required: ["run_id"],
    },
  },
];

// Tool implementations

async function listProjects(params: { limit?: number; offset?: number }): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.set("limit", params.limit.toString());
  if (params.offset) queryParams.set("offset", params.offset.toString());
  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
  return langsmithRequest(`/api/v1/sessions${query}`);
}

async function createProject(params: { name: string; description?: string; metadata?: any }): Promise<any> {
  return langsmithRequest("/api/v1/sessions", "POST", {
    name: params.name,
    description: params.description,
    extra: params.metadata,
  });
}

async function getProject(params: { project_id: string }): Promise<any> {
  // Try by ID first, then by name
  try {
    return await langsmithRequest(`/api/v1/sessions/${params.project_id}`);
  } catch {
    // Search by name
    const projects = await langsmithRequest(`/api/v1/sessions?name=${encodeURIComponent(params.project_id)}`);
    if (projects && projects.length > 0) {
      return projects[0];
    }
    throw new Error(`Project not found: ${params.project_id}`);
  }
}

async function listRuns(params: {
  project_name?: string;
  project_id?: string;
  run_type?: string;
  is_root?: boolean;
  error?: boolean;
  limit?: number;
  offset?: number;
  start_time?: string;
  end_time?: string;
}): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.project_name) queryParams.set("session_name", params.project_name);
  if (params.project_id) queryParams.set("session_id", params.project_id);
  if (params.run_type) queryParams.set("run_type", params.run_type);
  if (params.is_root !== undefined) queryParams.set("is_root", params.is_root.toString());
  if (params.error !== undefined) queryParams.set("error", params.error.toString());
  if (params.limit) queryParams.set("limit", params.limit.toString());
  if (params.offset) queryParams.set("offset", params.offset.toString());
  if (params.start_time) queryParams.set("start_time", params.start_time);
  if (params.end_time) queryParams.set("end_time", params.end_time);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
  return langsmithRequest(`/api/v1/runs${query}`);
}

async function getRun(params: { run_id: string }): Promise<any> {
  return langsmithRequest(`/api/v1/runs/${params.run_id}`);
}

async function createRun(params: {
  name: string;
  run_type: string;
  inputs?: any;
  outputs?: any;
  parent_run_id?: string;
  project_name?: string;
  start_time?: string;
  end_time?: string;
  extra?: any;
  error?: string;
  tags?: string[];
}): Promise<any> {
  const runId = crypto.randomUUID();
  const now = new Date().toISOString();
  return langsmithRequest("/api/v1/runs", "POST", {
    id: runId,
    name: params.name,
    run_type: params.run_type,
    inputs: params.inputs || {},
    outputs: params.outputs,
    parent_run_id: params.parent_run_id,
    session_name: params.project_name || config.project,
    start_time: params.start_time || now,
    end_time: params.end_time,
    extra: params.extra,
    error: params.error,
    tags: params.tags,
  });
}

async function updateRun(params: {
  run_id: string;
  outputs?: any;
  end_time?: string;
  error?: string;
  extra?: any;
  events?: any[];
}): Promise<any> {
  return langsmithRequest(`/api/v1/runs/${params.run_id}`, "PATCH", {
    outputs: params.outputs,
    end_time: params.end_time || new Date().toISOString(),
    error: params.error,
    extra: params.extra,
    events: params.events,
  });
}

async function listDatasets(params: { limit?: number; offset?: number; name?: string }): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.set("limit", params.limit.toString());
  if (params.offset) queryParams.set("offset", params.offset.toString());
  if (params.name) queryParams.set("name", params.name);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
  return langsmithRequest(`/api/v1/datasets${query}`);
}

async function createDataset(params: { name: string; description?: string; data_type?: string }): Promise<any> {
  return langsmithRequest("/api/v1/datasets", "POST", {
    name: params.name,
    description: params.description,
    data_type: params.data_type || "kv",
  });
}

async function getDataset(params: { dataset_id: string }): Promise<any> {
  try {
    return await langsmithRequest(`/api/v1/datasets/${params.dataset_id}`);
  } catch {
    // Search by name
    const datasets = await langsmithRequest(`/api/v1/datasets?name=${encodeURIComponent(params.dataset_id)}`);
    if (datasets && datasets.length > 0) {
      return datasets[0];
    }
    throw new Error(`Dataset not found: ${params.dataset_id}`);
  }
}

async function listExamples(params: {
  dataset_id?: string;
  dataset_name?: string;
  limit?: number;
  offset?: number;
}): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.dataset_id) queryParams.set("dataset", params.dataset_id);
  if (params.dataset_name) queryParams.set("dataset_name", params.dataset_name);
  if (params.limit) queryParams.set("limit", params.limit.toString());
  if (params.offset) queryParams.set("offset", params.offset.toString());
  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
  return langsmithRequest(`/api/v1/examples${query}`);
}

async function createExample(params: {
  dataset_id?: string;
  dataset_name?: string;
  inputs: any;
  outputs?: any;
  metadata?: any;
}): Promise<any> {
  // Get dataset ID if name is provided
  let datasetId = params.dataset_id;
  if (!datasetId && params.dataset_name) {
    const dataset = await getDataset({ dataset_id: params.dataset_name });
    datasetId = dataset.id;
  }
  if (!datasetId) {
    throw new Error("Either dataset_id or dataset_name is required");
  }
  return langsmithRequest("/api/v1/examples", "POST", {
    dataset_id: datasetId,
    inputs: params.inputs,
    outputs: params.outputs,
    metadata: params.metadata,
  });
}

async function runEvaluation(params: {
  dataset_id?: string;
  dataset_name?: string;
  project_name?: string;
  evaluators?: string[];
  experiment_name?: string;
  max_concurrency?: number;
}): Promise<any> {
  // Get dataset ID if name is provided
  let datasetId = params.dataset_id;
  if (!datasetId && params.dataset_name) {
    const dataset = await getDataset({ dataset_id: params.dataset_name });
    datasetId = dataset.id;
  }
  if (!datasetId) {
    throw new Error("Either dataset_id or dataset_name is required");
  }

  // Create evaluation run
  return langsmithRequest("/api/v1/evaluations", "POST", {
    dataset_id: datasetId,
    session_name: params.project_name || config.project,
    evaluators: params.evaluators || [],
    experiment_name: params.experiment_name,
    max_concurrency: params.max_concurrency || 5,
  });
}

async function listEvaluators(params: { limit?: number }): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.set("limit", params.limit.toString());
  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
  return langsmithRequest(`/api/v1/evaluators${query}`);
}

async function getFeedback(params: { run_id: string; limit?: number }): Promise<any> {
  const queryParams = new URLSearchParams();
  queryParams.set("run", params.run_id);
  if (params.limit) queryParams.set("limit", params.limit.toString());
  return langsmithRequest(`/api/v1/feedback?${queryParams.toString()}`);
}

async function createFeedback(params: {
  run_id: string;
  key: string;
  score?: number;
  value?: string;
  comment?: string;
  correction?: any;
}): Promise<any> {
  return langsmithRequest("/api/v1/feedback", "POST", {
    run_id: params.run_id,
    key: params.key,
    score: params.score,
    value: params.value,
    comment: params.comment,
    correction: params.correction,
  });
}

async function listSessions(params: {
  project_id?: string;
  project_name?: string;
  limit?: number;
  offset?: number;
}): Promise<any> {
  // In LangSmith, sessions are the same as projects
  const queryParams = new URLSearchParams();
  if (params.project_name) queryParams.set("name", params.project_name);
  if (params.limit) queryParams.set("limit", params.limit.toString());
  if (params.offset) queryParams.set("offset", params.offset.toString());
  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
  return langsmithRequest(`/api/v1/sessions${query}`);
}

async function getMetrics(params: {
  project_id?: string;
  project_name?: string;
  start_time?: string;
  end_time?: string;
}): Promise<any> {
  // Get project ID if name is provided
  let sessionId = params.project_id;
  if (!sessionId && params.project_name) {
    const project = await getProject({ project_id: params.project_name });
    sessionId = project.id;
  }
  if (!sessionId) {
    throw new Error("Either project_id or project_name is required");
  }

  const queryParams = new URLSearchParams();
  if (params.start_time) queryParams.set("start_time", params.start_time);
  if (params.end_time) queryParams.set("end_time", params.end_time);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
  return langsmithRequest(`/api/v1/sessions/${sessionId}/stats${query}`);
}

async function exportRuns(params: {
  project_id?: string;
  project_name?: string;
  format?: string;
  limit?: number;
  start_time?: string;
  end_time?: string;
}): Promise<any> {
  const queryParams = new URLSearchParams();
  if (params.project_name) queryParams.set("session_name", params.project_name);
  if (params.project_id) queryParams.set("session_id", params.project_id);
  if (params.limit) queryParams.set("limit", params.limit.toString());
  if (params.start_time) queryParams.set("start_time", params.start_time);
  if (params.end_time) queryParams.set("end_time", params.end_time);

  const runs = await langsmithRequest(`/api/v1/runs?${queryParams.toString()}`);

  if (params.format === "csv") {
    // Convert to CSV format
    if (!runs || runs.length === 0) {
      return { format: "csv", data: "", count: 0 };
    }
    const headers = Object.keys(runs[0]).join(",");
    const rows = runs.map((run: any) =>
      Object.values(run)
        .map((v) => (typeof v === "object" ? JSON.stringify(v) : v))
        .join(",")
    );
    return { format: "csv", data: [headers, ...rows].join("\n"), count: runs.length };
  }

  return { format: "json", data: runs, count: runs?.length || 0 };
}

async function shareRun(params: { run_id: string; share_id?: string }): Promise<any> {
  return langsmithRequest(`/api/v1/runs/${params.run_id}/share`, "PUT", {
    share_id: params.share_id,
  });
}

// Server setup
const server = new Server(
  { name: "langsmith-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "list_projects":
        result = await listProjects(args as any);
        break;
      case "create_project":
        result = await createProject(args as any);
        break;
      case "get_project":
        result = await getProject(args as any);
        break;
      case "list_runs":
        result = await listRuns(args as any);
        break;
      case "get_run":
        result = await getRun(args as any);
        break;
      case "create_run":
        result = await createRun(args as any);
        break;
      case "update_run":
        result = await updateRun(args as any);
        break;
      case "list_datasets":
        result = await listDatasets(args as any);
        break;
      case "create_dataset":
        result = await createDataset(args as any);
        break;
      case "get_dataset":
        result = await getDataset(args as any);
        break;
      case "list_examples":
        result = await listExamples(args as any);
        break;
      case "create_example":
        result = await createExample(args as any);
        break;
      case "run_evaluation":
        result = await runEvaluation(args as any);
        break;
      case "list_evaluators":
        result = await listEvaluators(args as any);
        break;
      case "get_feedback":
        result = await getFeedback(args as any);
        break;
      case "create_feedback":
        result = await createFeedback(args as any);
        break;
      case "list_sessions":
        result = await listSessions(args as any);
        break;
      case "get_metrics":
        result = await getMetrics(args as any);
        break;
      case "export_runs":
        result = await exportRuns(args as any);
        break;
      case "share_run":
        result = await shareRun(args as any);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LangSmith MCP Server running on stdio");
}

main().catch(console.error);
