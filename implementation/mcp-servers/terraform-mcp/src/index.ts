/**
 * Terraform MCP Server - Infrastructure as Code management for KOSMOS agents
 * Executes Terraform commands via CLI wrapper
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";

const config = {
  workDir: process.env.TERRAFORM_WORK_DIR || "/tmp/terraform",
  terraformPath: process.env.TERRAFORM_PATH || "terraform",
  defaultBackend: process.env.TERRAFORM_BACKEND || "local",
};

async function runTerraform(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(config.terraformPath, args, { cwd: cwd || config.workDir, env: { ...process.env, TF_IN_AUTOMATION: "1" } });
    let stdout = "", stderr = "";
    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });
    proc.on("close", (exitCode) => { resolve({ stdout, stderr, exitCode: exitCode || 0 }); });
  });
}

const TOOLS: Tool[] = [
  // Core Commands
  { name: "init", description: "Initialize a Terraform working directory.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, backend: { type: "boolean" }, upgrade: { type: "boolean" }, reconfigure: { type: "boolean" } } } },
  { name: "plan", description: "Create an execution plan.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, vars: { type: "object" }, varFile: { type: "string" }, target: { type: "array", items: { type: "string" } }, out: { type: "string" }, destroy: { type: "boolean" } } } },
  { name: "apply", description: "Apply changes.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, planFile: { type: "string" }, vars: { type: "object" }, varFile: { type: "string" }, target: { type: "array", items: { type: "string" } }, autoApprove: { type: "boolean" } } } },
  { name: "destroy", description: "Destroy infrastructure.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, vars: { type: "object" }, varFile: { type: "string" }, target: { type: "array", items: { type: "string" } }, autoApprove: { type: "boolean" } } } },
  // State Commands
  { name: "state_list", description: "List resources in state.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, address: { type: "string" } } } },
  { name: "state_show", description: "Show a resource in state.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, address: { type: "string" } }, required: ["address"] } },
  { name: "state_mv", description: "Move an item in state.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, source: { type: "string" }, destination: { type: "string" } }, required: ["source", "destination"] } },
  { name: "state_rm", description: "Remove an item from state.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, address: { type: "string" } }, required: ["address"] } },
  { name: "state_pull", description: "Pull current state.", inputSchema: { type: "object", properties: { workDir: { type: "string" } } } },
  { name: "state_push", description: "Push state to remote.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, stateFile: { type: "string" } }, required: ["stateFile"] } },
  // Import/Taint
  { name: "import", description: "Import existing infrastructure.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, address: { type: "string" }, id: { type: "string" }, vars: { type: "object" } }, required: ["address", "id"] } },
  { name: "taint", description: "Mark a resource for recreation.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, address: { type: "string" } }, required: ["address"] } },
  { name: "untaint", description: "Remove taint from a resource.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, address: { type: "string" } }, required: ["address"] } },
  // Workspace Commands
  { name: "workspace_list", description: "List workspaces.", inputSchema: { type: "object", properties: { workDir: { type: "string" } } } },
  { name: "workspace_new", description: "Create a new workspace.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, name: { type: "string" } }, required: ["name"] } },
  { name: "workspace_select", description: "Select a workspace.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, name: { type: "string" } }, required: ["name"] } },
  { name: "workspace_delete", description: "Delete a workspace.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, name: { type: "string" }, force: { type: "boolean" } }, required: ["name"] } },
  // Info Commands
  { name: "output", description: "Read output values.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, name: { type: "string" }, json: { type: "boolean" } } } },
  { name: "show", description: "Show current state or plan.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, planFile: { type: "string" }, json: { type: "boolean" } } } },
  { name: "validate", description: "Validate configuration.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, json: { type: "boolean" } } } },
  { name: "fmt", description: "Format configuration files.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, check: { type: "boolean" }, diff: { type: "boolean" }, recursive: { type: "boolean" } } } },
  { name: "providers", description: "List providers.", inputSchema: { type: "object", properties: { workDir: { type: "string" } } } },
  { name: "version", description: "Show Terraform version.", inputSchema: { type: "object", properties: {} } },
  // Graph
  { name: "graph", description: "Generate dependency graph.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, type: { type: "string", enum: ["plan", "plan-destroy", "apply", "validate", "input", "refresh"] } } } },
  // Refresh
  { name: "refresh", description: "Refresh state.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, vars: { type: "object" }, varFile: { type: "string" } } } },
  // Config file operations
  { name: "write_config", description: "Write Terraform configuration.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, filename: { type: "string" }, content: { type: "string" } }, required: ["filename", "content"] } },
  { name: "read_config", description: "Read Terraform configuration.", inputSchema: { type: "object", properties: { workDir: { type: "string" }, filename: { type: "string" } }, required: ["filename"] } },
];

function buildVarArgs(vars?: Record<string, any>): string[] {
  if (!vars) return [];
  return Object.entries(vars).flatMap(([k, v]) => ["-var", `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`]);
}

async function init(params: { workDir?: string; backend?: boolean; upgrade?: boolean; reconfigure?: boolean }): Promise<any> {
  const args = ["init", "-input=false"];
  if (params.backend === false) args.push("-backend=false");
  if (params.upgrade) args.push("-upgrade");
  if (params.reconfigure) args.push("-reconfigure");
  const result = await runTerraform(args, params.workDir);
  return { success: result.exitCode === 0, output: result.stdout, error: result.stderr };
}

async function plan(params: { workDir?: string; vars?: any; varFile?: string; target?: string[]; out?: string; destroy?: boolean }): Promise<any> {
  const args = ["plan", "-input=false", ...buildVarArgs(params.vars)];
  if (params.varFile) args.push(`-var-file=${params.varFile}`);
  if (params.target) params.target.forEach(t => args.push(`-target=${t}`));
  if (params.out) args.push(`-out=${params.out}`);
  if (params.destroy) args.push("-destroy");
  const result = await runTerraform(args, params.workDir);
  return { success: result.exitCode === 0, output: result.stdout, error: result.stderr };
}

async function apply(params: { workDir?: string; planFile?: string; vars?: any; varFile?: string; target?: string[]; autoApprove?: boolean }): Promise<any> {
  const args = ["apply", "-input=false", ...buildVarArgs(params.vars)];
  if (params.autoApprove) args.push("-auto-approve");
  if (params.varFile) args.push(`-var-file=${params.varFile}`);
  if (params.target) params.target.forEach(t => args.push(`-target=${t}`));
  if (params.planFile) args.push(params.planFile);
  const result = await runTerraform(args, params.workDir);
  return { success: result.exitCode === 0, output: result.stdout, error: result.stderr };
}

async function destroy(params: { workDir?: string; vars?: any; varFile?: string; target?: string[]; autoApprove?: boolean }): Promise<any> {
  const args = ["destroy", "-input=false", ...buildVarArgs(params.vars)];
  if (params.autoApprove) args.push("-auto-approve");
  if (params.varFile) args.push(`-var-file=${params.varFile}`);
  if (params.target) params.target.forEach(t => args.push(`-target=${t}`));
  const result = await runTerraform(args, params.workDir);
  return { success: result.exitCode === 0, output: result.stdout, error: result.stderr };
}

async function stateList(params: { workDir?: string; address?: string }): Promise<any> {
  const args = ["state", "list"];
  if (params.address) args.push(params.address);
  const result = await runTerraform(args, params.workDir);
  return { resources: result.stdout.trim().split("\n").filter(Boolean), success: result.exitCode === 0 };
}

async function stateShow(params: { workDir?: string; address: string }): Promise<any> {
  const result = await runTerraform(["state", "show", params.address], params.workDir);
  return { resource: result.stdout, success: result.exitCode === 0 };
}

async function stateMv(params: { workDir?: string; source: string; destination: string }): Promise<any> {
  const result = await runTerraform(["state", "mv", params.source, params.destination], params.workDir);
  return { success: result.exitCode === 0, output: result.stdout };
}

async function stateRm(params: { workDir?: string; address: string }): Promise<any> {
  const result = await runTerraform(["state", "rm", params.address], params.workDir);
  return { success: result.exitCode === 0, output: result.stdout };
}

async function statePull(params: { workDir?: string }): Promise<any> {
  const result = await runTerraform(["state", "pull"], params.workDir);
  return { state: result.stdout, success: result.exitCode === 0 };
}

async function statePush(params: { workDir?: string; stateFile: string }): Promise<any> {
  const result = await runTerraform(["state", "push", params.stateFile], params.workDir);
  return { success: result.exitCode === 0, output: result.stdout };
}

async function importResource(params: { workDir?: string; address: string; id: string; vars?: any }): Promise<any> {
  const args = ["import", ...buildVarArgs(params.vars), params.address, params.id];
  const result = await runTerraform(args, params.workDir);
  return { success: result.exitCode === 0, output: result.stdout };
}

async function taint(params: { workDir?: string; address: string }): Promise<any> {
  const result = await runTerraform(["taint", params.address], params.workDir);
  return { success: result.exitCode === 0, output: result.stdout };
}

async function untaint(params: { workDir?: string; address: string }): Promise<any> {
  const result = await runTerraform(["untaint", params.address], params.workDir);
  return { success: result.exitCode === 0, output: result.stdout };
}

async function workspaceList(params: { workDir?: string }): Promise<any> {
  const result = await runTerraform(["workspace", "list"], params.workDir);
  const lines = result.stdout.trim().split("\n");
  const workspaces = lines.map(l => ({ name: l.replace(/^\*?\s*/, ""), current: l.startsWith("*") }));
  return { workspaces, success: result.exitCode === 0 };
}

