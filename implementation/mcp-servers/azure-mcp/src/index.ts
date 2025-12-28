/**
 * Azure MCP Server - Microsoft Azure integration for KOSMOS
 * Provides access to core Azure services
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || "",
  tenantId: process.env.AZURE_TENANT_ID || "",
  clientId: process.env.AZURE_CLIENT_ID || "",
  clientSecret: process.env.AZURE_CLIENT_SECRET || "",
  managementUrl: "https://management.azure.com",
};

let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const res = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: "https://management.azure.com/.default",
    }),
  });

  if (!res.ok) throw new Error("Azure authentication failed");

  const data = await res.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken!;
}

async function azureRequest(method: string, path: string, body?: any): Promise<any> {
  const token = await getAccessToken();
  const url = path.startsWith("http") ? path : `${config.managementUrl}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error.error?.message || res.statusText);
  }

  return res.status === 204 ? {} : res.json();
}

const TOOLS: Tool[] = [
  // Resource Groups
  { name: "list_resource_groups", description: "List all resource groups.", inputSchema: { type: "object", properties: {} } },
  { name: "get_resource_group", description: "Get resource group details.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" } }, required: ["resourceGroupName"] } },
  // Virtual Machines
  { name: "list_vms", description: "List virtual machines.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" } } } },
  { name: "get_vm", description: "Get VM details.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" }, vmName: { type: "string" } }, required: ["resourceGroupName", "vmName"] } },
  { name: "start_vm", description: "Start a virtual machine.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" }, vmName: { type: "string" } }, required: ["resourceGroupName", "vmName"] } },
  { name: "stop_vm", description: "Stop a virtual machine.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" }, vmName: { type: "string" } }, required: ["resourceGroupName", "vmName"] } },
  { name: "restart_vm", description: "Restart a virtual machine.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" }, vmName: { type: "string" } }, required: ["resourceGroupName", "vmName"] } },
  // Storage Accounts
  { name: "list_storage_accounts", description: "List storage accounts.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" } } } },
  { name: "get_storage_account", description: "Get storage account details.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" }, accountName: { type: "string" } }, required: ["resourceGroupName", "accountName"] } },
  { name: "list_containers", description: "List blob containers.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" }, accountName: { type: "string" } }, required: ["resourceGroupName", "accountName"] } },
  // App Services
  { name: "list_web_apps", description: "List web apps.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" } } } },
  { name: "get_web_app", description: "Get web app details.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" }, appName: { type: "string" } }, required: ["resourceGroupName", "appName"] } },
  { name: "restart_web_app", description: "Restart a web app.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" }, appName: { type: "string" } }, required: ["resourceGroupName", "appName"] } },
  // Azure Functions
  { name: "list_function_apps", description: "List function apps.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" } } } },
  { name: "get_function_app", description: "Get function app details.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" }, appName: { type: "string" } }, required: ["resourceGroupName", "appName"] } },
  // SQL Databases
  { name: "list_sql_servers", description: "List SQL servers.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" } } } },
  { name: "list_sql_databases", description: "List SQL databases.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" }, serverName: { type: "string" } }, required: ["resourceGroupName", "serverName"] } },
  // Virtual Networks
  { name: "list_virtual_networks", description: "List virtual networks.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" } } } },
  { name: "get_virtual_network", description: "Get virtual network details.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" }, vnetName: { type: "string" } }, required: ["resourceGroupName", "vnetName"] } },
  // Key Vault
  { name: "list_key_vaults", description: "List key vaults.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" } } } },
  { name: "get_key_vault", description: "Get key vault details.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" }, vaultName: { type: "string" } }, required: ["resourceGroupName", "vaultName"] } },
  // Container Registry
  { name: "list_container_registries", description: "List container registries.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" } } } },
  // AKS
  { name: "list_aks_clusters", description: "List AKS clusters.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" } } } },
  { name: "get_aks_cluster", description: "Get AKS cluster details.", inputSchema: { type: "object", properties: { resourceGroupName: { type: "string" }, clusterName: { type: "string" } }, required: ["resourceGroupName", "clusterName"] } },
  // Resource Operations
  { name: "list_resources", description: "List all resources in subscription.", inputSchema: { type: "object", properties: { filter: { type: "string" }, top: { type: "number" } } } },
  { name: "get_resource_by_id", description: "Get resource by ID.", inputSchema: { type: "object", properties: { resourceId: { type: "string" }, apiVersion: { type: "string" } }, required: ["resourceId", "apiVersion"] } },
];

const apiVersion = "2023-07-01";

async function listResourceGroups(): Promise<any> {
  const result = await azureRequest("GET", `/subscriptions/${config.subscriptionId}/resourcegroups?api-version=${apiVersion}`);
  return { resourceGroups: result.value?.map((rg: any) => ({ name: rg.name, location: rg.location, provisioningState: rg.properties?.provisioningState })) };
}

async function getResourceGroup(params: { resourceGroupName: string }): Promise<any> {
  return azureRequest("GET", `/subscriptions/${config.subscriptionId}/resourcegroups/${params.resourceGroupName}?api-version=${apiVersion}`);
}

async function listVMs(params: { resourceGroupName?: string }): Promise<any> {
  const path = params.resourceGroupName
    ? `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.Compute/virtualMachines?api-version=2023-07-01`
    : `/subscriptions/${config.subscriptionId}/providers/Microsoft.Compute/virtualMachines?api-version=2023-07-01`;
  const result = await azureRequest("GET", path);
  return { vms: result.value?.map((vm: any) => ({ name: vm.name, location: vm.location, vmSize: vm.properties?.hardwareProfile?.vmSize, provisioningState: vm.properties?.provisioningState })) };
}

async function getVM(params: { resourceGroupName: string; vmName: string }): Promise<any> {
  return azureRequest("GET", `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.Compute/virtualMachines/${params.vmName}?api-version=2023-07-01`);
}

async function startVM(params: { resourceGroupName: string; vmName: string }): Promise<any> {
  await azureRequest("POST", `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.Compute/virtualMachines/${params.vmName}/start?api-version=2023-07-01`);
  return { status: "starting", vmName: params.vmName };
}

async function stopVM(params: { resourceGroupName: string; vmName: string }): Promise<any> {
  await azureRequest("POST", `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.Compute/virtualMachines/${params.vmName}/deallocate?api-version=2023-07-01`);
  return { status: "stopping", vmName: params.vmName };
}

async function restartVM(params: { resourceGroupName: string; vmName: string }): Promise<any> {
  await azureRequest("POST", `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.Compute/virtualMachines/${params.vmName}/restart?api-version=2023-07-01`);
  return { status: "restarting", vmName: params.vmName };
}

async function listStorageAccounts(params: { resourceGroupName?: string }): Promise<any> {
  const path = params.resourceGroupName
    ? `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.Storage/storageAccounts?api-version=2023-01-01`
    : `/subscriptions/${config.subscriptionId}/providers/Microsoft.Storage/storageAccounts?api-version=2023-01-01`;
  const result = await azureRequest("GET", path);
  return { storageAccounts: result.value?.map((sa: any) => ({ name: sa.name, location: sa.location, kind: sa.kind, sku: sa.sku?.name })) };
}

async function getStorageAccount(params: { resourceGroupName: string; accountName: string }): Promise<any> {
  return azureRequest("GET", `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.Storage/storageAccounts/${params.accountName}?api-version=2023-01-01`);
}

async function listContainers(params: { resourceGroupName: string; accountName: string }): Promise<any> {
  const result = await azureRequest("GET", `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.Storage/storageAccounts/${params.accountName}/blobServices/default/containers?api-version=2023-01-01`);
  return { containers: result.value?.map((c: any) => ({ name: c.name, publicAccess: c.properties?.publicAccess })) };
}

async function listWebApps(params: { resourceGroupName?: string }): Promise<any> {
  const path = params.resourceGroupName
    ? `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.Web/sites?api-version=2022-09-01`
    : `/subscriptions/${config.subscriptionId}/providers/Microsoft.Web/sites?api-version=2022-09-01`;
  const result = await azureRequest("GET", path);
  return { webApps: result.value?.map((app: any) => ({ name: app.name, location: app.location, state: app.properties?.state, defaultHostName: app.properties?.defaultHostName })) };
}

async function getWebApp(params: { resourceGroupName: string; appName: string }): Promise<any> {
  return azureRequest("GET", `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.Web/sites/${params.appName}?api-version=2022-09-01`);
}

async function restartWebApp(params: { resourceGroupName: string; appName: string }): Promise<any> {
  await azureRequest("POST", `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.Web/sites/${params.appName}/restart?api-version=2022-09-01`);
  return { status: "restarting", appName: params.appName };
}

async function listFunctionApps(params: { resourceGroupName?: string }): Promise<any> {
  const path = params.resourceGroupName
    ? `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.Web/sites?api-version=2022-09-01`
    : `/subscriptions/${config.subscriptionId}/providers/Microsoft.Web/sites?api-version=2022-09-01`;
  const result = await azureRequest("GET", path);
  const functions = result.value?.filter((app: any) => app.kind?.includes("functionapp"));
  return { functionApps: functions?.map((app: any) => ({ name: app.name, location: app.location, state: app.properties?.state })) };
}

async function getFunctionApp(params: { resourceGroupName: string; appName: string }): Promise<any> {
  return azureRequest("GET", `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.Web/sites/${params.appName}?api-version=2022-09-01`);
}

async function listSqlServers(params: { resourceGroupName?: string }): Promise<any> {
  const path = params.resourceGroupName
    ? `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.Sql/servers?api-version=2023-02-01-preview`
    : `/subscriptions/${config.subscriptionId}/providers/Microsoft.Sql/servers?api-version=2023-02-01-preview`;
  const result = await azureRequest("GET", path);
  return { sqlServers: result.value?.map((s: any) => ({ name: s.name, location: s.location, fullyQualifiedDomainName: s.properties?.fullyQualifiedDomainName })) };
}

async function listSqlDatabases(params: { resourceGroupName: string; serverName: string }): Promise<any> {
  const result = await azureRequest("GET", `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.Sql/servers/${params.serverName}/databases?api-version=2023-02-01-preview`);
  return { databases: result.value?.map((db: any) => ({ name: db.name, status: db.properties?.status, maxSizeBytes: db.properties?.maxSizeBytes })) };
}

async function listVirtualNetworks(params: { resourceGroupName?: string }): Promise<any> {
  const path = params.resourceGroupName
    ? `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.Network/virtualNetworks?api-version=2023-05-01`
    : `/subscriptions/${config.subscriptionId}/providers/Microsoft.Network/virtualNetworks?api-version=2023-05-01`;
  const result = await azureRequest("GET", path);
  return { virtualNetworks: result.value?.map((vnet: any) => ({ name: vnet.name, location: vnet.location, addressSpace: vnet.properties?.addressSpace?.addressPrefixes })) };
}

async function getVirtualNetwork(params: { resourceGroupName: string; vnetName: string }): Promise<any> {
  return azureRequest("GET", `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.Network/virtualNetworks/${params.vnetName}?api-version=2023-05-01`);
}

async function listKeyVaults(params: { resourceGroupName?: string }): Promise<any> {
  const path = params.resourceGroupName
    ? `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.KeyVault/vaults?api-version=2023-02-01`
    : `/subscriptions/${config.subscriptionId}/providers/Microsoft.KeyVault/vaults?api-version=2023-02-01`;
  const result = await azureRequest("GET", path);
  return { keyVaults: result.value?.map((kv: any) => ({ name: kv.name, location: kv.location, vaultUri: kv.properties?.vaultUri })) };
}

async function getKeyVault(params: { resourceGroupName: string; vaultName: string }): Promise<any> {
  return azureRequest("GET", `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.KeyVault/vaults/${params.vaultName}?api-version=2023-02-01`);
}

async function listContainerRegistries(params: { resourceGroupName?: string }): Promise<any> {
  const path = params.resourceGroupName
    ? `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.ContainerRegistry/registries?api-version=2023-07-01`
    : `/subscriptions/${config.subscriptionId}/providers/Microsoft.ContainerRegistry/registries?api-version=2023-07-01`;
  const result = await azureRequest("GET", path);
  return { registries: result.value?.map((r: any) => ({ name: r.name, location: r.location, loginServer: r.properties?.loginServer })) };
}

async function listAksClusters(params: { resourceGroupName?: string }): Promise<any> {
  const path = params.resourceGroupName
    ? `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.ContainerService/managedClusters?api-version=2023-08-01`
    : `/subscriptions/${config.subscriptionId}/providers/Microsoft.ContainerService/managedClusters?api-version=2023-08-01`;
  const result = await azureRequest("GET", path);
  return { clusters: result.value?.map((c: any) => ({ name: c.name, location: c.location, kubernetesVersion: c.properties?.kubernetesVersion, provisioningState: c.properties?.provisioningState })) };
}

async function getAksCluster(params: { resourceGroupName: string; clusterName: string }): Promise<any> {
  return azureRequest("GET", `/subscriptions/${config.subscriptionId}/resourceGroups/${params.resourceGroupName}/providers/Microsoft.ContainerService/managedClusters/${params.clusterName}?api-version=2023-08-01`);
}

async function listResources(params: { filter?: string; top?: number }): Promise<any> {
  const query = new URLSearchParams();
  query.set("api-version", "2021-04-01");
  if (params.filter) query.set("$filter", params.filter);
  if (params.top) query.set("$top", params.top.toString());
  const result = await azureRequest("GET", `/subscriptions/${config.subscriptionId}/resources?${query.toString()}`);
  return { resources: result.value?.slice(0, 100).map((r: any) => ({ id: r.id, name: r.name, type: r.type, location: r.location })) };
}

async function getResourceById(params: { resourceId: string; apiVersion: string }): Promise<any> {
  return azureRequest("GET", `${params.resourceId}?api-version=${params.apiVersion}`);
}

const server = new Server({ name: "azure-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "list_resource_groups": result = await listResourceGroups(); break;
      case "get_resource_group": result = await getResourceGroup(args as any); break;
      case "list_vms": result = await listVMs(args as any); break;
      case "get_vm": result = await getVM(args as any); break;
      case "start_vm": result = await startVM(args as any); break;
      case "stop_vm": result = await stopVM(args as any); break;
      case "restart_vm": result = await restartVM(args as any); break;
      case "list_storage_accounts": result = await listStorageAccounts(args as any); break;
      case "get_storage_account": result = await getStorageAccount(args as any); break;
      case "list_containers": result = await listContainers(args as any); break;
      case "list_web_apps": result = await listWebApps(args as any); break;
      case "get_web_app": result = await getWebApp(args as any); break;
      case "restart_web_app": result = await restartWebApp(args as any); break;
      case "list_function_apps": result = await listFunctionApps(args as any); break;
      case "get_function_app": result = await getFunctionApp(args as any); break;
      case "list_sql_servers": result = await listSqlServers(args as any); break;
      case "list_sql_databases": result = await listSqlDatabases(args as any); break;
      case "list_virtual_networks": result = await listVirtualNetworks(args as any); break;
      case "get_virtual_network": result = await getVirtualNetwork(args as any); break;
      case "list_key_vaults": result = await listKeyVaults(args as any); break;
      case "get_key_vault": result = await getKeyVault(args as any); break;
      case "list_container_registries": result = await listContainerRegistries(args as any); break;
      case "list_aks_clusters": result = await listAksClusters(args as any); break;
      case "get_aks_cluster": result = await getAksCluster(args as any); break;
      case "list_resources": result = await listResources(args as any); break;
      case "get_resource_by_id": result = await getResourceById(args as any); break;
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
  console.error("Azure MCP Server running on stdio");
}

main().catch(console.error);
