/**
 * Dagster MCP Server - Pipeline orchestration, assets, sensors, and schedules for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  url: process.env.DAGSTER_URL || "http://localhost:3000",
  apiToken: process.env.DAGSTER_API_TOKEN || "",
};

function getGraphQLUrl(): string {
  return `${config.url}/graphql`;
}

async function graphqlRequest(query: string, variables?: Record<string, any>): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiToken) {
    headers["Authorization"] = `Bearer ${config.apiToken}`;
  }

  const res = await fetch(getGraphQLUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`GraphQL request failed: ${res.status} ${error}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors.map((e: any) => e.message).join(", "));
  }
  return json.data;
}

// ============================================================================
// GRAPHQL QUERIES AND MUTATIONS
// ============================================================================

const QUERIES = {
  // Repositories
  listRepositories: `
    query ListRepositories {
      repositoriesOrError {
        ... on RepositoryConnection {
          nodes {
            name
            location {
              name
            }
          }
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  // Jobs/Pipelines
  listJobs: `
    query ListJobs($repositorySelector: RepositorySelector!) {
      repositoryOrError(repositorySelector: $repositorySelector) {
        ... on Repository {
          jobs {
            name
            description
            isJob
            pipelineSnapshotId
            tags {
              key
              value
            }
          }
        }
        ... on RepositoryNotFoundError {
          message
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  getJob: `
    query GetJob($selector: PipelineSelector!) {
      pipelineOrError(params: $selector) {
        ... on Pipeline {
          name
          description
          isJob
          pipelineSnapshotId
          tags {
            key
            value
          }
          solidHandles {
            handleID
            solid {
              name
              description
              inputs {
                definition {
                  name
                  type {
                    displayName
                  }
                }
              }
              outputs {
                definition {
                  name
                  type {
                    displayName
                  }
                }
              }
            }
          }
          modes {
            name
            description
            resources {
              name
              description
              configField {
                name
              }
            }
          }
          presets {
            name
            mode
            solidSelection
            runConfigYaml
            tags {
              key
              value
            }
          }
        }
        ... on PipelineNotFoundError {
          message
        }
        ... on InvalidSubsetError {
          message
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  // Runs
  listRuns: `
    query ListRuns($filter: RunsFilter, $limit: Int, $cursor: String) {
      runsOrError(filter: $filter, limit: $limit, cursor: $cursor) {
        ... on Runs {
          results {
            runId
            jobName
            status
            startTime
            endTime
            runConfigYaml
            tags {
              key
              value
            }
          }
          count
        }
        ... on InvalidPipelineRunsFilterError {
          message
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  getRun: `
    query GetRun($runId: ID!) {
      runOrError(runId: $runId) {
        ... on Run {
          runId
          jobName
          status
          startTime
          endTime
          runConfigYaml
          tags {
            key
            value
          }
          stepStats {
            stepKey
            status
            startTime
            endTime
            attempts {
              startTime
              endTime
            }
          }
          assets {
            key {
              path
            }
          }
        }
        ... on RunNotFoundError {
          message
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  getRunLogs: `
    query GetRunLogs($runId: ID!, $afterCursor: String, $limit: Int) {
      logsForRun(runId: $runId, afterCursor: $afterCursor, limit: $limit) {
        ... on EventConnection {
          events {
            __typename
            timestamp
            message
            level
            stepKey
            ... on ExecutionStepStartEvent {
              stepKey
            }
            ... on ExecutionStepSuccessEvent {
              stepKey
            }
            ... on ExecutionStepFailureEvent {
              stepKey
              error {
                message
                stack
              }
            }
            ... on RunFailureEvent {
              error {
                message
                stack
              }
            }
            ... on MaterializationEvent {
              assetKey {
                path
              }
            }
          }
          cursor
        }
        ... on RunNotFoundError {
          message
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  // Assets
  listAssets: `
    query ListAssets($prefix: [String!]) {
      assetsOrError(prefix: $prefix) {
        ... on AssetConnection {
          nodes {
            key {
              path
            }
          }
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  getAsset: `
    query GetAsset($assetKey: AssetKeyInput!) {
      assetOrError(assetKey: $assetKey) {
        ... on Asset {
          key {
            path
          }
          definition {
            description
            computeKind
            groupName
            opNames
            partitionDefinition {
              description
            }
            dependedBy {
              asset {
                key {
                  path
                }
              }
            }
            dependsOn {
              asset {
                key {
                  path
                }
              }
            }
          }
          assetMaterializations(limit: 10) {
            timestamp
            runId
            metadataEntries {
              label
              description
            }
          }
        }
        ... on AssetNotFoundError {
          message
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  getAssetMaterializations: `
    query GetAssetMaterializations($assetKey: AssetKeyInput!, $limit: Int, $beforeTimestamp: String) {
      assetOrError(assetKey: $assetKey) {
        ... on Asset {
          key {
            path
          }
          assetMaterializations(limit: $limit, beforeTimestampMillis: $beforeTimestamp) {
            timestamp
            runId
            partition
            metadataEntries {
              label
              description
            }
            tags {
              key
              value
            }
          }
        }
        ... on AssetNotFoundError {
          message
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  // Sensors
  listSensors: `
    query ListSensors($repositorySelector: RepositorySelector!) {
      sensorsOrError(repositorySelector: $repositorySelector) {
        ... on Sensors {
          results {
            name
            description
            sensorState {
              status
              runningCount
              hasStartPermission
              hasStopPermission
            }
            sensorType
            minIntervalSeconds
            nextTick {
              timestamp
            }
            targets {
              pipelineName
              mode
            }
          }
        }
        ... on RepositoryNotFoundError {
          message
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  // Schedules
  listSchedules: `
    query ListSchedules($repositorySelector: RepositorySelector!) {
      schedulesOrError(repositorySelector: $repositorySelector) {
        ... on Schedules {
          results {
            name
            description
            scheduleState {
              status
              runningCount
              hasStartPermission
              hasStopPermission
            }
            cronSchedule
            pipelineName
            mode
            executionTimezone
            futureTicks(limit: 5) {
              results {
                timestamp
              }
            }
          }
        }
        ... on RepositoryNotFoundError {
          message
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  // Partitions
  listPartitions: `
    query ListPartitions($selector: PipelineSelector!, $partitionSetName: String!) {
      partitionSetOrError(repositorySelector: {
        repositoryName: $selector.repositoryName,
        repositoryLocationName: $selector.repositoryLocationName
      }, partitionSetName: $partitionSetName) {
        ... on PartitionSet {
          name
          pipelineName
          mode
          partitionsOrError {
            ... on Partitions {
              results {
                name
                status
              }
            }
            ... on PythonError {
              message
              stack
            }
          }
        }
        ... on PartitionSetNotFoundError {
          message
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  // Workspace
  workspaceStatus: `
    query WorkspaceStatus {
      workspaceOrError {
        ... on Workspace {
          locationEntries {
            name
            loadStatus
            locationOrLoadError {
              ... on RepositoryLocation {
                name
                isReloadSupported
                repositories {
                  name
                }
              }
              ... on PythonError {
                message
                stack
              }
            }
          }
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,
};

const MUTATIONS = {
  launchRun: `
    mutation LaunchRun($executionParams: ExecutionParams!) {
      launchPipelineExecution(executionParams: $executionParams) {
        ... on LaunchRunSuccess {
          run {
            runId
            jobName
            status
            tags {
              key
              value
            }
          }
        }
        ... on InvalidStepError {
          invalidStepKey
        }
        ... on InvalidOutputError {
          stepKey
          invalidOutputName
        }
        ... on RunConfigValidationInvalid {
          errors {
            message
            reason
          }
        }
        ... on PipelineNotFoundError {
          message
        }
        ... on ConflictingExecutionParamsError {
          message
        }
        ... on PresetNotFoundError {
          message
        }
        ... on NoModeProvidedError {
          message
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  terminateRun: `
    mutation TerminateRun($runId: String!, $terminatePolicy: TerminateRunPolicy) {
      terminatePipelineExecution(runId: $runId, terminatePolicy: $terminatePolicy) {
        ... on TerminateRunSuccess {
          run {
            runId
            status
          }
        }
        ... on TerminateRunFailure {
          message
        }
        ... on RunNotFoundError {
          message
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  materializeAssets: `
    mutation MaterializeAssets($assetKeys: [AssetKeyInput!]!, $executionParams: ExecutionParams) {
      launchPipelineExecution(
        executionParams: {
          selector: $executionParams.selector,
          runConfigData: $executionParams.runConfigData,
          mode: $executionParams.mode,
          stepKeys: null,
          executionMetadata: $executionParams.executionMetadata
        },
        assetKeys: $assetKeys
      ) {
        ... on LaunchRunSuccess {
          run {
            runId
            jobName
            status
          }
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  startSensor: `
    mutation StartSensor($sensorSelector: SensorSelector!) {
      startSensor(sensorSelector: $sensorSelector) {
        ... on Sensor {
          name
          sensorState {
            status
          }
        }
        ... on SensorNotFoundError {
          message
        }
        ... on UnauthorizedError {
          message
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  stopSensor: `
    mutation StopSensor($jobOriginId: String!, $jobSelectorId: String!) {
      stopSensor(jobOriginId: $jobOriginId, jobSelectorId: $jobSelectorId) {
        ... on StopSensorMutationResult {
          instigationState {
            status
          }
        }
        ... on UnauthorizedError {
          message
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  startSchedule: `
    mutation StartSchedule($scheduleSelector: ScheduleSelector!) {
      startSchedule(scheduleSelector: $scheduleSelector) {
        ... on ScheduleStateResult {
          scheduleState {
            status
          }
        }
        ... on ScheduleNotFoundError {
          message
        }
        ... on UnauthorizedError {
          message
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  stopSchedule: `
    mutation StopSchedule($scheduleOriginId: String!, $scheduleSelectorId: String!) {
      stopRunningSchedule(scheduleOriginId: $scheduleOriginId, scheduleSelectorId: $scheduleSelectorId) {
        ... on ScheduleStateResult {
          scheduleState {
            status
          }
        }
        ... on UnauthorizedError {
          message
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,

  reloadWorkspace: `
    mutation ReloadWorkspace {
      reloadWorkspace {
        ... on Workspace {
          locationEntries {
            name
            loadStatus
          }
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `,
};

// ============================================================================
// TOOLS DEFINITION
// ============================================================================

const TOOLS: Tool[] = [
  // Repositories
  {
    name: "list_repositories",
    description: "List all Dagster repositories in the workspace.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // Jobs/Pipelines
  {
    name: "list_jobs",
    description: "List all jobs/pipelines in a repository.",
    inputSchema: {
      type: "object",
      properties: {
        repositoryName: { type: "string", description: "Repository name" },
        repositoryLocationName: { type: "string", description: "Repository location name" },
      },
      required: ["repositoryName", "repositoryLocationName"],
    },
  },
  {
    name: "get_job",
    description: "Get detailed information about a specific job/pipeline.",
    inputSchema: {
      type: "object",
      properties: {
        pipelineName: { type: "string", description: "Pipeline/job name" },
        repositoryName: { type: "string", description: "Repository name" },
        repositoryLocationName: { type: "string", description: "Repository location name" },
      },
      required: ["pipelineName", "repositoryName", "repositoryLocationName"],
    },
  },
  {
    name: "launch_run",
    description: "Launch a new pipeline/job run.",
    inputSchema: {
      type: "object",
      properties: {
        pipelineName: { type: "string", description: "Pipeline/job name" },
        repositoryName: { type: "string", description: "Repository name" },
        repositoryLocationName: { type: "string", description: "Repository location name" },
        mode: { type: "string", description: "Execution mode (default: 'default')" },
        runConfigData: { type: "object", description: "Run configuration data (YAML as object)" },
        tags: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              value: { type: "string" },
            },
          },
          description: "Tags for the run",
        },
        preset: { type: "string", description: "Preset name to use" },
        solidSelection: {
          type: "array",
          items: { type: "string" },
          description: "Specific solids/ops to execute",
        },
        stepKeys: {
          type: "array",
          items: { type: "string" },
          description: "Specific step keys to execute",
        },
      },
      required: ["pipelineName", "repositoryName", "repositoryLocationName"],
    },
  },

  // Runs
  {
    name: "list_runs",
    description: "List pipeline runs with optional filtering.",
    inputSchema: {
      type: "object",
      properties: {
        pipelineName: { type: "string", description: "Filter by pipeline name" },
        statuses: {
          type: "array",
          items: {
            type: "string",
            enum: ["QUEUED", "NOT_STARTED", "MANAGED", "STARTING", "STARTED", "SUCCESS", "FAILURE", "CANCELING", "CANCELED"],
          },
          description: "Filter by run statuses",
        },
        tags: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              value: { type: "string" },
            },
          },
          description: "Filter by tags",
        },
        limit: { type: "number", description: "Maximum number of runs to return" },
        cursor: { type: "string", description: "Pagination cursor" },
      },
    },
  },
  {
    name: "get_run",
    description: "Get detailed information about a specific run.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Run ID" },
      },
      required: ["runId"],
    },
  },
  {
    name: "terminate_run",
    description: "Terminate a running pipeline execution.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Run ID to terminate" },
        terminatePolicy: {
          type: "string",
          enum: ["SAFE_TERMINATE", "MARK_AS_CANCELED_IMMEDIATELY"],
          description: "Termination policy (default: SAFE_TERMINATE)",
        },
      },
      required: ["runId"],
    },
  },
  {
    name: "get_run_logs",
    description: "Get event logs for a specific run.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Run ID" },
        afterCursor: { type: "string", description: "Cursor for pagination" },
        limit: { type: "number", description: "Maximum number of events to return" },
      },
      required: ["runId"],
    },
  },

  // Assets
  {
    name: "list_assets",
    description: "List all software-defined assets.",
    inputSchema: {
      type: "object",
      properties: {
        prefix: {
          type: "array",
          items: { type: "string" },
          description: "Filter by asset key prefix",
        },
      },
    },
  },
  {
    name: "get_asset",
    description: "Get detailed information about a specific asset.",
    inputSchema: {
      type: "object",
      properties: {
        assetKey: {
          type: "array",
          items: { type: "string" },
          description: "Asset key path (e.g., ['my_asset'] or ['prefix', 'my_asset'])",
        },
      },
      required: ["assetKey"],
    },
  },
  {
    name: "materialize_assets",
    description: "Trigger materialization of one or more assets.",
    inputSchema: {
      type: "object",
      properties: {
        assetKeys: {
          type: "array",
          items: {
            type: "array",
            items: { type: "string" },
          },
          description: "Asset keys to materialize",
        },
        repositoryName: { type: "string", description: "Repository name" },
        repositoryLocationName: { type: "string", description: "Repository location name" },
        partitionKey: { type: "string", description: "Partition key to materialize" },
        runConfigData: { type: "object", description: "Run configuration data" },
        tags: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              value: { type: "string" },
            },
          },
          description: "Tags for the materialization run",
        },
      },
      required: ["assetKeys"],
    },
  },
  {
    name: "get_asset_materializations",
    description: "Get materialization history for an asset.",
    inputSchema: {
      type: "object",
      properties: {
        assetKey: {
          type: "array",
          items: { type: "string" },
          description: "Asset key path",
        },
        limit: { type: "number", description: "Maximum number of materializations to return" },
        beforeTimestamp: { type: "string", description: "Filter materializations before this timestamp" },
      },
      required: ["assetKey"],
    },
  },

  // Sensors
  {
    name: "list_sensors",
    description: "List all sensors in a repository.",
    inputSchema: {
      type: "object",
      properties: {
        repositoryName: { type: "string", description: "Repository name" },
        repositoryLocationName: { type: "string", description: "Repository location name" },
      },
      required: ["repositoryName", "repositoryLocationName"],
    },
  },
  {
    name: "start_sensor",
    description: "Start a sensor to begin automatic execution.",
    inputSchema: {
      type: "object",
      properties: {
        sensorName: { type: "string", description: "Sensor name" },
        repositoryName: { type: "string", description: "Repository name" },
        repositoryLocationName: { type: "string", description: "Repository location name" },
      },
      required: ["sensorName", "repositoryName", "repositoryLocationName"],
    },
  },
  {
    name: "stop_sensor",
    description: "Stop a running sensor.",
    inputSchema: {
      type: "object",
      properties: {
        jobOriginId: { type: "string", description: "Sensor origin ID" },
        jobSelectorId: { type: "string", description: "Sensor selector ID" },
      },
      required: ["jobOriginId", "jobSelectorId"],
    },
  },

  // Schedules
  {
    name: "list_schedules",
    description: "List all schedules in a repository.",
    inputSchema: {
      type: "object",
      properties: {
        repositoryName: { type: "string", description: "Repository name" },
        repositoryLocationName: { type: "string", description: "Repository location name" },
      },
      required: ["repositoryName", "repositoryLocationName"],
    },
  },
  {
    name: "start_schedule",
    description: "Start a schedule for automatic job execution.",
    inputSchema: {
      type: "object",
      properties: {
        scheduleName: { type: "string", description: "Schedule name" },
        repositoryName: { type: "string", description: "Repository name" },
        repositoryLocationName: { type: "string", description: "Repository location name" },
      },
      required: ["scheduleName", "repositoryName", "repositoryLocationName"],
    },
  },
  {
    name: "stop_schedule",
    description: "Stop a running schedule.",
    inputSchema: {
      type: "object",
      properties: {
        scheduleOriginId: { type: "string", description: "Schedule origin ID" },
        scheduleSelectorId: { type: "string", description: "Schedule selector ID" },
      },
      required: ["scheduleOriginId", "scheduleSelectorId"],
    },
  },

  // Partitions
  {
    name: "list_partitions",
    description: "List partitions for a pipeline's partition set.",
    inputSchema: {
      type: "object",
      properties: {
        pipelineName: { type: "string", description: "Pipeline name" },
        repositoryName: { type: "string", description: "Repository name" },
        repositoryLocationName: { type: "string", description: "Repository location name" },
        partitionSetName: { type: "string", description: "Partition set name" },
      },
      required: ["pipelineName", "repositoryName", "repositoryLocationName", "partitionSetName"],
    },
  },

  // Workspace
  {
    name: "reload_workspace",
    description: "Reload the Dagster workspace to pick up code changes.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

async function listRepositories(): Promise<any> {
  const data = await graphqlRequest(QUERIES.listRepositories);
  const repos = data.repositoriesOrError;
  if (repos.message) throw new Error(repos.message);
  return repos.nodes || repos;
}

async function listJobs(params: { repositoryName: string; repositoryLocationName: string }): Promise<any> {
  const data = await graphqlRequest(QUERIES.listJobs, {
    repositorySelector: {
      repositoryName: params.repositoryName,
      repositoryLocationName: params.repositoryLocationName,
    },
  });
  const repo = data.repositoryOrError;
  if (repo.message) throw new Error(repo.message);
  return repo.jobs;
}

async function getJob(params: { pipelineName: string; repositoryName: string; repositoryLocationName: string }): Promise<any> {
  const data = await graphqlRequest(QUERIES.getJob, {
    selector: {
      pipelineName: params.pipelineName,
      repositoryName: params.repositoryName,
      repositoryLocationName: params.repositoryLocationName,
    },
  });
  const pipeline = data.pipelineOrError;
  if (pipeline.message) throw new Error(pipeline.message);
  return pipeline;
}

async function launchRun(params: {
  pipelineName: string;
  repositoryName: string;
  repositoryLocationName: string;
  mode?: string;
  runConfigData?: any;
  tags?: Array<{ key: string; value: string }>;
  preset?: string;
  solidSelection?: string[];
  stepKeys?: string[];
}): Promise<any> {
  const executionParams: any = {
    selector: {
      pipelineName: params.pipelineName,
      repositoryName: params.repositoryName,
      repositoryLocationName: params.repositoryLocationName,
      solidSelection: params.solidSelection,
    },
    mode: params.mode || "default",
  };

  if (params.runConfigData) {
    executionParams.runConfigData = params.runConfigData;
  }
  if (params.tags) {
    executionParams.executionMetadata = { tags: params.tags };
  }
  if (params.preset) {
    executionParams.preset = params.preset;
  }
  if (params.stepKeys) {
    executionParams.stepKeys = params.stepKeys;
  }

  const data = await graphqlRequest(MUTATIONS.launchRun, { executionParams });
  const result = data.launchPipelineExecution;
  if (result.run) {
    return result.run;
  }
  if (result.message) throw new Error(result.message);
  if (result.errors) throw new Error(result.errors.map((e: any) => e.message).join(", "));
  throw new Error("Unknown error launching run");
}

async function listRuns(params: {
  pipelineName?: string;
  statuses?: string[];
  tags?: Array<{ key: string; value: string }>;
  limit?: number;
  cursor?: string;
}): Promise<any> {
  const filter: any = {};
  if (params.pipelineName) filter.pipelineName = params.pipelineName;
  if (params.statuses) filter.statuses = params.statuses;
  if (params.tags) filter.tags = params.tags;

  const data = await graphqlRequest(QUERIES.listRuns, {
    filter: Object.keys(filter).length > 0 ? filter : null,
    limit: params.limit || 25,
    cursor: params.cursor,
  });
  const runs = data.runsOrError;
  if (runs.message) throw new Error(runs.message);
  return runs;
}

async function getRun(params: { runId: string }): Promise<any> {
  const data = await graphqlRequest(QUERIES.getRun, { runId: params.runId });
  const run = data.runOrError;
  if (run.message) throw new Error(run.message);
  return run;
}

async function terminateRun(params: { runId: string; terminatePolicy?: string }): Promise<any> {
  const data = await graphqlRequest(MUTATIONS.terminateRun, {
    runId: params.runId,
    terminatePolicy: params.terminatePolicy || "SAFE_TERMINATE",
  });
  const result = data.terminatePipelineExecution;
  if (result.run) return result.run;
  if (result.message) throw new Error(result.message);
  throw new Error("Unknown error terminating run");
}

async function getRunLogs(params: { runId: string; afterCursor?: string; limit?: number }): Promise<any> {
  const data = await graphqlRequest(QUERIES.getRunLogs, {
    runId: params.runId,
    afterCursor: params.afterCursor,
    limit: params.limit || 100,
  });
  const logs = data.logsForRun;
  if (logs.message) throw new Error(logs.message);
  return logs;
}

async function listAssets(params: { prefix?: string[] }): Promise<any> {
  const data = await graphqlRequest(QUERIES.listAssets, { prefix: params.prefix });
  const assets = data.assetsOrError;
  if (assets.message) throw new Error(assets.message);
  return assets.nodes || assets;
}

async function getAsset(params: { assetKey: string[] }): Promise<any> {
  const data = await graphqlRequest(QUERIES.getAsset, {
    assetKey: { path: params.assetKey },
  });
  const asset = data.assetOrError;
  if (asset.message) throw new Error(asset.message);
  return asset;
}

async function materializeAssets(params: {
  assetKeys: string[][];
  repositoryName?: string;
  repositoryLocationName?: string;
  partitionKey?: string;
  runConfigData?: any;
  tags?: Array<{ key: string; value: string }>;
}): Promise<any> {
  // For asset materialization, we use launchPipelineExecution with asset selection
  const assetKeyInputs = params.assetKeys.map((path) => ({ path }));

  // Build execution params
  const executionParams: any = {};

  if (params.repositoryName && params.repositoryLocationName) {
    executionParams.selector = {
      repositoryName: params.repositoryName,
      repositoryLocationName: params.repositoryLocationName,
    };
  }

  if (params.runConfigData) {
    executionParams.runConfigData = params.runConfigData;
  }

  if (params.tags || params.partitionKey) {
    const tags = params.tags || [];
    if (params.partitionKey) {
      tags.push({ key: "dagster/partition", value: params.partitionKey });
    }
    executionParams.executionMetadata = { tags };
  }

  // Use a simplified materialization mutation
  const materializeMutation = `
    mutation MaterializeAssets($assetKeys: [AssetKeyInput!]!) {
      launchPipelineExecution(assetKeys: $assetKeys) {
        ... on LaunchRunSuccess {
          run {
            runId
            jobName
            status
          }
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `;

  const data = await graphqlRequest(materializeMutation, {
    assetKeys: assetKeyInputs,
  });

  const result = data.launchPipelineExecution;
  if (result.run) return result.run;
  if (result.message) throw new Error(result.message);
  throw new Error("Unknown error materializing assets");
}

async function getAssetMaterializations(params: { assetKey: string[]; limit?: number; beforeTimestamp?: string }): Promise<any> {
  const data = await graphqlRequest(QUERIES.getAssetMaterializations, {
    assetKey: { path: params.assetKey },
    limit: params.limit || 25,
    beforeTimestamp: params.beforeTimestamp,
  });
  const asset = data.assetOrError;
  if (asset.message) throw new Error(asset.message);
  return asset;
}

async function listSensors(params: { repositoryName: string; repositoryLocationName: string }): Promise<any> {
  const data = await graphqlRequest(QUERIES.listSensors, {
    repositorySelector: {
      repositoryName: params.repositoryName,
      repositoryLocationName: params.repositoryLocationName,
    },
  });
  const sensors = data.sensorsOrError;
  if (sensors.message) throw new Error(sensors.message);
  return sensors.results || sensors;
}

async function startSensor(params: { sensorName: string; repositoryName: string; repositoryLocationName: string }): Promise<any> {
  const data = await graphqlRequest(MUTATIONS.startSensor, {
    sensorSelector: {
      sensorName: params.sensorName,
      repositoryName: params.repositoryName,
      repositoryLocationName: params.repositoryLocationName,
    },
  });
  const result = data.startSensor;
  if (result.message) throw new Error(result.message);
  return result;
}

async function stopSensor(params: { jobOriginId: string; jobSelectorId: string }): Promise<any> {
  const data = await graphqlRequest(MUTATIONS.stopSensor, {
    jobOriginId: params.jobOriginId,
    jobSelectorId: params.jobSelectorId,
  });
  const result = data.stopSensor;
  if (result.message) throw new Error(result.message);
  return result;
}

async function listSchedules(params: { repositoryName: string; repositoryLocationName: string }): Promise<any> {
  const data = await graphqlRequest(QUERIES.listSchedules, {
    repositorySelector: {
      repositoryName: params.repositoryName,
      repositoryLocationName: params.repositoryLocationName,
    },
  });
  const schedules = data.schedulesOrError;
  if (schedules.message) throw new Error(schedules.message);
  return schedules.results || schedules;
}

async function startSchedule(params: { scheduleName: string; repositoryName: string; repositoryLocationName: string }): Promise<any> {
  const data = await graphqlRequest(MUTATIONS.startSchedule, {
    scheduleSelector: {
      scheduleName: params.scheduleName,
      repositoryName: params.repositoryName,
      repositoryLocationName: params.repositoryLocationName,
    },
  });
  const result = data.startSchedule;
  if (result.message) throw new Error(result.message);
  return result;
}

async function stopSchedule(params: { scheduleOriginId: string; scheduleSelectorId: string }): Promise<any> {
  const data = await graphqlRequest(MUTATIONS.stopSchedule, {
    scheduleOriginId: params.scheduleOriginId,
    scheduleSelectorId: params.scheduleSelectorId,
  });
  const result = data.stopRunningSchedule;
  if (result.message) throw new Error(result.message);
  return result;
}

async function listPartitions(params: {
  pipelineName: string;
  repositoryName: string;
  repositoryLocationName: string;
  partitionSetName: string;
}): Promise<any> {
  const partitionQuery = `
    query ListPartitions($repositorySelector: RepositorySelector!, $partitionSetName: String!) {
      partitionSetOrError(repositorySelector: $repositorySelector, partitionSetName: $partitionSetName) {
        ... on PartitionSet {
          name
          pipelineName
          mode
          partitionsOrError {
            ... on Partitions {
              results {
                name
              }
            }
            ... on PythonError {
              message
              stack
            }
          }
        }
        ... on PartitionSetNotFoundError {
          message
        }
        ... on PythonError {
          message
          stack
        }
      }
    }
  `;

  const data = await graphqlRequest(partitionQuery, {
    repositorySelector: {
      repositoryName: params.repositoryName,
      repositoryLocationName: params.repositoryLocationName,
    },
    partitionSetName: params.partitionSetName,
  });

  const partitionSet = data.partitionSetOrError;
  if (partitionSet.message) throw new Error(partitionSet.message);
  return partitionSet;
}

async function reloadWorkspace(): Promise<any> {
  const data = await graphqlRequest(MUTATIONS.reloadWorkspace);
  const result = data.reloadWorkspace;
  if (result.message) throw new Error(result.message);
  return result;
}

// ============================================================================
// SERVER SETUP
// ============================================================================

const server = new Server(
  { name: "dagster-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // Repositories
      case "list_repositories":
        result = await listRepositories();
        break;

      // Jobs
      case "list_jobs":
        result = await listJobs(args as any);
        break;
      case "get_job":
        result = await getJob(args as any);
        break;
      case "launch_run":
        result = await launchRun(args as any);
        break;

      // Runs
      case "list_runs":
        result = await listRuns(args as any);
        break;
      case "get_run":
        result = await getRun(args as any);
        break;
      case "terminate_run":
        result = await terminateRun(args as any);
        break;
      case "get_run_logs":
        result = await getRunLogs(args as any);
        break;

      // Assets
      case "list_assets":
        result = await listAssets(args as any);
        break;
      case "get_asset":
        result = await getAsset(args as any);
        break;
      case "materialize_assets":
        result = await materializeAssets(args as any);
        break;
      case "get_asset_materializations":
        result = await getAssetMaterializations(args as any);
        break;

      // Sensors
      case "list_sensors":
        result = await listSensors(args as any);
        break;
      case "start_sensor":
        result = await startSensor(args as any);
        break;
      case "stop_sensor":
        result = await stopSensor(args as any);
        break;

      // Schedules
      case "list_schedules":
        result = await listSchedules(args as any);
        break;
      case "start_schedule":
        result = await startSchedule(args as any);
        break;
      case "stop_schedule":
        result = await stopSchedule(args as any);
        break;

      // Partitions
      case "list_partitions":
        result = await listPartitions(args as any);
        break;

      // Workspace
      case "reload_workspace":
        result = await reloadWorkspace();
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
  console.error("Dagster MCP Server running on stdio");
}

main().catch(console.error);
