/**
 * HashiCorp Vault MCP Server - Secrets management for KOSMOS agents
 *
 * Provides comprehensive Vault API integration including:
 * - KV secrets management (read, write, delete, list, metadata)
 * - Secrets engines management
 * - Dynamic credentials (database, AWS)
 * - Policy management
 * - Token management
 * - Authentication methods
 * - System health and seal status
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

// Configuration from environment variables
const config = {
  endpoint: process.env.VAULT_ADDR || "http://localhost:8200",
  token: process.env.VAULT_TOKEN || "",
  namespace: process.env.VAULT_NAMESPACE || "",
};

/**
 * Make authenticated request to Vault API
 */
async function vaultRequest(method: string, path: string, body?: any): Promise<any> {
  const headers: Record<string, string> = {
    "X-Vault-Token": config.token,
    "Content-Type": "application/json",
  };

  if (config.namespace) {
    headers["X-Vault-Namespace"] = config.namespace;
  }

  const url = `${config.endpoint}/v1/${path}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ errors: [res.statusText] }));
    throw new Error(error.errors?.join(", ") || res.statusText);
  }

  return res.status === 204 ? {} : res.json();
}

// Tool definitions
const TOOLS: Tool[] = [
  // KV Secrets Management
  {
    name: "read_secret",
    description: "Read a secret from the KV secrets store. Supports KV v2 with optional version selection.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the secret (e.g., 'myapp/config')" },
        mount: { type: "string", description: "KV mount path (default: 'secret')" },
        version: { type: "number", description: "Specific version to read (optional, defaults to latest)" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_secret",
    description: "Write a secret to the KV secrets store. Creates a new version of the secret.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to store the secret (e.g., 'myapp/config')" },
        data: { type: "object", description: "Secret data as key-value pairs" },
        mount: { type: "string", description: "KV mount path (default: 'secret')" },
        cas: { type: "number", description: "Check-and-set value for optimistic locking (optional)" },
      },
      required: ["path", "data"],
    },
  },
  {
    name: "delete_secret",
    description: "Delete a secret from the KV secrets store. For KV v2, this soft-deletes the latest version.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the secret to delete" },
        mount: { type: "string", description: "KV mount path (default: 'secret')" },
        versions: { type: "array", items: { type: "number" }, description: "Specific versions to delete (optional)" },
        destroy: { type: "boolean", description: "Permanently destroy instead of soft-delete (default: false)" },
      },
      required: ["path"],
    },
  },
  {
    name: "list_secrets",
    description: "List secrets at a given path in the KV secrets store.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to list (e.g., 'myapp/' or empty for root)" },
        mount: { type: "string", description: "KV mount path (default: 'secret')" },
      },
    },
  },
  {
    name: "get_secret_metadata",
    description: "Get metadata for a secret including version history, creation time, and custom metadata.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the secret" },
        mount: { type: "string", description: "KV mount path (default: 'secret')" },
      },
      required: ["path"],
    },
  },

  // Secrets Engines Management
  {
    name: "enable_secrets_engine",
    description: "Enable a new secrets engine at a specified path.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Mount path for the engine (e.g., 'aws', 'database')" },
        type: { type: "string", description: "Engine type (e.g., 'kv', 'aws', 'database', 'pki', 'transit')" },
        description: { type: "string", description: "Human-readable description of the engine" },
        options: {
          type: "object",
          description: "Engine-specific options (e.g., { version: '2' } for KV v2)",
        },
        config: {
          type: "object",
          description: "Engine configuration (default_lease_ttl, max_lease_ttl, etc.)",
        },
      },
      required: ["path", "type"],
    },
  },
  {
    name: "list_secrets_engines",
    description: "List all enabled secrets engines with their types and configurations.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // Dynamic Credentials
  {
    name: "generate_database_creds",
    description: "Generate dynamic database credentials for a configured role.",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string", description: "Database role name configured in Vault" },
        mount: { type: "string", description: "Database secrets engine mount path (default: 'database')" },
      },
      required: ["role"],
    },
  },
  {
    name: "generate_aws_creds",
    description: "Generate dynamic AWS credentials for a configured role.",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string", description: "AWS role name configured in Vault" },
        mount: { type: "string", description: "AWS secrets engine mount path (default: 'aws')" },
        ttl: { type: "string", description: "Requested TTL for credentials (e.g., '1h', '30m')" },
        role_arn: { type: "string", description: "ARN of the role to assume (for assumed_role credential type)" },
      },
      required: ["role"],
    },
  },

  // Policy Management
  {
    name: "list_policies",
    description: "List all ACL policies configured in Vault.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_policy",
    description: "Get the details of a specific policy including its rules.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the policy to retrieve" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_policy",
    description: "Create or update an ACL policy with HCL or JSON rules.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name for the policy" },
        policy: { type: "string", description: "Policy rules in HCL or JSON format" },
      },
      required: ["name", "policy"],
    },
  },
  {
    name: "delete_policy",
    description: "Delete an ACL policy from Vault.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the policy to delete" },
      },
      required: ["name"],
    },
  },

  // Token Management
  {
    name: "create_token",
    description: "Create a new authentication token with specified policies and parameters.",
    inputSchema: {
      type: "object",
      properties: {
        policies: { type: "array", items: { type: "string" }, description: "List of policies to attach" },
        ttl: { type: "string", description: "Token TTL (e.g., '1h', '24h')" },
        explicit_max_ttl: { type: "string", description: "Maximum lifetime of the token" },
        renewable: { type: "boolean", description: "Whether the token can be renewed (default: true)" },
        display_name: { type: "string", description: "Display name for the token" },
        num_uses: { type: "number", description: "Maximum number of uses (0 for unlimited)" },
        no_parent: { type: "boolean", description: "Create an orphan token" },
        no_default_policy: { type: "boolean", description: "Exclude default policy" },
        metadata: { type: "object", description: "Metadata to attach to the token" },
      },
    },
  },
  {
    name: "lookup_token",
    description: "Look up information about a token including its policies, TTL, and metadata.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Token to look up (optional, defaults to current token)" },
      },
    },
  },
  {
    name: "revoke_token",
    description: "Revoke a token and all of its child tokens.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Token to revoke" },
        accessor: { type: "string", description: "Token accessor (alternative to token)" },
      },
    },
  },

  // Authentication Methods
  {
    name: "list_auth_methods",
    description: "List all enabled authentication methods with their configurations.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },

  // System Status
  {
    name: "seal_status",
    description: "Get the current seal status of the Vault cluster.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "health_check",
    description: "Check the health status of the Vault server including initialization, seal status, and standby mode.",
    inputSchema: {
      type: "object",
      properties: {
        standbyok: { type: "boolean", description: "Return 200 for standby nodes (default: false)" },
        perfstandbyok: { type: "boolean", description: "Return 200 for performance standby nodes (default: false)" },
      },
    },
  },
];

// Tool implementations

/**
 * Read a secret from KV v2
 */
async function readSecret(params: { path: string; mount?: string; version?: number }): Promise<any> {
  const mount = params.mount || "secret";
  let url = `${mount}/data/${params.path}`;
  if (params.version !== undefined) {
    url += `?version=${params.version}`;
  }

  const res = await vaultRequest("GET", url);
  return {
    data: res.data?.data,
    metadata: res.data?.metadata,
  };
}

/**
 * Write a secret to KV v2
 */
async function writeSecret(params: { path: string; data: any; mount?: string; cas?: number }): Promise<any> {
  const mount = params.mount || "secret";
  const body: any = { data: params.data };

  if (params.cas !== undefined) {
    body.options = { cas: params.cas };
  }

  const res = await vaultRequest("POST", `${mount}/data/${params.path}`, body);
  return {
    version: res.data?.version,
    created_time: res.data?.created_time,
    deletion_time: res.data?.deletion_time,
    destroyed: res.data?.destroyed,
  };
}

/**
 * Delete a secret from KV v2
 */
async function deleteSecret(params: { path: string; mount?: string; versions?: number[]; destroy?: boolean }): Promise<any> {
  const mount = params.mount || "secret";

  if (params.destroy && params.versions) {
    // Permanently destroy specific versions
    await vaultRequest("POST", `${mount}/destroy/${params.path}`, { versions: params.versions });
    return { destroyed: true, versions: params.versions };
  } else if (params.versions) {
    // Soft-delete specific versions
    await vaultRequest("POST", `${mount}/delete/${params.path}`, { versions: params.versions });
    return { deleted: true, versions: params.versions };
  } else if (params.destroy) {
    // Destroy all versions
    await vaultRequest("DELETE", `${mount}/metadata/${params.path}`);
    return { destroyed: true, all_versions: true };
  } else {
    // Soft-delete latest version
    await vaultRequest("DELETE", `${mount}/data/${params.path}`);
    return { deleted: true, latest_version: true };
  }
}

/**
 * List secrets at a path
 */
async function listSecrets(params: { path?: string; mount?: string }): Promise<any> {
  const mount = params.mount || "secret";
  const path = params.path || "";

  const res = await vaultRequest("LIST", `${mount}/metadata/${path}`);
  return {
    keys: res.data?.keys || [],
    path: path || "/",
  };
}

/**
 * Get secret metadata
 */
async function getSecretMetadata(params: { path: string; mount?: string }): Promise<any> {
  const mount = params.mount || "secret";
  const res = await vaultRequest("GET", `${mount}/metadata/${params.path}`);
  return {
    path: params.path,
    cas_required: res.data?.cas_required,
    created_time: res.data?.created_time,
    current_version: res.data?.current_version,
    delete_version_after: res.data?.delete_version_after,
    max_versions: res.data?.max_versions,
    oldest_version: res.data?.oldest_version,
    updated_time: res.data?.updated_time,
    versions: res.data?.versions,
    custom_metadata: res.data?.custom_metadata,
  };
}

/**
 * Enable a secrets engine
 */
async function enableSecretsEngine(params: {
  path: string;
  type: string;
  description?: string;
  options?: any;
  config?: any;
}): Promise<any> {
  const body: any = {
    type: params.type,
  };

  if (params.description) body.description = params.description;
  if (params.options) body.options = params.options;
  if (params.config) body.config = params.config;

  await vaultRequest("POST", `sys/mounts/${params.path}`, body);
  return {
    enabled: true,
    path: params.path,
    type: params.type,
  };
}

/**
 * List all secrets engines
 */
async function listSecretsEngines(): Promise<any> {
  const res = await vaultRequest("GET", "sys/mounts");

  const engines = Object.entries(res.data || res).map(([path, config]: [string, any]) => ({
    path,
    type: config.type,
    description: config.description,
    accessor: config.accessor,
    options: config.options,
    config: {
      default_lease_ttl: config.config?.default_lease_ttl,
      max_lease_ttl: config.config?.max_lease_ttl,
      force_no_cache: config.config?.force_no_cache,
    },
    local: config.local,
    seal_wrap: config.seal_wrap,
    external_entropy_access: config.external_entropy_access,
  }));

  return { engines };
}

/**
 * Generate database credentials
 */
async function generateDatabaseCreds(params: { role: string; mount?: string }): Promise<any> {
  const mount = params.mount || "database";
  const res = await vaultRequest("GET", `${mount}/creds/${params.role}`);

  return {
    username: res.data?.username,
    password: res.data?.password,
    lease_id: res.lease_id,
    lease_duration: res.lease_duration,
    renewable: res.renewable,
  };
}

/**
 * Generate AWS credentials
 */
async function generateAwsCreds(params: { role: string; mount?: string; ttl?: string; role_arn?: string }): Promise<any> {
  const mount = params.mount || "aws";
  let url = `${mount}/creds/${params.role}`;

  const queryParams: string[] = [];
  if (params.ttl) queryParams.push(`ttl=${params.ttl}`);
  if (params.role_arn) queryParams.push(`role_arn=${encodeURIComponent(params.role_arn)}`);
  if (queryParams.length > 0) url += `?${queryParams.join("&")}`;

  const res = await vaultRequest("GET", url);

  return {
    access_key: res.data?.access_key,
    secret_key: res.data?.secret_key,
    security_token: res.data?.security_token,
    lease_id: res.lease_id,
    lease_duration: res.lease_duration,
    renewable: res.renewable,
  };
}

/**
 * List all policies
 */
async function listPolicies(): Promise<any> {
  const res = await vaultRequest("LIST", "sys/policies/acl");
  return {
    policies: res.data?.keys || [],
  };
}

/**
 * Get policy details
 */
async function getPolicy(params: { name: string }): Promise<any> {
  const res = await vaultRequest("GET", `sys/policies/acl/${params.name}`);
  return {
    name: res.data?.name || params.name,
    policy: res.data?.policy,
  };
}

/**
 * Create or update a policy
 */
async function createPolicy(params: { name: string; policy: string }): Promise<any> {
  await vaultRequest("PUT", `sys/policies/acl/${params.name}`, { policy: params.policy });
  return {
    name: params.name,
    created: true,
  };
}

/**
 * Delete a policy
 */
async function deletePolicy(params: { name: string }): Promise<any> {
  await vaultRequest("DELETE", `sys/policies/acl/${params.name}`);
  return {
    name: params.name,
    deleted: true,
  };
}

/**
 * Create a new token
 */
async function createToken(params: {
  policies?: string[];
  ttl?: string;
  explicit_max_ttl?: string;
  renewable?: boolean;
  display_name?: string;
  num_uses?: number;
  no_parent?: boolean;
  no_default_policy?: boolean;
  metadata?: any;
}): Promise<any> {
  const body: any = {};

  if (params.policies) body.policies = params.policies;
  if (params.ttl) body.ttl = params.ttl;
  if (params.explicit_max_ttl) body.explicit_max_ttl = params.explicit_max_ttl;
  if (params.renewable !== undefined) body.renewable = params.renewable;
  if (params.display_name) body.display_name = params.display_name;
  if (params.num_uses !== undefined) body.num_uses = params.num_uses;
  if (params.no_parent) body.no_parent = params.no_parent;
  if (params.no_default_policy) body.no_default_policy = params.no_default_policy;
  if (params.metadata) body.meta = params.metadata;

  const res = await vaultRequest("POST", "auth/token/create", body);

  return {
    client_token: res.auth?.client_token,
    accessor: res.auth?.accessor,
    policies: res.auth?.policies,
    token_policies: res.auth?.token_policies,
    identity_policies: res.auth?.identity_policies,
    metadata: res.auth?.metadata,
    lease_duration: res.auth?.lease_duration,
    renewable: res.auth?.renewable,
    entity_id: res.auth?.entity_id,
    token_type: res.auth?.token_type,
    orphan: res.auth?.orphan,
  };
}

/**
 * Look up token information
 */
async function lookupToken(params: { token?: string }): Promise<any> {
  let res;

  if (params.token) {
    res = await vaultRequest("POST", "auth/token/lookup", { token: params.token });
  } else {
    res = await vaultRequest("GET", "auth/token/lookup-self");
  }

  return {
    accessor: res.data?.accessor,
    creation_time: res.data?.creation_time,
    creation_ttl: res.data?.creation_ttl,
    display_name: res.data?.display_name,
    entity_id: res.data?.entity_id,
    expire_time: res.data?.expire_time,
    explicit_max_ttl: res.data?.explicit_max_ttl,
    id: res.data?.id,
    issue_time: res.data?.issue_time,
    meta: res.data?.meta,
    num_uses: res.data?.num_uses,
    orphan: res.data?.orphan,
    path: res.data?.path,
    policies: res.data?.policies,
    renewable: res.data?.renewable,
    ttl: res.data?.ttl,
    type: res.data?.type,
  };
}

/**
 * Revoke a token
 */
async function revokeToken(params: { token?: string; accessor?: string }): Promise<any> {
  if (params.accessor) {
    await vaultRequest("POST", "auth/token/revoke-accessor", { accessor: params.accessor });
    return { revoked: true, method: "accessor" };
  } else if (params.token) {
    await vaultRequest("POST", "auth/token/revoke", { token: params.token });
    return { revoked: true, method: "token" };
  } else {
    throw new Error("Either token or accessor must be provided");
  }
}

/**
 * List authentication methods
 */
async function listAuthMethods(): Promise<any> {
  const res = await vaultRequest("GET", "sys/auth");

  const methods = Object.entries(res.data || res).map(([path, config]: [string, any]) => ({
    path,
    type: config.type,
    description: config.description,
    accessor: config.accessor,
    config: {
      default_lease_ttl: config.config?.default_lease_ttl,
      max_lease_ttl: config.config?.max_lease_ttl,
      token_type: config.config?.token_type,
    },
    local: config.local,
    seal_wrap: config.seal_wrap,
  }));

  return { auth_methods: methods };
}

/**
 * Get seal status
 */
async function sealStatus(): Promise<any> {
  const res = await vaultRequest("GET", "sys/seal-status");

  return {
    type: res.type,
    initialized: res.initialized,
    sealed: res.sealed,
    t: res.t,
    n: res.n,
    progress: res.progress,
    nonce: res.nonce,
    version: res.version,
    build_date: res.build_date,
    migration: res.migration,
    cluster_name: res.cluster_name,
    cluster_id: res.cluster_id,
    recovery_seal: res.recovery_seal,
    storage_type: res.storage_type,
  };
}

/**
 * Health check
 */
async function healthCheck(params: { standbyok?: boolean; perfstandbyok?: boolean }): Promise<any> {
  const queryParams: string[] = [];
  if (params.standbyok) queryParams.push("standbyok=true");
  if (params.perfstandbyok) queryParams.push("perfstandbyok=true");

  const url = `${config.endpoint}/v1/sys/health${queryParams.length > 0 ? "?" + queryParams.join("&") : ""}`;

  // Health endpoint may return non-200 status codes that are still valid responses
  const res = await fetch(url);
  const data = await res.json();

  return {
    initialized: data.initialized,
    sealed: data.sealed,
    standby: data.standby,
    performance_standby: data.performance_standby,
    replication_performance_mode: data.replication_performance_mode,
    replication_dr_mode: data.replication_dr_mode,
    server_time_utc: data.server_time_utc,
    version: data.version,
    cluster_name: data.cluster_name,
    cluster_id: data.cluster_id,
    http_status_code: res.status,
  };
}

// Create and configure the MCP server
const server = new Server(
  {
    name: "vault-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      // KV Secrets
      case "read_secret":
        result = await readSecret(args as any);
        break;
      case "write_secret":
        result = await writeSecret(args as any);
        break;
      case "delete_secret":
        result = await deleteSecret(args as any);
        break;
      case "list_secrets":
        result = await listSecrets(args as any);
        break;
      case "get_secret_metadata":
        result = await getSecretMetadata(args as any);
        break;

      // Secrets Engines
      case "enable_secrets_engine":
        result = await enableSecretsEngine(args as any);
        break;
      case "list_secrets_engines":
        result = await listSecretsEngines();
        break;

      // Dynamic Credentials
      case "generate_database_creds":
        result = await generateDatabaseCreds(args as any);
        break;
      case "generate_aws_creds":
        result = await generateAwsCreds(args as any);
        break;

      // Policies
      case "list_policies":
        result = await listPolicies();
        break;
      case "get_policy":
        result = await getPolicy(args as any);
        break;
      case "create_policy":
        result = await createPolicy(args as any);
        break;
      case "delete_policy":
        result = await deletePolicy(args as any);
        break;

      // Tokens
      case "create_token":
        result = await createToken(args as any);
        break;
      case "lookup_token":
        result = await lookupToken(args as any);
        break;
      case "revoke_token":
        result = await revokeToken(args as any);
        break;

      // Auth Methods
      case "list_auth_methods":
        result = await listAuthMethods();
        break;

      // System Status
      case "seal_status":
        result = await sealStatus();
        break;
      case "health_check":
        result = await healthCheck(args as any);
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
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: error.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Main entry point
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("HashiCorp Vault MCP Server running on stdio");
  console.error(`Vault address: ${config.endpoint}`);
  console.error(`Namespace: ${config.namespace || "(none)"}`);
}

main().catch((error) => {
  console.error("Failed to start Vault MCP Server:", error);
  process.exit(1);
});
