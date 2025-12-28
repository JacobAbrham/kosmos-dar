/**
 * Zitadel MCP Server - Identity and access management for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  endpoint: process.env.ZITADEL_ENDPOINT || "http://localhost:8080",
  token: process.env.ZITADEL_TOKEN || "",
  orgId: process.env.ZITADEL_ORG_ID || "",
};

async function zitadelRequest(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${config.endpoint}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...(config.orgId ? { "x-zitadel-orgid": config.orgId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || res.statusText);
  }
  return res.status === 204 ? {} : res.json();
}

const TOOLS: Tool[] = [
  // User Management
  { name: "create_user", description: "Create a new user.", inputSchema: { type: "object", properties: { userName: { type: "string" }, email: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" }, displayName: { type: "string" }, password: { type: "string" }, phone: { type: "string" } }, required: ["userName", "email", "firstName", "lastName"] } },
  { name: "get_user", description: "Get user by ID.", inputSchema: { type: "object", properties: { userId: { type: "string" } }, required: ["userId"] } },
  { name: "search_users", description: "Search users.", inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" }, offset: { type: "number" } } } },
  { name: "update_user", description: "Update user profile.", inputSchema: { type: "object", properties: { userId: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" }, displayName: { type: "string" }, nickName: { type: "string" } }, required: ["userId"] } },
  { name: "delete_user", description: "Delete a user.", inputSchema: { type: "object", properties: { userId: { type: "string" } }, required: ["userId"] } },
  { name: "deactivate_user", description: "Deactivate a user.", inputSchema: { type: "object", properties: { userId: { type: "string" } }, required: ["userId"] } },
  { name: "reactivate_user", description: "Reactivate a user.", inputSchema: { type: "object", properties: { userId: { type: "string" } }, required: ["userId"] } },
  { name: "lock_user", description: "Lock a user account.", inputSchema: { type: "object", properties: { userId: { type: "string" } }, required: ["userId"] } },
  { name: "unlock_user", description: "Unlock a user account.", inputSchema: { type: "object", properties: { userId: { type: "string" } }, required: ["userId"] } },
  // User Grants (Role Assignments)
  { name: "add_user_grant", description: "Grant roles to a user.", inputSchema: { type: "object", properties: { userId: { type: "string" }, projectId: { type: "string" }, roleKeys: { type: "array", items: { type: "string" } } }, required: ["userId", "projectId", "roleKeys"] } },
  { name: "remove_user_grant", description: "Remove a user grant.", inputSchema: { type: "object", properties: { userId: { type: "string" }, grantId: { type: "string" } }, required: ["userId", "grantId"] } },
  { name: "list_user_grants", description: "List user grants.", inputSchema: { type: "object", properties: { userId: { type: "string" } }, required: ["userId"] } },
  // Organization Management
  { name: "create_org", description: "Create an organization.", inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "get_org", description: "Get organization.", inputSchema: { type: "object", properties: { orgId: { type: "string" } } } },
  { name: "list_orgs", description: "List organizations.", inputSchema: { type: "object", properties: { limit: { type: "number" }, offset: { type: "number" } } } },
  // Project Management
  { name: "create_project", description: "Create a project.", inputSchema: { type: "object", properties: { name: { type: "string" }, projectRoleAssertion: { type: "boolean" }, projectRoleCheck: { type: "boolean" } }, required: ["name"] } },
  { name: "get_project", description: "Get project.", inputSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"] } },
  { name: "list_projects", description: "List projects.", inputSchema: { type: "object", properties: { limit: { type: "number" }, offset: { type: "number" } } } },
  { name: "add_project_role", description: "Add a role to a project.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, roleKey: { type: "string" }, displayName: { type: "string" }, group: { type: "string" } }, required: ["projectId", "roleKey", "displayName"] } },
  { name: "list_project_roles", description: "List project roles.", inputSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"] } },
  // Application Management
  { name: "create_app_oidc", description: "Create an OIDC application.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, name: { type: "string" }, redirectUris: { type: "array", items: { type: "string" } }, responseTypes: { type: "array", items: { type: "string" } }, grantTypes: { type: "array", items: { type: "string" } }, appType: { type: "string", enum: ["OIDC_APP_TYPE_WEB", "OIDC_APP_TYPE_NATIVE", "OIDC_APP_TYPE_USER_AGENT"] }, authMethodType: { type: "string" } }, required: ["projectId", "name", "redirectUris"] } },
  { name: "create_app_api", description: "Create an API application.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, name: { type: "string" }, authMethodType: { type: "string", enum: ["API_AUTH_METHOD_TYPE_BASIC", "API_AUTH_METHOD_TYPE_PRIVATE_KEY_JWT"] } }, required: ["projectId", "name"] } },
  { name: "list_apps", description: "List applications in a project.", inputSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"] } },
  { name: "regenerate_client_secret", description: "Regenerate app client secret.", inputSchema: { type: "object", properties: { projectId: { type: "string" }, appId: { type: "string" } }, required: ["projectId", "appId"] } },
  // Session/Token Management
  { name: "introspect_token", description: "Introspect an access token.", inputSchema: { type: "object", properties: { token: { type: "string" } }, required: ["token"] } },
  { name: "revoke_token", description: "Revoke a token.", inputSchema: { type: "object", properties: { token: { type: "string" } }, required: ["token"] } },
  // Metadata
  { name: "set_user_metadata", description: "Set user metadata.", inputSchema: { type: "object", properties: { userId: { type: "string" }, key: { type: "string" }, value: { type: "string" } }, required: ["userId", "key", "value"] } },
  { name: "get_user_metadata", description: "Get user metadata.", inputSchema: { type: "object", properties: { userId: { type: "string" }, key: { type: "string" } }, required: ["userId"] } },
];

async function createUser(params: { userName: string; email: string; firstName: string; lastName: string; displayName?: string; password?: string; phone?: string }): Promise<any> {
  const res = await zitadelRequest("POST", "/v2/users/human", {
    username: params.userName,
    profile: { givenName: params.firstName, familyName: params.lastName, displayName: params.displayName },
    email: { email: params.email, isVerified: false },
    phone: params.phone ? { phone: params.phone } : undefined,
    password: params.password ? { password: params.password, changeRequired: false } : undefined,
  });
  return { userId: res.userId, userName: params.userName, created: true };
}

async function getUser(params: { userId: string }): Promise<any> {
  const res = await zitadelRequest("GET", `/v2/users/${params.userId}`);
  return res.user;
}

async function searchUsers(params: { query?: string; limit?: number; offset?: number }): Promise<any> {
  const res = await zitadelRequest("POST", "/v2/users", {
    query: { limit: params.limit || 100, offset: params.offset || 0 },
    queries: params.query ? [{ userNameQuery: { userName: params.query, method: "TEXT_QUERY_METHOD_CONTAINS_IGNORE_CASE" } }] : [],
  });
  return { users: res.result || [], totalCount: res.details?.totalResult };
}

async function updateUser(params: { userId: string; firstName?: string; lastName?: string; displayName?: string; nickName?: string }): Promise<any> {
  await zitadelRequest("PUT", `/v2/users/${params.userId}/profile`, {
    givenName: params.firstName,
    familyName: params.lastName,
    displayName: params.displayName,
    nickName: params.nickName,
  });
  return { userId: params.userId, updated: true };
}

async function deleteUser(params: { userId: string }): Promise<any> {
  await zitadelRequest("DELETE", `/v2/users/${params.userId}`);
  return { userId: params.userId, deleted: true };
}

async function deactivateUser(params: { userId: string }): Promise<any> {
  await zitadelRequest("POST", `/v2/users/${params.userId}/deactivate`);
  return { userId: params.userId, deactivated: true };
}

async function reactivateUser(params: { userId: string }): Promise<any> {
  await zitadelRequest("POST", `/v2/users/${params.userId}/reactivate`);
  return { userId: params.userId, reactivated: true };
}

async function lockUser(params: { userId: string }): Promise<any> {
  await zitadelRequest("POST", `/v2/users/${params.userId}/lock`);
  return { userId: params.userId, locked: true };
}

async function unlockUser(params: { userId: string }): Promise<any> {
  await zitadelRequest("POST", `/v2/users/${params.userId}/unlock`);
  return { userId: params.userId, unlocked: true };
}

async function addUserGrant(params: { userId: string; projectId: string; roleKeys: string[] }): Promise<any> {
  const res = await zitadelRequest("POST", `/management/v1/users/${params.userId}/grants`, {
    projectId: params.projectId,
    roleKeys: params.roleKeys,
  });
  return { grantId: res.userGrantId, userId: params.userId, granted: true };
}

async function removeUserGrant(params: { userId: string; grantId: string }): Promise<any> {
  await zitadelRequest("DELETE", `/management/v1/users/${params.userId}/grants/${params.grantId}`);
  return { grantId: params.grantId, removed: true };
}

async function listUserGrants(params: { userId: string }): Promise<any> {
  const res = await zitadelRequest("POST", `/management/v1/users/${params.userId}/grants/_search`, {});
  return { grants: res.result || [] };
}

async function createOrg(params: { name: string }): Promise<any> {
  const res = await zitadelRequest("POST", "/management/v1/orgs", { name: params.name });
  return { orgId: res.id, name: params.name, created: true };
}

async function getOrg(params: { orgId?: string }): Promise<any> {
  const res = await zitadelRequest("GET", "/management/v1/orgs/me");
  return res.org;
}

async function listOrgs(params: { limit?: number; offset?: number }): Promise<any> {
  const res = await zitadelRequest("POST", "/admin/v1/orgs/_search", { query: { limit: params.limit || 100, offset: params.offset || 0 } });
  return { orgs: res.result || [] };
}

async function createProject(params: { name: string; projectRoleAssertion?: boolean; projectRoleCheck?: boolean }): Promise<any> {
  const res = await zitadelRequest("POST", "/management/v1/projects", {
    name: params.name,
    projectRoleAssertion: params.projectRoleAssertion,
    projectRoleCheck: params.projectRoleCheck,
  });
  return { projectId: res.id, name: params.name, created: true };
}

async function getProject(params: { projectId: string }): Promise<any> {
  const res = await zitadelRequest("GET", `/management/v1/projects/${params.projectId}`);
  return res.project;
}

async function listProjects(params: { limit?: number; offset?: number }): Promise<any> {
  const res = await zitadelRequest("POST", "/management/v1/projects/_search", { query: { limit: params.limit || 100, offset: params.offset || 0 } });
  return { projects: res.result || [] };
}

async function addProjectRole(params: { projectId: string; roleKey: string; displayName: string; group?: string }): Promise<any> {
  await zitadelRequest("POST", `/management/v1/projects/${params.projectId}/roles`, {
    roleKey: params.roleKey,
    displayName: params.displayName,
    group: params.group,
  });
  return { projectId: params.projectId, roleKey: params.roleKey, added: true };
}

async function listProjectRoles(params: { projectId: string }): Promise<any> {
  const res = await zitadelRequest("POST", `/management/v1/projects/${params.projectId}/roles/_search`, {});
  return { roles: res.result || [] };
}

async function createAppOidc(params: { projectId: string; name: string; redirectUris: string[]; responseTypes?: string[]; grantTypes?: string[]; appType?: string; authMethodType?: string }): Promise<any> {
  const res = await zitadelRequest("POST", `/management/v1/projects/${params.projectId}/apps/oidc`, {
    name: params.name,
    redirectUris: params.redirectUris,
    responseTypes: params.responseTypes || ["OIDC_RESPONSE_TYPE_CODE"],
    grantTypes: params.grantTypes || ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE"],
    appType: params.appType || "OIDC_APP_TYPE_WEB",
    authMethodType: params.authMethodType || "OIDC_AUTH_METHOD_TYPE_BASIC",
  });
  return { appId: res.appId, clientId: res.clientId, clientSecret: res.clientSecret, name: params.name };
}

async function createAppApi(params: { projectId: string; name: string; authMethodType?: string }): Promise<any> {
  const res = await zitadelRequest("POST", `/management/v1/projects/${params.projectId}/apps/api`, {
    name: params.name,
    authMethodType: params.authMethodType || "API_AUTH_METHOD_TYPE_BASIC",
  });
  return { appId: res.appId, clientId: res.clientId, clientSecret: res.clientSecret, name: params.name };
}

async function listApps(params: { projectId: string }): Promise<any> {
  const res = await zitadelRequest("POST", `/management/v1/projects/${params.projectId}/apps/_search`, {});
  return { apps: res.result || [] };
}

async function regenerateClientSecret(params: { projectId: string; appId: string }): Promise<any> {
  const res = await zitadelRequest("POST", `/management/v1/projects/${params.projectId}/apps/${params.appId}/oidc_config/_generate_client_secret`, {});
  return { appId: params.appId, clientSecret: res.clientSecret };
}

async function introspectToken(params: { token: string }): Promise<any> {
  const res = await fetch(`${config.endpoint}/oauth/v2/introspect`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `Bearer ${config.token}` },
    body: `token=${encodeURIComponent(params.token)}`,
  });
  return res.json();
}

async function revokeToken(params: { token: string }): Promise<any> {
  await fetch(`${config.endpoint}/oauth/v2/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `Bearer ${config.token}` },
    body: `token=${encodeURIComponent(params.token)}`,
  });
  return { revoked: true };
}

async function setUserMetadata(params: { userId: string; key: string; value: string }): Promise<any> {
  await zitadelRequest("POST", `/management/v1/users/${params.userId}/metadata/${params.key}`, {
    value: Buffer.from(params.value).toString("base64"),
  });
  return { userId: params.userId, key: params.key, set: true };
}

async function getUserMetadata(params: { userId: string; key?: string }): Promise<any> {
  if (params.key) {
    const res = await zitadelRequest("GET", `/management/v1/users/${params.userId}/metadata/${params.key}`);
    return { key: params.key, value: Buffer.from(res.metadata.value, "base64").toString() };
  }
  const res = await zitadelRequest("POST", `/management/v1/users/${params.userId}/metadata/_search`, {});
  return { metadata: (res.result || []).map((m: any) => ({ key: m.key, value: Buffer.from(m.value, "base64").toString() })) };
}

const server = new Server({ name: "zitadel-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "create_user": result = await createUser(args as any); break;
      case "get_user": result = await getUser(args as any); break;
      case "search_users": result = await searchUsers(args as any); break;
      case "update_user": result = await updateUser(args as any); break;
      case "delete_user": result = await deleteUser(args as any); break;
      case "deactivate_user": result = await deactivateUser(args as any); break;
      case "reactivate_user": result = await reactivateUser(args as any); break;
      case "lock_user": result = await lockUser(args as any); break;
      case "unlock_user": result = await unlockUser(args as any); break;
      case "add_user_grant": result = await addUserGrant(args as any); break;
      case "remove_user_grant": result = await removeUserGrant(args as any); break;
      case "list_user_grants": result = await listUserGrants(args as any); break;
      case "create_org": result = await createOrg(args as any); break;
      case "get_org": result = await getOrg(args as any); break;
      case "list_orgs": result = await listOrgs(args as any); break;
      case "create_project": result = await createProject(args as any); break;
      case "get_project": result = await getProject(args as any); break;
      case "list_projects": result = await listProjects(args as any); break;
      case "add_project_role": result = await addProjectRole(args as any); break;
      case "list_project_roles": result = await listProjectRoles(args as any); break;
      case "create_app_oidc": result = await createAppOidc(args as any); break;
      case "create_app_api": result = await createAppApi(args as any); break;
      case "list_apps": result = await listApps(args as any); break;
      case "regenerate_client_secret": result = await regenerateClientSecret(args as any); break;
      case "introspect_token": result = await introspectToken(args as any); break;
      case "revoke_token": result = await revokeToken(args as any); break;
      case "set_user_metadata": result = await setUserMetadata(args as any); break;
      case "get_user_metadata": result = await getUserMetadata(args as any); break;
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
  console.error("Zitadel MCP Server running on stdio");
}

main().catch(console.error);
