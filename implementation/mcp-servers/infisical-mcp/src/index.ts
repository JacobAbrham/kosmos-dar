/**
 * Infisical MCP Server - Secrets management for KOSMOS
 * Provides secure secret storage and retrieval
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  siteUrl: process.env.INFISICAL_SITE_URL || "https://app.infisical.com",
  serviceToken: process.env.INFISICAL_SERVICE_TOKEN || "",
  clientId: process.env.INFISICAL_CLIENT_ID || "",
  clientSecret: process.env.INFISICAL_CLIENT_SECRET || "",
};

let accessToken: string | null = null;

async function authenticate(): Promise<string> {
  if (config.serviceToken) {
    return config.serviceToken;
  }

  if (accessToken) {
    return accessToken;
  }

  if (config.clientId && config.clientSecret) {
    const res = await fetch(`${config.siteUrl}/api/v1/auth/universal-auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      }),
    });

    if (!res.ok) {
      throw new Error("Authentication failed");
    }

    const data = await res.json();
    accessToken = data.accessToken;
    return accessToken!;
  }

  throw new Error("No authentication credentials configured");
}

async function infisicalRequest(method: string, path: string, body?: any): Promise<any> {
  const token = await authenticate();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(`${config.siteUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || res.statusText);
  }

  return res.json();
}

const TOOLS: Tool[] = [
  // Secrets
  {
    name: "get_secrets",
    description: "Get all secrets from a project environment.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
        environment: { type: "string", description: "e.g., dev, staging, prod" },
        path: { type: "string", description: "Secret path (default: /)" },
        includeImports: { type: "boolean" },
      },
      required: ["workspaceId", "environment"],
    },
  },
  {
    name: "get_secret",
    description: "Get a single secret by name.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
        environment: { type: "string" },
        secretName: { type: "string" },
        path: { type: "string" },
        type: { type: "string", enum: ["shared", "personal"] },
      },
      required: ["workspaceId", "environment", "secretName"],
    },
  },
  {
    name: "create_secret",
    description: "Create a new secret.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
        environment: { type: "string" },
        secretName: { type: "string" },
        secretValue: { type: "string" },
        path: { type: "string" },
        type: { type: "string", enum: ["shared", "personal"] },
        secretComment: { type: "string" },
      },
      required: ["workspaceId", "environment", "secretName", "secretValue"],
    },
  },
  {
    name: "update_secret",
    description: "Update an existing secret.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
        environment: { type: "string" },
        secretName: { type: "string" },
        secretValue: { type: "string" },
        path: { type: "string" },
        type: { type: "string", enum: ["shared", "personal"] },
      },
      required: ["workspaceId", "environment", "secretName", "secretValue"],
    },
  },
  {
    name: "delete_secret",
    description: "Delete a secret.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
        environment: { type: "string" },
        secretName: { type: "string" },
        path: { type: "string" },
        type: { type: "string", enum: ["shared", "personal"] },
      },
      required: ["workspaceId", "environment", "secretName"],
    },
  },
  // Folders
  {
    name: "list_folders",
    description: "List secret folders.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
        environment: { type: "string" },
        path: { type: "string" },
      },
      required: ["workspaceId", "environment"],
    },
  },
  {
    name: "create_folder",
    description: "Create a secret folder.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
        environment: { type: "string" },
        folderName: { type: "string" },
        path: { type: "string" },
      },
      required: ["workspaceId", "environment", "folderName"],
    },
  },
  {
    name: "delete_folder",
    description: "Delete a secret folder.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
        environment: { type: "string" },
        folderName: { type: "string" },
        path: { type: "string" },
      },
      required: ["workspaceId", "environment", "folderName"],
    },
  },
  // Projects/Workspaces
  {
    name: "list_workspaces",
    description: "List all workspaces/projects.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_workspace",
    description: "Get workspace details.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
      },
      required: ["workspaceId"],
    },
  },
  // Environments
  {
    name: "list_environments",
    description: "List environments in a workspace.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
      },
      required: ["workspaceId"],
    },
  },
  // Secret Imports
  {
    name: "list_imports",
    description: "List secret imports.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
        environment: { type: "string" },
        path: { type: "string" },
      },
      required: ["workspaceId", "environment"],
    },
  },
  {
    name: "create_import",
    description: "Create a secret import.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
        environment: { type: "string" },
        path: { type: "string" },
        importEnv: { type: "string" },
        importPath: { type: "string" },
      },
      required: ["workspaceId", "environment", "importEnv", "importPath"],
    },
  },
  // Secret Rotation
  {
    name: "get_rotation_config",
    description: "Get secret rotation configuration.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
      },
      required: ["workspaceId"],
    },
  },
  // Audit Logs
  {
    name: "get_audit_logs",
    description: "Get audit logs for a workspace.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceId: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
        eventType: { type: "string" },
      },
      required: ["workspaceId"],
    },
  },
];

async function getSecrets(params: {
  workspaceId: string;
  environment: string;
  path?: string;
  includeImports?: boolean;
}): Promise<any> {
  const query = new URLSearchParams({
    workspaceId: params.workspaceId,
    environment: params.environment,
    secretPath: params.path || "/",
  });
  if (params.includeImports) query.set("include_imports", "true");

  return infisicalRequest("GET", `/api/v3/secrets?${query.toString()}`);
}

async function getSecret(params: {
  workspaceId: string;
  environment: string;
  secretName: string;
  path?: string;
  type?: string;
}): Promise<any> {
  const query = new URLSearchParams({
    workspaceId: params.workspaceId,
    environment: params.environment,
    secretPath: params.path || "/",
  });
  if (params.type) query.set("type", params.type);

  return infisicalRequest("GET", `/api/v3/secrets/${params.secretName}?${query.toString()}`);
}

async function createSecret(params: {
  workspaceId: string;
  environment: string;
  secretName: string;
  secretValue: string;
  path?: string;
  type?: string;
  secretComment?: string;
}): Promise<any> {
  return infisicalRequest("POST", "/api/v3/secrets", {
    workspaceId: params.workspaceId,
    environment: params.environment,
    secretPath: params.path || "/",
    secretName: params.secretName,
    secretValue: params.secretValue,
    type: params.type || "shared",
    secretComment: params.secretComment,
  });
}

async function updateSecret(params: {
  workspaceId: string;
  environment: string;
  secretName: string;
  secretValue: string;
  path?: string;
  type?: string;
}): Promise<any> {
  return infisicalRequest("PATCH", `/api/v3/secrets/${params.secretName}`, {
    workspaceId: params.workspaceId,
    environment: params.environment,
    secretPath: params.path || "/",
    secretValue: params.secretValue,
    type: params.type || "shared",
  });
}

async function deleteSecret(params: {
  workspaceId: string;
  environment: string;
  secretName: string;
  path?: string;
  type?: string;
}): Promise<any> {
  return infisicalRequest("DELETE", `/api/v3/secrets/${params.secretName}`, {
    workspaceId: params.workspaceId,
    environment: params.environment,
    secretPath: params.path || "/",
    type: params.type || "shared",
  });
}

async function listFolders(params: {
  workspaceId: string;
  environment: string;
  path?: string;
}): Promise<any> {
  const query = new URLSearchParams({
    workspaceId: params.workspaceId,
    environment: params.environment,
    path: params.path || "/",
  });

  return infisicalRequest("GET", `/api/v1/folders?${query.toString()}`);
}

async function createFolder(params: {
  workspaceId: string;
  environment: string;
  folderName: string;
  path?: string;
}): Promise<any> {
  return infisicalRequest("POST", "/api/v1/folders", {
    workspaceId: params.workspaceId,
    environment: params.environment,
    name: params.folderName,
    path: params.path || "/",
  });
}

async function deleteFolder(params: {
  workspaceId: string;
  environment: string;
  folderName: string;
  path?: string;
}): Promise<any> {
  return infisicalRequest("DELETE", `/api/v1/folders/${params.folderName}`, {
    workspaceId: params.workspaceId,
    environment: params.environment,
    path: params.path || "/",
  });
}

async function listWorkspaces(): Promise<any> {
  return infisicalRequest("GET", "/api/v1/workspace");
}

async function getWorkspace(params: { workspaceId: string }): Promise<any> {
  return infisicalRequest("GET", `/api/v1/workspace/${params.workspaceId}`);
}

async function listEnvironments(params: { workspaceId: string }): Promise<any> {
  return infisicalRequest("GET", `/api/v1/workspace/${params.workspaceId}/environments`);
}

async function listImports(params: {
  workspaceId: string;
  environment: string;
  path?: string;
}): Promise<any> {
  const query = new URLSearchParams({
    workspaceId: params.workspaceId,
    environment: params.environment,
    path: params.path || "/",
  });

  return infisicalRequest("GET", `/api/v1/secret-imports?${query.toString()}`);
}

async function createImport(params: {
  workspaceId: string;
  environment: string;
  path?: string;
  importEnv: string;
  importPath: string;
}): Promise<any> {
  return infisicalRequest("POST", "/api/v1/secret-imports", {
    workspaceId: params.workspaceId,
    environment: params.environment,
    path: params.path || "/",
    import: {
      environment: params.importEnv,
      path: params.importPath,
    },
  });
}

async function getRotationConfig(params: { workspaceId: string }): Promise<any> {
  return infisicalRequest("GET", `/api/v1/secret-rotation?workspaceId=${params.workspaceId}`);
}

async function getAuditLogs(params: {
  workspaceId: string;
  limit?: number;
  offset?: number;
  eventType?: string;
}): Promise<any> {
  const query = new URLSearchParams({ workspaceId: params.workspaceId });
  if (params.limit) query.set("limit", params.limit.toString());
  if (params.offset) query.set("offset", params.offset.toString());
  if (params.eventType) query.set("eventType", params.eventType);

  return infisicalRequest("GET", `/api/v1/audit-logs?${query.toString()}`);
}

const server = new Server({ name: "infisical-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "get_secrets": result = await getSecrets(args as any); break;
      case "get_secret": result = await getSecret(args as any); break;
      case "create_secret": result = await createSecret(args as any); break;
      case "update_secret": result = await updateSecret(args as any); break;
      case "delete_secret": result = await deleteSecret(args as any); break;
      case "list_folders": result = await listFolders(args as any); break;
      case "create_folder": result = await createFolder(args as any); break;
      case "delete_folder": result = await deleteFolder(args as any); break;
      case "list_workspaces": result = await listWorkspaces(); break;
      case "get_workspace": result = await getWorkspace(args as any); break;
      case "list_environments": result = await listEnvironments(args as any); break;
      case "list_imports": result = await listImports(args as any); break;
      case "create_import": result = await createImport(args as any); break;
      case "get_rotation_config": result = await getRotationConfig(args as any); break;
      case "get_audit_logs": result = await getAuditLogs(args as any); break;
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
  console.error("Infisical MCP Server running on stdio");
}

main().catch(console.error);