async function workspaceNew(params: { workDir?: string; name: string }): Promise<any> {
  const result = await runTerraform(["workspace", "new", params.name], params.workDir);
  return { success: result.exitCode === 0, name: params.name };
}

async function workspaceSelect(params: { workDir?: string; name: string }): Promise<any> {
  const result = await runTerraform(["workspace", "select", params.name], params.workDir);
  return { success: result.exitCode === 0, name: params.name };
}

async function workspaceDelete(params: { workDir?: string; name: string; force?: boolean }): Promise<any> {
  const args = ["workspace", "delete"];
  if (params.force) args.push("-force");
  args.push(params.name);
  const result = await runTerraform(args, params.workDir);
  return { success: result.exitCode === 0, name: params.name };
}

async function output(params: { workDir?: string; name?: string; json?: boolean }): Promise<any> {
  const args = ["output"];
  if (params.json) args.push("-json");
  if (params.name) args.push(params.name);
  const result = await runTerraform(args, params.workDir);
  if (params.json && result.exitCode === 0) {
    try { return { outputs: JSON.parse(result.stdout) }; } catch {}
  }
  return { output: result.stdout, success: result.exitCode === 0 };
}

async function show(params: { workDir?: string; planFile?: string; json?: boolean }): Promise<any> {
  const args = ["show"];
  if (params.json) args.push("-json");
  if (params.planFile) args.push(params.planFile);
  const result = await runTerraform(args, params.workDir);
  return { output: result.stdout, success: result.exitCode === 0 };
}

