/**
 * Trivy MCP Server - Vulnerability scanning for KOSMOS
 * Provides container, filesystem, and IaC security scanning
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const config = {
  trivyPath: process.env.TRIVY_PATH || "trivy",
  cacheDir: process.env.TRIVY_CACHE_DIR || "",
  timeout: parseInt(process.env.TRIVY_TIMEOUT || "300000"),
};

const TOOLS: Tool[] = [
  // Image Scanning
  {
    name: "scan_image",
    description: "Scan a container image for vulnerabilities.",
    inputSchema: {
      type: "object",
      properties: {
        image: { type: "string", description: "Image name (e.g., nginx:latest)" },
        severity: { type: "array", items: { type: "string" }, description: "CRITICAL, HIGH, MEDIUM, LOW, UNKNOWN" },
        ignoreUnfixed: { type: "boolean" },
        format: { type: "string", enum: ["table", "json", "sarif", "cyclonedx"] },
        scanners: { type: "array", items: { type: "string" }, description: "vuln, secret, config" },
      },
      required: ["image"],
    },
  },
  // Filesystem Scanning
  {
    name: "scan_filesystem",
    description: "Scan a filesystem/directory for vulnerabilities.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        severity: { type: "array", items: { type: "string" } },
        ignoreUnfixed: { type: "boolean" },
        format: { type: "string", enum: ["table", "json", "sarif"] },
        scanners: { type: "array", items: { type: "string" } },
      },
      required: ["path"],
    },
  },
  // Repository Scanning
  {
    name: "scan_repository",
    description: "Scan a git repository for vulnerabilities.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repository URL" },
        branch: { type: "string" },
        severity: { type: "array", items: { type: "string" } },
        format: { type: "string", enum: ["table", "json", "sarif"] },
      },
      required: ["repo"],
    },
  },
  // IaC Scanning
  {
    name: "scan_config",
    description: "Scan IaC files for misconfigurations.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        configTypes: { type: "array", items: { type: "string" }, description: "terraform, cloudformation, kubernetes, dockerfile" },
        severity: { type: "array", items: { type: "string" } },
        format: { type: "string", enum: ["table", "json", "sarif"] },
      },
      required: ["path"],
    },
  },
  // Kubernetes Scanning
  {
    name: "scan_kubernetes",
    description: "Scan Kubernetes cluster for vulnerabilities and misconfigurations.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string" },
        allNamespaces: { type: "boolean" },
        context: { type: "string" },
        components: { type: "array", items: { type: "string" }, description: "workload, infra" },
        severity: { type: "array", items: { type: "string" } },
        format: { type: "string", enum: ["table", "json", "sarif"] },
      },
    },
  },
  // SBOM
  {
    name: "generate_sbom",
    description: "Generate Software Bill of Materials.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Image or path to scan" },
        format: { type: "string", enum: ["cyclonedx", "spdx", "spdx-json"] },
        output: { type: "string", description: "Output file path" },
      },
      required: ["target"],
    },
  },
  {
    name: "scan_sbom",
    description: "Scan an existing SBOM for vulnerabilities.",
    inputSchema: {
      type: "object",
      properties: {
        sbomPath: { type: "string" },
        severity: { type: "array", items: { type: "string" } },
        format: { type: "string", enum: ["table", "json"] },
      },
      required: ["sbomPath"],
    },
  },
  // Secret Scanning
  {
    name: "scan_secrets",
    description: "Scan for exposed secrets and credentials.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Image or path to scan" },
        format: { type: "string", enum: ["table", "json"] },
      },
      required: ["target"],
    },
  },
  // License Scanning
  {
    name: "scan_licenses",
    description: "Scan for license information and violations.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string" },
        format: { type: "string", enum: ["table", "json"] },
        ignoredLicenses: { type: "array", items: { type: "string" } },
      },
      required: ["target"],
    },
  },
  // Database
  {
    name: "update_database",
    description: "Update Trivy vulnerability database.",
    inputSchema: {
      type: "object",
      properties: {
        downloadOnly: { type: "boolean" },
      },
    },
  },
  {
    name: "database_info",
    description: "Get vulnerability database information.",
    inputSchema: { type: "object", properties: {} },
  },
  // Utilities
  {
    name: "version",
    description: "Get Trivy version information.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "clean_cache",
    description: "Clean Trivy cache.",
    inputSchema: {
      type: "object",
      properties: {
        all: { type: "boolean" },
      },
    },
  },
];

async function runTrivy(args: string[]): Promise<any> {
  const cmd = `${config.trivyPath} ${args.join(" ")}`;
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: config.timeout });
    return { stdout, stderr, success: true };
  } catch (error: any) {
    return { error: error.message, stdout: error.stdout, stderr: error.stderr, success: false };
  }
}

async function scanImage(params: {
  image: string;
  severity?: string[];
  ignoreUnfixed?: boolean;
  format?: string;
  scanners?: string[];
}): Promise<any> {
  const args = ["image"];
  if (params.format === "json") args.push("-f", "json");
  if (params.severity?.length) args.push("--severity", params.severity.join(","));
  if (params.ignoreUnfixed) args.push("--ignore-unfixed");
  if (params.scanners?.length) args.push("--scanners", params.scanners.join(","));
  args.push(params.image);

  const result = await runTrivy(args);
  if (params.format === "json" && result.stdout) {
    try {
      return JSON.parse(result.stdout);
    } catch {
      return result;
    }
  }
  return result;
}

async function scanFilesystem(params: {
  path: string;
  severity?: string[];
  ignoreUnfixed?: boolean;
  format?: string;
  scanners?: string[];
}): Promise<any> {
  const args = ["filesystem"];
  if (params.format === "json") args.push("-f", "json");
  if (params.severity?.length) args.push("--severity", params.severity.join(","));
  if (params.ignoreUnfixed) args.push("--ignore-unfixed");
  if (params.scanners?.length) args.push("--scanners", params.scanners.join(","));
  args.push(params.path);

  const result = await runTrivy(args);
  if (params.format === "json" && result.stdout) {
    try {
      return JSON.parse(result.stdout);
    } catch {
      return result;
    }
  }
  return result;
}

async function scanRepository(params: {
  repo: string;
  branch?: string;
  severity?: string[];
  format?: string;
}): Promise<any> {
  const args = ["repository"];
  if (params.format === "json") args.push("-f", "json");
  if (params.severity?.length) args.push("--severity", params.severity.join(","));
  if (params.branch) args.push("--branch", params.branch);
  args.push(params.repo);

  const result = await runTrivy(args);
  if (params.format === "json" && result.stdout) {
    try {
      return JSON.parse(result.stdout);
    } catch {
      return result;
    }
  }
  return result;
}

async function scanConfig(params: {
  path: string;
  configTypes?: string[];
  severity?: string[];
  format?: string;
}): Promise<any> {
  const args = ["config"];
  if (params.format === "json") args.push("-f", "json");
  if (params.severity?.length) args.push("--severity", params.severity.join(","));
  args.push(params.path);

  const result = await runTrivy(args);
  if (params.format === "json" && result.stdout) {
    try {
      return JSON.parse(result.stdout);
    } catch {
      return result;
    }
  }
  return result;
}

async function scanKubernetes(params: {
  namespace?: string;
  allNamespaces?: boolean;
  context?: string;
  components?: string[];
  severity?: string[];
  format?: string;
}): Promise<any> {
  const args = ["kubernetes"];
  if (params.format === "json") args.push("-f", "json");
  if (params.severity?.length) args.push("--severity", params.severity.join(","));
  if (params.namespace) args.push("-n", params.namespace);
  if (params.allNamespaces) args.push("-A");
  if (params.context) args.push("--context", params.context);
  if (params.components?.length) args.push("--components", params.components.join(","));
  args.push("cluster");

  const result = await runTrivy(args);
  if (params.format === "json" && result.stdout) {
    try {
      return JSON.parse(result.stdout);
    } catch {
      return result;
    }
  }
  return result;
}

async function generateSbom(params: {
  target: string;
  format?: string;
  output?: string;
}): Promise<any> {
  const args = ["sbom"];
  const format = params.format || "cyclonedx";
  args.push("-f", format);
  if (params.output) args.push("-o", params.output);
  args.push(params.target);

  return runTrivy(args);
}

async function scanSbom(params: {
  sbomPath: string;
  severity?: string[];
  format?: string;
}): Promise<any> {
  const args = ["sbom"];
  if (params.format === "json") args.push("-f", "json");
  if (params.severity?.length) args.push("--severity", params.severity.join(","));
  args.push(params.sbomPath);

  const result = await runTrivy(args);
  if (params.format === "json" && result.stdout) {
    try {
      return JSON.parse(result.stdout);
    } catch {
      return result;
    }
  }
  return result;
}

async function scanSecrets(params: { target: string; format?: string }): Promise<any> {
  const args = ["filesystem", "--scanners", "secret"];
  if (params.format === "json") args.push("-f", "json");
  args.push(params.target);

  const result = await runTrivy(args);
  if (params.format === "json" && result.stdout) {
    try {
      return JSON.parse(result.stdout);
    } catch {
      return result;
    }
  }
  return result;
}

async function scanLicenses(params: { target: string; format?: string; ignoredLicenses?: string[] }): Promise<any> {
  const args = ["filesystem", "--scanners", "license"];
  if (params.format === "json") args.push("-f", "json");
  if (params.ignoredLicenses?.length) args.push("--ignored-licenses", params.ignoredLicenses.join(","));
  args.push(params.target);

  const result = await runTrivy(args);
  if (params.format === "json" && result.stdout) {
    try {
      return JSON.parse(result.stdout);
    } catch {
      return result;
    }
  }
  return result;
}

async function updateDatabase(params: { downloadOnly?: boolean }): Promise<any> {
  const args = ["image", "--download-db-only"];
  return runTrivy(args);
}

async function databaseInfo(): Promise<any> {
  const args = ["version", "-f", "json"];
  const result = await runTrivy(args);
  if (result.stdout) {
    try {
      return JSON.parse(result.stdout);
    } catch {
      return result;
    }
  }
  return result;
}

async function getVersion(): Promise<any> {
  const args = ["version"];
  return runTrivy(args);
}

async function cleanCache(params: { all?: boolean }): Promise<any> {
  const args = ["clean"];
  if (params.all) args.push("--all");
  return runTrivy(args);
}

const server = new Server({ name: "trivy-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "scan_image": result = await scanImage(args as any); break;
      case "scan_filesystem": result = await scanFilesystem(args as any); break;
      case "scan_repository": result = await scanRepository(args as any); break;
      case "scan_config": result = await scanConfig(args as any); break;
      case "scan_kubernetes": result = await scanKubernetes(args as any); break;
      case "generate_sbom": result = await generateSbom(args as any); break;
      case "scan_sbom": result = await scanSbom(args as any); break;
      case "scan_secrets": result = await scanSecrets(args as any); break;
      case "scan_licenses": result = await scanLicenses(args as any); break;
      case "update_database": result = await updateDatabase(args as any); break;
      case "database_info": result = await databaseInfo(); break;
      case "version": result = await getVersion(); break;
      case "clean_cache": result = await cleanCache(args as any); break;
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
  console.error("Trivy MCP Server running on stdio");
}

main().catch(console.error);
