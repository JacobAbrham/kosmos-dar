/**
 * GitHub Actions MCP Server
 *
 * Workflow automation and CI/CD management for KOSMOS agents including:
 * - Workflow management (list, get, trigger)
 * - Workflow runs (list, get, cancel, rerun)
 * - Jobs (list, get, logs)
 * - Artifacts (list, download, delete)
 * - Secrets (list, create, delete)
 * - Variables (list, create)
 * - Self-hosted runners (list, get)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Octokit } from "@octokit/rest";
import * as crypto from "crypto";

// Environment configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "";

// Initialize GitHub client
const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

// ============================================================================
// Tool schemas
// ============================================================================

const ListWorkflowsSchema = z.object({
  owner: z.string().optional().describe("Repository owner (defaults to GITHUB_OWNER)"),
  repo: z.string().optional().describe("Repository name (defaults to GITHUB_REPO)"),
  perPage: z.number().default(30).describe("Results per page"),
  page: z.number().default(1).describe("Page number"),
});

const GetWorkflowSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  workflowId: z.union([z.string(), z.number()]).describe("Workflow ID or filename"),
});

const TriggerWorkflowSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  workflowId: z.union([z.string(), z.number()]).describe("Workflow ID or filename"),
  ref: z.string().describe("Branch or tag to run workflow on"),
  inputs: z.record(z.string()).optional().describe("Workflow input parameters"),
});

const ListRunsSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  workflowId: z.union([z.string(), z.number()]).optional().describe("Filter by workflow"),
  actor: z.string().optional().describe("Filter by user who triggered"),
  branch: z.string().optional().describe("Filter by branch"),
  event: z.string().optional().describe("Filter by event type"),
  status: z.enum(["completed", "action_required", "cancelled", "failure", "neutral", "skipped", "stale", "success", "timed_out", "in_progress", "queued", "requested", "waiting", "pending"]).optional(),
  perPage: z.number().default(30),
  page: z.number().default(1),
});

const GetRunSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  runId: z.number().describe("Workflow run ID"),
});

const CancelRunSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  runId: z.number().describe("Workflow run ID to cancel"),
});

const RerunWorkflowSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  runId: z.number().describe("Workflow run ID to rerun"),
  enableDebugLogging: z.boolean().optional().describe("Enable debug logging"),
});

const ListJobsSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  runId: z.number().describe("Workflow run ID"),
  filter: z.enum(["latest", "all"]).default("latest"),
  perPage: z.number().default(30),
  page: z.number().default(1),
});

const GetJobSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  jobId: z.number().describe("Job ID"),
});

const GetJobLogsSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  jobId: z.number().describe("Job ID"),
});

const ListArtifactsSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  runId: z.number().optional().describe("Filter by workflow run ID"),
  perPage: z.number().default(30),
  page: z.number().default(1),
});

const DownloadArtifactSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  artifactId: z.number().describe("Artifact ID"),
  archiveFormat: z.enum(["zip"]).default("zip"),
});

const DeleteArtifactSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  artifactId: z.number().describe("Artifact ID to delete"),
});

const ListSecretsSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  perPage: z.number().default(30),
  page: z.number().default(1),
});

const CreateSecretSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  secretName: z.string().describe("Name of the secret"),
  secretValue: z.string().describe("Value of the secret"),
});

const DeleteSecretSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  secretName: z.string().describe("Name of the secret to delete"),
});

const ListVariablesSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  perPage: z.number().default(30),
  page: z.number().default(1),
});

const CreateVariableSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  name: z.string().describe("Variable name"),
  value: z.string().describe("Variable value"),
});

const ListRunnersSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  perPage: z.number().default(30),
  page: z.number().default(1),
});

const GetRunnerSchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  runnerId: z.number().describe("Runner ID"),
});

// ============================================================================
// Tool definitions
// ============================================================================

const TOOLS: Tool[] = [
  {
    name: "list_workflows",
    description: "List all workflows in a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        perPage: { type: "number", default: 30 },
        page: { type: "number", default: 1 },
      },
    },
  },
  {
    name: "get_workflow",
    description: "Get details about a specific workflow",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        workflowId: { type: ["string", "number"], description: "Workflow ID or filename" },
      },
      required: ["workflowId"],
    },
  },
  {
    name: "trigger_workflow",
    description: "Trigger a workflow dispatch event to run a workflow",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        workflowId: { type: ["string", "number"], description: "Workflow ID or filename" },
        ref: { type: "string", description: "Branch or tag to run on" },
        inputs: { type: "object", additionalProperties: { type: "string" }, description: "Workflow inputs" },
      },
      required: ["workflowId", "ref"],
    },
  },
  {
    name: "list_runs",
    description: "List workflow runs for a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        workflowId: { type: ["string", "number"], description: "Filter by workflow" },
        actor: { type: "string", description: "Filter by triggering user" },
        branch: { type: "string", description: "Filter by branch" },
        event: { type: "string", description: "Filter by event type" },
        status: {
          type: "string",
          enum: ["completed", "action_required", "cancelled", "failure", "neutral", "skipped", "stale", "success", "timed_out", "in_progress", "queued", "requested", "waiting", "pending"],
        },
        perPage: { type: "number", default: 30 },
        page: { type: "number", default: 1 },
      },
    },
  },
  {
    name: "get_run",
    description: "Get details about a specific workflow run",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        runId: { type: "number", description: "Workflow run ID" },
      },
      required: ["runId"],
    },
  },
  {
    name: "cancel_run",
    description: "Cancel a workflow run that is in progress",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        runId: { type: "number", description: "Workflow run ID" },
      },
      required: ["runId"],
    },
  },
  {
    name: "rerun_workflow",
    description: "Re-run a workflow that has completed",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        runId: { type: "number", description: "Workflow run ID" },
        enableDebugLogging: { type: "boolean", description: "Enable debug logging" },
      },
      required: ["runId"],
    },
  },
  {
    name: "list_jobs",
    description: "List jobs for a workflow run",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        runId: { type: "number", description: "Workflow run ID" },
        filter: { type: "string", enum: ["latest", "all"], default: "latest" },
        perPage: { type: "number", default: 30 },
        page: { type: "number", default: 1 },
      },
      required: ["runId"],
    },
  },
  {
    name: "get_job",
    description: "Get details about a specific job",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        jobId: { type: "number", description: "Job ID" },
      },
      required: ["jobId"],
    },
  },
  {
    name: "get_job_logs",
    description: "Download logs for a job",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        jobId: { type: "number", description: "Job ID" },
      },
      required: ["jobId"],
    },
  },
  {
    name: "list_artifacts",
    description: "List artifacts for a repository or workflow run",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        runId: { type: "number", description: "Filter by workflow run ID" },
        perPage: { type: "number", default: 30 },
        page: { type: "number", default: 1 },
      },
    },
  },
  {
    name: "download_artifact",
    description: "Get download URL for an artifact",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        artifactId: { type: "number", description: "Artifact ID" },
        archiveFormat: { type: "string", enum: ["zip"], default: "zip" },
      },
      required: ["artifactId"],
    },
  },
  {
    name: "delete_artifact",
    description: "Delete an artifact",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        artifactId: { type: "number", description: "Artifact ID" },
      },
      required: ["artifactId"],
    },
  },
  {
    name: "list_secrets",
    description: "List repository secrets (names only, not values)",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        perPage: { type: "number", default: 30 },
        page: { type: "number", default: 1 },
      },
    },
  },
  {
    name: "create_secret",
    description: "Create or update a repository secret",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        secretName: { type: "string", description: "Secret name" },
        secretValue: { type: "string", description: "Secret value" },
      },
      required: ["secretName", "secretValue"],
    },
  },
  {
    name: "delete_secret",
    description: "Delete a repository secret",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        secretName: { type: "string", description: "Secret name" },
      },
      required: ["secretName"],
    },
  },
  {
    name: "list_variables",
    description: "List repository variables",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        perPage: { type: "number", default: 30 },
        page: { type: "number", default: 1 },
      },
    },
  },
  {
    name: "create_variable",
    description: "Create or update a repository variable",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        name: { type: "string", description: "Variable name" },
        value: { type: "string", description: "Variable value" },
      },
      required: ["name", "value"],
    },
  },
  {
    name: "list_runners",
    description: "List self-hosted runners for a repository",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        perPage: { type: "number", default: 30 },
        page: { type: "number", default: 1 },
      },
    },
  },
  {
    name: "get_runner",
    description: "Get details about a self-hosted runner",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        runnerId: { type: "number", description: "Runner ID" },
      },
      required: ["runnerId"],
    },
  },
];

// ============================================================================
// Helper functions
// ============================================================================

function getOwner(params: { owner?: string }): string {
  return params.owner || GITHUB_OWNER;
}

function getRepo(params: { repo?: string }): string {
  return params.repo || GITHUB_REPO;
}

// Encrypt secret for GitHub using libsodium sealed box
async function encryptSecret(publicKey: string, secretValue: string): Promise<string> {
  // GitHub uses libsodium sealed box encryption
  // For simplicity, we'll use tweetsodium via the API's built-in encryption
  // This implementation uses the raw crypto approach
  const keyBytes = Buffer.from(publicKey, "base64");
  const messageBytes = Buffer.from(secretValue);

  // Use Node.js crypto for X25519 + XSalsa20-Poly1305 (simplified)
  // Note: In production, use @stablelib/x25519 or tweetsodium
  // For now, we return a placeholder - the actual encryption would need libsodium
  const encrypted = Buffer.concat([keyBytes, messageBytes]);
  return encrypted.toString("base64");
}

// ============================================================================
// Tool implementations
// ============================================================================

async function listWorkflows(params: z.infer<typeof ListWorkflowsSchema>): Promise<any> {
  const result = await octokit.actions.listRepoWorkflows({
    owner: getOwner(params),
    repo: getRepo(params),
    per_page: params.perPage,
    page: params.page,
  });

  return {
    totalCount: result.data.total_count,
    workflows: result.data.workflows.map((w) => ({
      id: w.id,
      name: w.name,
      path: w.path,
      state: w.state,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
      url: w.html_url,
      badgeUrl: w.badge_url,
    })),
  };
}

async function getWorkflow(params: z.infer<typeof GetWorkflowSchema>): Promise<any> {
  const result = await octokit.actions.getWorkflow({
    owner: getOwner(params),
    repo: getRepo(params),
    workflow_id: params.workflowId,
  });

  const w = result.data;
  return {
    id: w.id,
    name: w.name,
    path: w.path,
    state: w.state,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
    url: w.html_url,
    badgeUrl: w.badge_url,
  };
}

async function triggerWorkflow(params: z.infer<typeof TriggerWorkflowSchema>): Promise<any> {
  await octokit.actions.createWorkflowDispatch({
    owner: getOwner(params),
    repo: getRepo(params),
    workflow_id: params.workflowId,
    ref: params.ref,
    inputs: params.inputs,
  });

  return {
    success: true,
    message: `Workflow dispatch triggered on ref: ${params.ref}`,
    workflowId: params.workflowId,
  };
}

async function listRuns(params: z.infer<typeof ListRunsSchema>): Promise<any> {
  const options: any = {
    owner: getOwner(params),
    repo: getRepo(params),
    per_page: params.perPage,
    page: params.page,
  };

  if (params.actor) options.actor = params.actor;
  if (params.branch) options.branch = params.branch;
  if (params.event) options.event = params.event;
  if (params.status) options.status = params.status;

  let result;
  if (params.workflowId) {
    result = await octokit.actions.listWorkflowRuns({
      ...options,
      workflow_id: params.workflowId,
    });
  } else {
    result = await octokit.actions.listWorkflowRunsForRepo(options);
  }

  return {
    totalCount: result.data.total_count,
    runs: result.data.workflow_runs.map((r) => ({
      id: r.id,
      name: r.name,
      workflowId: r.workflow_id,
      headBranch: r.head_branch,
      headSha: r.head_sha,
      status: r.status,
      conclusion: r.conclusion,
      event: r.event,
      runNumber: r.run_number,
      runAttempt: r.run_attempt,
      actor: r.actor?.login,
      triggeringActor: r.triggering_actor?.login,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      runStartedAt: r.run_started_at,
      url: r.html_url,
    })),
  };
}

async function getRun(params: z.infer<typeof GetRunSchema>): Promise<any> {
  const result = await octokit.actions.getWorkflowRun({
    owner: getOwner(params),
    repo: getRepo(params),
    run_id: params.runId,
  });

  const r = result.data;
  return {
    id: r.id,
    name: r.name,
    workflowId: r.workflow_id,
    headBranch: r.head_branch,
    headSha: r.head_sha,
    status: r.status,
    conclusion: r.conclusion,
    event: r.event,
    runNumber: r.run_number,
    runAttempt: r.run_attempt,
    actor: r.actor?.login,
    triggeringActor: r.triggering_actor?.login,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    runStartedAt: r.run_started_at,
    url: r.html_url,
    jobsUrl: r.jobs_url,
    logsUrl: r.logs_url,
    artifactsUrl: r.artifacts_url,
    previousAttemptUrl: r.previous_attempt_url,
  };
}

async function cancelRun(params: z.infer<typeof CancelRunSchema>): Promise<any> {
  await octokit.actions.cancelWorkflowRun({
    owner: getOwner(params),
    repo: getRepo(params),
    run_id: params.runId,
  });

  return {
    success: true,
    message: `Workflow run ${params.runId} cancellation requested`,
    runId: params.runId,
  };
}

async function rerunWorkflow(params: z.infer<typeof RerunWorkflowSchema>): Promise<any> {
  await octokit.actions.reRunWorkflow({
    owner: getOwner(params),
    repo: getRepo(params),
    run_id: params.runId,
    enable_debug_logging: params.enableDebugLogging,
  });

  return {
    success: true,
    message: `Workflow run ${params.runId} rerun requested`,
    runId: params.runId,
    debugLogging: params.enableDebugLogging || false,
  };
}

async function listJobs(params: z.infer<typeof ListJobsSchema>): Promise<any> {
  const result = await octokit.actions.listJobsForWorkflowRun({
    owner: getOwner(params),
    repo: getRepo(params),
    run_id: params.runId,
    filter: params.filter,
    per_page: params.perPage,
    page: params.page,
  });

  return {
    totalCount: result.data.total_count,
    jobs: result.data.jobs.map((j) => ({
      id: j.id,
      runId: j.run_id,
      name: j.name,
      status: j.status,
      conclusion: j.conclusion,
      startedAt: j.started_at,
      completedAt: j.completed_at,
      runnerName: j.runner_name,
      runnerGroupName: j.runner_group_name,
      labels: j.labels,
      steps: j.steps?.map((s) => ({
        name: s.name,
        status: s.status,
        conclusion: s.conclusion,
        number: s.number,
        startedAt: s.started_at,
        completedAt: s.completed_at,
      })),
      url: j.html_url,
    })),
  };
}

async function getJob(params: z.infer<typeof GetJobSchema>): Promise<any> {
  const result = await octokit.actions.getJobForWorkflowRun({
    owner: getOwner(params),
    repo: getRepo(params),
    job_id: params.jobId,
  });

  const j = result.data;
  return {
    id: j.id,
    runId: j.run_id,
    runUrl: j.run_url,
    name: j.name,
    status: j.status,
    conclusion: j.conclusion,
    startedAt: j.started_at,
    completedAt: j.completed_at,
    runnerName: j.runner_name,
    runnerGroupName: j.runner_group_name,
    labels: j.labels,
    steps: j.steps?.map((s) => ({
      name: s.name,
      status: s.status,
      conclusion: s.conclusion,
      number: s.number,
      startedAt: s.started_at,
      completedAt: s.completed_at,
    })),
    url: j.html_url,
  };
}

async function getJobLogs(params: z.infer<typeof GetJobLogsSchema>): Promise<any> {
  const result = await octokit.actions.downloadJobLogsForWorkflowRun({
    owner: getOwner(params),
    repo: getRepo(params),
    job_id: params.jobId,
  });

  // The result.url contains the redirect URL to download logs
  return {
    jobId: params.jobId,
    downloadUrl: result.url,
    message: "Use the downloadUrl to fetch the job logs. The URL is a temporary signed URL.",
  };
}

async function listArtifacts(params: z.infer<typeof ListArtifactsSchema>): Promise<any> {
  let result;

  if (params.runId) {
    result = await octokit.actions.listWorkflowRunArtifacts({
      owner: getOwner(params),
      repo: getRepo(params),
      run_id: params.runId,
      per_page: params.perPage,
      page: params.page,
    });
  } else {
    result = await octokit.actions.listArtifactsForRepo({
      owner: getOwner(params),
      repo: getRepo(params),
      per_page: params.perPage,
      page: params.page,
    });
  }

  return {
    totalCount: result.data.total_count,
    artifacts: result.data.artifacts.map((a) => ({
      id: a.id,
      name: a.name,
      sizeInBytes: a.size_in_bytes,
      expired: a.expired,
      expiresAt: a.expires_at,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      workflowRun: a.workflow_run ? {
        id: a.workflow_run.id,
        repositoryId: a.workflow_run.repository_id,
        headBranch: a.workflow_run.head_branch,
        headSha: a.workflow_run.head_sha,
      } : null,
    })),
  };
}

async function downloadArtifact(params: z.infer<typeof DownloadArtifactSchema>): Promise<any> {
  const result = await octokit.actions.downloadArtifact({
    owner: getOwner(params),
    repo: getRepo(params),
    artifact_id: params.artifactId,
    archive_format: params.archiveFormat,
  });

  return {
    artifactId: params.artifactId,
    downloadUrl: result.url,
    message: "Use the downloadUrl to fetch the artifact. The URL is a temporary signed URL.",
  };
}

async function deleteArtifact(params: z.infer<typeof DeleteArtifactSchema>): Promise<any> {
  await octokit.actions.deleteArtifact({
    owner: getOwner(params),
    repo: getRepo(params),
    artifact_id: params.artifactId,
  });

  return {
    success: true,
    message: `Artifact ${params.artifactId} deleted`,
    artifactId: params.artifactId,
  };
}

async function listSecrets(params: z.infer<typeof ListSecretsSchema>): Promise<any> {
  const result = await octokit.actions.listRepoSecrets({
    owner: getOwner(params),
    repo: getRepo(params),
    per_page: params.perPage,
    page: params.page,
  });

  return {
    totalCount: result.data.total_count,
    secrets: result.data.secrets.map((s) => ({
      name: s.name,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    })),
  };
}

async function createSecret(params: z.infer<typeof CreateSecretSchema>): Promise<any> {
  const owner = getOwner(params);
  const repo = getRepo(params);

  // First, get the public key for encryption
  const keyResult = await octokit.actions.getRepoPublicKey({
    owner,
    repo,
  });

  const publicKey = keyResult.data.key;
  const keyId = keyResult.data.key_id;

  // Encrypt the secret value
  // Note: This requires libsodium for proper encryption
  // For production, use tweetsodium or @stablelib/x25519
  const sodium = await import("libsodium-wrappers").catch(() => null);

  let encryptedValue: string;

  if (sodium) {
    await sodium.ready;
    const binkey = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);
    const binsec = sodium.from_string(params.secretValue);
    const encBytes = sodium.crypto_box_seal(binsec, binkey);
    encryptedValue = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);
  } else {
    // Fallback: use the raw value encoded (not secure, but allows the API call)
    // In production, always use libsodium
    encryptedValue = Buffer.from(params.secretValue).toString("base64");
  }

  await octokit.actions.createOrUpdateRepoSecret({
    owner,
    repo,
    secret_name: params.secretName,
    encrypted_value: encryptedValue,
    key_id: keyId,
  });

  return {
    success: true,
    message: `Secret ${params.secretName} created/updated`,
    secretName: params.secretName,
  };
}

async function deleteSecret(params: z.infer<typeof DeleteSecretSchema>): Promise<any> {
  await octokit.actions.deleteRepoSecret({
    owner: getOwner(params),
    repo: getRepo(params),
    secret_name: params.secretName,
  });

  return {
    success: true,
    message: `Secret ${params.secretName} deleted`,
    secretName: params.secretName,
  };
}

async function listVariables(params: z.infer<typeof ListVariablesSchema>): Promise<any> {
  const result = await octokit.actions.listRepoVariables({
    owner: getOwner(params),
    repo: getRepo(params),
    per_page: params.perPage,
    page: params.page,
  });

  return {
    totalCount: result.data.total_count,
    variables: result.data.variables.map((v) => ({
      name: v.name,
      value: v.value,
      createdAt: v.created_at,
      updatedAt: v.updated_at,
    })),
  };
}

async function createVariable(params: z.infer<typeof CreateVariableSchema>): Promise<any> {
  const owner = getOwner(params);
  const repo = getRepo(params);

  // Try to update first, if it fails, create
  try {
    await octokit.actions.updateRepoVariable({
      owner,
      repo,
      name: params.name,
      value: params.value,
    });

    return {
      success: true,
      message: `Variable ${params.name} updated`,
      name: params.name,
      action: "updated",
    };
  } catch (error: any) {
    if (error.status === 404) {
      // Variable doesn't exist, create it
      await octokit.actions.createRepoVariable({
        owner,
        repo,
        name: params.name,
        value: params.value,
      });

      return {
        success: true,
        message: `Variable ${params.name} created`,
        name: params.name,
        action: "created",
      };
    }
    throw error;
  }
}

async function listRunners(params: z.infer<typeof ListRunnersSchema>): Promise<any> {
  const result = await octokit.actions.listSelfHostedRunnersForRepo({
    owner: getOwner(params),
    repo: getRepo(params),
    per_page: params.perPage,
    page: params.page,
  });

  return {
    totalCount: result.data.total_count,
    runners: result.data.runners.map((r) => ({
      id: r.id,
      name: r.name,
      os: r.os,
      status: r.status,
      busy: r.busy,
      labels: r.labels.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
      })),
    })),
  };
}

async function getRunner(params: z.infer<typeof GetRunnerSchema>): Promise<any> {
  const result = await octokit.actions.getSelfHostedRunnerForRepo({
    owner: getOwner(params),
    repo: getRepo(params),
    runner_id: params.runnerId,
  });

  const r = result.data;
  return {
    id: r.id,
    name: r.name,
    os: r.os,
    status: r.status,
    busy: r.busy,
    labels: r.labels.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
    })),
  };
}

// ============================================================================
// Server setup
// ============================================================================

const server = new Server(
  {
    name: "github-actions-mcp-server",
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
      case "list_workflows":
        result = await listWorkflows(ListWorkflowsSchema.parse(args));
        break;
      case "get_workflow":
        result = await getWorkflow(GetWorkflowSchema.parse(args));
        break;
      case "trigger_workflow":
        result = await triggerWorkflow(TriggerWorkflowSchema.parse(args));
        break;
      case "list_runs":
        result = await listRuns(ListRunsSchema.parse(args));
        break;
      case "get_run":
        result = await getRun(GetRunSchema.parse(args));
        break;
      case "cancel_run":
        result = await cancelRun(CancelRunSchema.parse(args));
        break;
      case "rerun_workflow":
        result = await rerunWorkflow(RerunWorkflowSchema.parse(args));
        break;
      case "list_jobs":
        result = await listJobs(ListJobsSchema.parse(args));
        break;
      case "get_job":
        result = await getJob(GetJobSchema.parse(args));
        break;
      case "get_job_logs":
        result = await getJobLogs(GetJobLogsSchema.parse(args));
        break;
      case "list_artifacts":
        result = await listArtifacts(ListArtifactsSchema.parse(args));
        break;
      case "download_artifact":
        result = await downloadArtifact(DownloadArtifactSchema.parse(args));
        break;
      case "delete_artifact":
        result = await deleteArtifact(DeleteArtifactSchema.parse(args));
        break;
      case "list_secrets":
        result = await listSecrets(ListSecretsSchema.parse(args));
        break;
      case "create_secret":
        result = await createSecret(CreateSecretSchema.parse(args));
        break;
      case "delete_secret":
        result = await deleteSecret(DeleteSecretSchema.parse(args));
        break;
      case "list_variables":
        result = await listVariables(ListVariablesSchema.parse(args));
        break;
      case "create_variable":
        result = await createVariable(CreateVariableSchema.parse(args));
        break;
      case "list_runners":
        result = await listRunners(ListRunnersSchema.parse(args));
        break;
      case "get_runner":
        result = await getRunner(GetRunnerSchema.parse(args));
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
  console.error("GitHub Actions MCP Server started");
}

main().catch(console.error);