async function validate(params: { workDir?: string; json?: boolean }): Promise<any> {
  const args = ["validate"];
  if (params.json) args.push("-json");
  const result = await runTerraform(args, params.workDir);
  if (params.json && result.exitCode === 0) {
    try { return JSON.parse(result.stdout); } catch {}
  }
  return { valid: result.exitCode === 0, output: result.stdout };
}

async function fmt(params: { workDir?: string; check?: boolean; diff?: boolean; recursive?: boolean }): Promise<any> {
  const args = ["fmt"];
  if (params.check) args.push("-check");
  if (params.diff) args.push("-diff");
  if (params.recursive) args.push("-recursive");
  const result = await runTerraform(args, params.workDir);
  return { success: result.exitCode === 0, output: result.stdout, needsFormatting: result.exitCode === 3 };
}

async function providers(params: { workDir?: string }): Promise<any> {
  const result = await runTerraform(["providers"], params.workDir);
  return { providers: result.stdout, success: result.exitCode === 0 };
}

async function version(): Promise<any> {
  const result = await runTerraform(["version", "-json"]);
  try { return JSON.parse(result.stdout); } catch { return { version: result.stdout }; }
}

async function graph(params: { workDir?: string; type?: string }): Promise<any> {
  const args = ["graph"];
  if (params.type) args.push(`-type=${params.type}`);
  const result = await runTerraform(args, params.workDir);
  return { graph: result.stdout, success: result.exitCode === 0 };
}

async function refresh(params: { workDir?: string; vars?: any; varFile?: string }): Promise<any> {
  const args = ["refresh", "-input=false", ...buildVarArgs(params.vars)];
  if (params.varFile) args.push(`-var-file=${params.varFile}`);
  const result = await runTerraform(args, params.workDir);
  return { success: result.exitCode === 0, output: result.stdout };
}

async function writeConfig(params: { workDir?: string; filename: string; content: string }): Promise<any> {
  const dir = params.workDir || config.workDir;
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, params.filename);
  await fs.writeFile(filePath, params.content);
  return { written: filePath };
}

async function readConfig(params: { workDir?: string; filename: string }): Promise<any> {
  const dir = params.workDir || config.workDir;
  const filePath = path.join(dir, params.filename);
  const content = await fs.readFile(filePath, "utf-8");
  return { content, path: filePath };
}

const server = new Server({ name: "terraform-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "init": result = await init(args as any); break;
      case "plan": result = await plan(args as any); break;
      case "apply": result = await apply(args as any); break;
      case "destroy": result = await destroy(args as any); break;
      case "state_list": result = await stateList(args as any); break;
      case "state_show": result = await stateShow(args as any); break;
      case "state_mv": result = await stateMv(args as any); break;
      case "state_rm": result = await stateRm(args as any); break;
      case "state_pull": result = await statePull(args as any); break;
      case "state_push": result = await statePush(args as any); break;
      case "import": result = await importResource(args as any); break;
      case "taint": result = await taint(args as any); break;
      case "untaint": result = await untaint(args as any); break;
      case "workspace_list": result = await workspaceList(args as any); break;
      case "workspace_new": result = await workspaceNew(args as any); break;
      case "workspace_select": result = await workspaceSelect(args as any); break;
      case "workspace_delete": result = await workspaceDelete(args as any); break;
      case "output": result = await output(args as any); break;
      case "show": result = await show(args as any); break;
      case "validate": result = await validate(args as any); break;
      case "fmt": result = await fmt(args as any); break;
      case "providers": result = await providers(args as any); break;
      case "version": result = await version(); break;
      case "graph": result = await graph(args as any); break;
      case "refresh": result = await refresh(args as any); break;
      case "write_config": result = await writeConfig(args as any); break;
      case "read_config": result = await readConfig(args as any); break;
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
  console.error("Terraform MCP Server running on stdio");
}

main().catch(console.error);
