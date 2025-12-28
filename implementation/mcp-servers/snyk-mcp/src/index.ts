/**
 * Snyk MCP Server - Dependency security scanning for KOSMOS
 * Provides vulnerability scanning for open source dependencies
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  apiToken: process.env.SNYK_TOKEN || "",
  apiUrl: "https://api.snyk.io",
  orgId: process.env.SNYK_ORG_ID || "",
};

async function snykRequest(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `token ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || error.error || res.statusText);
  }

  return res.json();
}

const TOOLS: Tool[] = [
  // Organizations
  { name: "list_orgs", description: "List all organizations.", inputSchema: { type: "object", properties: {} } },
  { name: "get_org", description: "Get organization details.", inputSchema: { type: "object", properties: { orgId: { type: "string" } }, required: ["orgId"] } },
  // Projects
  { name: "list_projects", description: "List all projects in an organization.", inputSchema: { type: "object", properties: { orgId: { type: "string" } } } },
  { name: "get_project", description: "Get project details.", inputSchema: { type: "object", properties: { orgId: { type: "string" }, projectId: { type: "string" } }, required: ["projectId"] } },
  { name: "delete_project", description: "Delete a project.", inputSchema: { type: "object", properties: { orgId: { type: "string" }, projectId: { type: "string" } }, required: ["projectId"] } },
  // Issues
  { name: "list_issues", description: "List all issues in a project.", inputSchema: { type: "object", properties: { orgId: { type: "string" }, projectId: { type: "string" } }, required: ["projectId"] } },
  { name: "get_issue", description: "Get issue details.", inputSchema: { type: "object", properties: { orgId: { type: "string" }, issueId: { type: "string" } }, required: ["issueId"] } },
  // Testing
  { name: "test_npm", description: "Test npm package for vulnerabilities.", inputSchema: { type: "object", properties: { packageName: { type: "string" }, version: { type: "string" }, orgId: { type: "string" } }, required: ["packageName"] } },
  { name: "test_pip", description: "Test pip package for vulnerabilities.", inputSchema: { type: "object", properties: { packageName: { type: "string" }, version: { type: "string" }, orgId: { type: "string" } }, required: ["packageName"] } },
  { name: "test_maven", description: "Test Maven artifact for vulnerabilities.", inputSchema: { type: "object", properties: { groupId: { type: "string" }, artifactId: { type: "string" }, version: { type: "string" }, orgId: { type: "string" } }, required: ["groupId", "artifactId", "version"] } },
  { name: "test_rubygems", description: "Test RubyGems package for vulnerabilities.", inputSchema: { type: "object", properties: { gemName: { type: "string" }, version: { type: "string" }, orgId: { type: "string" } }, required: ["gemName"] } },
  { name: "test_sbt", description: "Test SBT artifact for vulnerabilities.", inputSchema: { type: "object", properties: { groupId: { type: "string" }, artifactId: { type: "string" }, version: { type: "string" }, orgId: { type: "string" } }, required: ["groupId", "artifactId", "version"] } },
  // Dependencies
  { name: "list_dependencies", description: "List all dependencies for a project.", inputSchema: { type: "object", properties: { orgId: { type: "string" }, projectId: { type: "string" } }, required: ["projectId"] } },
  // Ignores
  { name: "list_ignores", description: "List all ignored issues.", inputSchema: { type: "object", properties: { orgId: { type: "string" }, projectId: { type: "string" } }, required: ["projectId"] } },
  { name: "add_ignore", description: "Add an issue ignore.", inputSchema: { type: "object", properties: { orgId: { type: "string" }, projectId: { type: "string" }, issueId: { type: "string" }, reason: { type: "string" }, expires: { type: "string" } }, required: ["projectId", "issueId"] } },
  // Licenses
  { name: "list_licenses", description: "List licenses in a project.", inputSchema: { type: "object", properties: { orgId: { type: "string" }, projectId: { type: "string" } }, required: ["projectId"] } },
  // Integrations
  { name: "list_integrations", description: "List all integrations.", inputSchema: { type: "object", properties: { orgId: { type: "string" } } } },
  // Reports
  { name: "get_issues_report", description: "Get issues report for an organization.", inputSchema: { type: "object", properties: { orgId: { type: "string" }, startDate: { type: "string" }, endDate: { type: "string" } } } },
  // Audit Logs
  { name: "get_audit_logs", description: "Get audit logs.", inputSchema: { type: "object", properties: { orgId: { type: "string" }, from: { type: "string" }, to: { type: "string" }, size: { type: "number" } } } },
];

async function listOrgs(): Promise<any> {
  const result = await snykRequest("GET", "/v1/orgs");
  return { orgs: result.orgs };
}

async function getOrg(params: { orgId: string }): Promise<any> {
  return snykRequest("GET", `/v1/org/${params.orgId}`);
}

async function listProjects(params: { orgId?: string }): Promise<any> {
  const orgId = params.orgId || config.orgId;
  const result = await snykRequest("GET", `/v1/org/${orgId}/projects`);
  return { projects: result.projects?.map((p: any) => ({ id: p.id, name: p.name, type: p.type, origin: p.origin, issueCountsBySeverity: p.issueCountsBySeverity })) };
}

async function getProject(params: { orgId?: string; projectId: string }): Promise<any> {
  const orgId = params.orgId || config.orgId;
  return snykRequest("GET", `/v1/org/${orgId}/project/${params.projectId}`);
}

async function deleteProject(params: { orgId?: string; projectId: string }): Promise<any> {
  const orgId = params.orgId || config.orgId;
  await snykRequest("DELETE", `/v1/org/${orgId}/project/${params.projectId}`);
  return { deleted: true, projectId: params.projectId };
}

async function listIssues(params: { orgId?: string; projectId: string }): Promise<any> {
  const orgId = params.orgId || config.orgId;
  const result = await snykRequest("POST", `/v1/org/${orgId}/project/${params.projectId}/aggregated-issues`, {});
  return { issues: result.issues?.map((i: any) => ({ id: i.id, issueType: i.issueType, pkgName: i.pkgName, pkgVersion: i.pkgVersions, severity: i.issueData?.severity, title: i.issueData?.title })) };
}

async function getIssue(params: { orgId?: string; issueId: string }): Promise<any> {
  const orgId = params.orgId || config.orgId;
  return snykRequest("GET", `/v1/org/${orgId}/issue/${params.issueId}`);
}

async function testNpm(params: { packageName: string; version?: string; orgId?: string }): Promise<any> {
  const orgId = params.orgId || config.orgId;
  const pkg = params.version ? `${params.packageName}@${params.version}` : params.packageName;
  const result = await snykRequest("GET", `/v1/test/npm/${encodeURIComponent(pkg)}?org=${orgId}`);
  return { ok: result.ok, vulnerabilities: result.issues?.vulnerabilities?.length || 0, issues: result.issues };
}

async function testPip(params: { packageName: string; version?: string; orgId?: string }): Promise<any> {
  const orgId = params.orgId || config.orgId;
  const pkg = params.version ? `${params.packageName}/${params.version}` : params.packageName;
  const result = await snykRequest("GET", `/v1/test/pip/${encodeURIComponent(pkg)}?org=${orgId}`);
  return { ok: result.ok, vulnerabilities: result.issues?.vulnerabilities?.length || 0, issues: result.issues };
}

async function testMaven(params: { groupId: string; artifactId: string; version: string; orgId?: string }): Promise<any> {
  const orgId = params.orgId || config.orgId;
  const result = await snykRequest("GET", `/v1/test/maven/${encodeURIComponent(params.groupId)}/${encodeURIComponent(params.artifactId)}/${encodeURIComponent(params.version)}?org=${orgId}`);
  return { ok: result.ok, vulnerabilities: result.issues?.vulnerabilities?.length || 0, issues: result.issues };
}

async function testRubygems(params: { gemName: string; version?: string; orgId?: string }): Promise<any> {
  const orgId = params.orgId || config.orgId;
  const gem = params.version ? `${params.gemName}/${params.version}` : params.gemName;
  const result = await snykRequest("GET", `/v1/test/rubygems/${encodeURIComponent(gem)}?org=${orgId}`);
  return { ok: result.ok, vulnerabilities: result.issues?.vulnerabilities?.length || 0, issues: result.issues };
}

async function testSbt(params: { groupId: string; artifactId: string; version: string; orgId?: string }): Promise<any> {
  const orgId = params.orgId || config.orgId;
  const result = await snykRequest("GET", `/v1/test/sbt/${encodeURIComponent(params.groupId)}/${encodeURIComponent(params.artifactId)}/${encodeURIComponent(params.version)}?org=${orgId}`);
  return { ok: result.ok, vulnerabilities: result.issues?.vulnerabilities?.length || 0, issues: result.issues };
}

async function listDependencies(params: { orgId?: string; projectId: string }): Promise<any> {
  const orgId = params.orgId || config.orgId;
  const result = await snykRequest("GET", `/v1/org/${orgId}/project/${params.projectId}/dep-graph`);
  return result;
}

async function listIgnores(params: { orgId?: string; projectId: string }): Promise<any> {
  const orgId = params.orgId || config.orgId;
  const result = await snykRequest("GET", `/v1/org/${orgId}/project/${params.projectId}/ignores`);
  return result;
}

async function addIgnore(params: { orgId?: string; projectId: string; issueId: string; reason?: string; expires?: string }): Promise<any> {
  const orgId = params.orgId || config.orgId;
  const result = await snykRequest("POST", `/v1/org/${orgId}/project/${params.projectId}/ignore/${params.issueId}`, {
    reason: params.reason || "Ignored via API",
    expires: params.expires,
  });
  return result;
}

async function listLicenses(params: { orgId?: string; projectId: string }): Promise<any> {
  const orgId = params.orgId || config.orgId;
  const result = await snykRequest("GET", `/v1/org/${orgId}/project/${params.projectId}/licenses`);
  return result;
}

async function listIntegrations(params: { orgId?: string }): Promise<any> {
  const orgId = params.orgId || config.orgId;
  const result = await snykRequest("GET", `/v1/org/${orgId}/integrations`);
  return result;
}

async function getIssuesReport(params: { orgId?: string; startDate?: string; endDate?: string }): Promise<any> {
  const orgId = params.orgId || config.orgId;
  const query = new URLSearchParams();
  if (params.startDate) query.set("from", params.startDate);
  if (params.endDate) query.set("to", params.endDate);
  const result = await snykRequest("GET", `/v1/org/${orgId}/issues?${query.toString()}`);
  return result;
}

async function getAuditLogs(params: { orgId?: string; from?: string; to?: string; size?: number }): Promise<any> {
  const orgId = params.orgId || config.orgId;
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.size) query.set("size", params.size.toString());
  const result = await snykRequest("GET", `/v1/org/${orgId}/audit?${query.toString()}`);
  return result;
}

const server = new Server({ name: "snyk-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "list_orgs": result = await listOrgs(); break;
      case "get_org": result = await getOrg(args as any); break;
      case "list_projects": result = await listProjects(args as any); break;
      case "get_project": result = await getProject(args as any); break;
      case "delete_project": result = await deleteProject(args as any); break;
      case "list_issues": result = await listIssues(args as any); break;
      case "get_issue": result = await getIssue(args as any); break;
      case "test_npm": result = await testNpm(args as any); break;
      case "test_pip": result = await testPip(args as any); break;
      case "test_maven": result = await testMaven(args as any); break;
      case "test_rubygems": result = await testRubygems(args as any); break;
      case "test_sbt": result = await testSbt(args as any); break;
      case "list_dependencies": result = await listDependencies(args as any); break;
      case "list_ignores": result = await listIgnores(args as any); break;
      case "add_ignore": result = await addIgnore(args as any); break;
      case "list_licenses": result = await listLicenses(args as any); break;
      case "list_integrations": result = await listIntegrations(args as any); break;
      case "get_issues_report": result = await getIssuesReport(args as any); break;
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
  console.error("Snyk MCP Server running on stdio");
}

main().catch(console.error);
