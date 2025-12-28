/**
 * CrowdStrike Falcon MCP Server
 *
 * Comprehensive endpoint security integration for KOSMOS agents including:
 * - Detections: list, get, update threat detections
 * - Hosts: list, get, contain, lift containment
 * - Incidents: list, get, update security incidents
 * - IOCs: list, create, delete indicators of compromise
 * - RTR: Run Real Time Response commands
 * - Vulnerabilities: get vulnerability assessments
 * - Prevention Policies: list policies
 * - Threat Intelligence: get threat intel
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

// Environment configuration
const config = {
  clientId: process.env.CROWDSTRIKE_CLIENT_ID || "",
  clientSecret: process.env.CROWDSTRIKE_CLIENT_SECRET || "",
  baseUrl: process.env.CROWDSTRIKE_BASE_URL || "https://api.crowdstrike.com",
};

// OAuth2 Token Management
interface TokenData {
  accessToken: string;
  expiresAt: number;
}

let tokenData: TokenData | null = null;

async function getAccessToken(): Promise<string> {
  // Check if we have a valid token
  if (tokenData && tokenData.expiresAt > Date.now() + 60000) {
    return tokenData.accessToken;
  }

  // Request new token
  const res = await fetch(`${config.baseUrl}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ errors: [{ message: res.statusText }] }));
    throw new Error(`OAuth2 token error: ${error.errors?.[0]?.message || res.statusText}`);
  }

  const data = await res.json();
  tokenData = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return tokenData.accessToken;
}

// Helper function for CrowdStrike API requests
async function crowdstrikeRequest(method: string, path: string, body?: any, params?: Record<string, string | string[]>): Promise<any> {
  const token = await getAccessToken();
  const url = new URL(`${config.baseUrl}${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((v) => url.searchParams.append(key, v));
        } else if (value !== "") {
          url.searchParams.append(key, value);
        }
      }
    });
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ errors: [{ message: res.statusText }] }));
    throw new Error(error.errors?.[0]?.message || error.message || res.statusText);
  }

  return res.status === 204 ? {} : res.json();
}

// ============================================================================
// TOOLS DEFINITION
// ============================================================================

const TOOLS: Tool[] = [
  // ========== Detections ==========
  {
    name: "list_detections",
    description: "List threat detections with optional filtering by severity, status, or date range. Returns detection IDs that can be used to get full details.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "FQL filter expression (e.g., 'status:new+severity:4')" },
        query: { type: "string", description: "Free text search query" },
        sort: { type: "string", description: "Sort field and direction (e.g., 'last_behavior|desc')" },
        limit: { type: "number", description: "Maximum number of results (default 100, max 9999)" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "get_detection",
    description: "Get detailed information about specific detections by their IDs",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "Detection IDs to retrieve" },
      },
      required: ["ids"],
    },
  },
  {
    name: "update_detection",
    description: "Update detection status, assignment, or visibility",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "Detection IDs to update" },
        status: { type: "string", enum: ["new", "in_progress", "true_positive", "false_positive", "ignored", "closed", "reopened"], description: "New status" },
        assignedToUuid: { type: "string", description: "UUID of user to assign to" },
        showInUi: { type: "boolean", description: "Whether to show in UI" },
        comment: { type: "string", description: "Comment to add" },
      },
      required: ["ids"],
    },
  },

  // ========== Hosts ==========
  {
    name: "list_hosts",
    description: "List managed hosts/endpoints with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "FQL filter expression (e.g., 'platform_name:Windows')" },
        query: { type: "string", description: "Free text search query" },
        sort: { type: "string", description: "Sort field and direction (e.g., 'hostname|asc')" },
        limit: { type: "number", description: "Maximum number of results (default 100, max 5000)" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "get_host",
    description: "Get detailed information about specific hosts by their IDs",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "Host/device IDs to retrieve" },
      },
      required: ["ids"],
    },
  },
  {
    name: "contain_host",
    description: "Network contain a host to isolate it from the network while maintaining CrowdStrike connectivity",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "Host/device IDs to contain" },
      },
      required: ["ids"],
    },
  },
  {
    name: "lift_containment",
    description: "Lift network containment from a host to restore normal network access",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "Host/device IDs to release from containment" },
      },
      required: ["ids"],
    },
  },

  // ========== Incidents ==========
  {
    name: "list_incidents",
    description: "List security incidents with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "FQL filter expression (e.g., 'status:20')" },
        sort: { type: "string", description: "Sort field and direction (e.g., 'start|desc')" },
        limit: { type: "number", description: "Maximum number of results (default 100, max 500)" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "get_incident",
    description: "Get detailed information about specific incidents by their IDs",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "Incident IDs to retrieve" },
      },
      required: ["ids"],
    },
  },
  {
    name: "update_incident",
    description: "Update incident status, assignment, or add tags",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "Incident IDs to update" },
        status: { type: "number", enum: [20, 25, 30, 40], description: "New status (20=New, 25=Reopened, 30=In Progress, 40=Closed)" },
        assignedToUuid: { type: "string", description: "UUID of user to assign to" },
        addTags: { type: "array", items: { type: "string" }, description: "Tags to add" },
        removeTags: { type: "array", items: { type: "string" }, description: "Tags to remove" },
        description: { type: "string", description: "Update description/notes" },
      },
      required: ["ids"],
    },
  },

  // ========== IOCs (Indicators of Compromise) ==========
  {
    name: "list_iocs",
    description: "List custom indicators of compromise",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "FQL filter expression (e.g., 'type:sha256')" },
        sort: { type: "string", description: "Sort field and direction" },
        limit: { type: "number", description: "Maximum number of results (default 100, max 500)" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "create_ioc",
    description: "Create a new custom indicator of compromise",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["sha256", "md5", "domain", "ipv4", "ipv6"], description: "IOC type" },
        value: { type: "string", description: "IOC value (hash, domain, or IP address)" },
        action: { type: "string", enum: ["detect", "prevent", "no_action"], description: "Action to take when IOC is detected" },
        severity: { type: "string", enum: ["informational", "low", "medium", "high", "critical"], description: "Severity level" },
        description: { type: "string", description: "Description of the IOC" },
        platforms: { type: "array", items: { type: "string", enum: ["windows", "mac", "linux"] }, description: "Platforms to apply to" },
        source: { type: "string", description: "Source of the IOC" },
        expiration: { type: "string", description: "Expiration date (ISO 8601 format)" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for the IOC" },
        hostGroups: { type: "array", items: { type: "string" }, description: "Host group IDs to apply to (empty for all hosts)" },
        appliedGlobally: { type: "boolean", description: "Apply to all hosts (default true if no host groups specified)" },
      },
      required: ["type", "value", "action", "platforms"],
    },
  },
  {
    name: "delete_ioc",
    description: "Delete custom indicators of compromise",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, description: "IOC IDs to delete" },
      },
      required: ["ids"],
    },
  },

  // ========== Real Time Response (RTR) ==========
  {
    name: "run_rtr_command",
    description: "Run a Real Time Response command on a host. Use for live forensics and response actions.",
    inputSchema: {
      type: "object",
      properties: {
        hostId: { type: "string", description: "Host/device ID to run command on" },
        command: {
          type: "string",
          enum: [
            "cat", "cd", "clear", "cp", "encrypt", "env", "eventlog", "filehash", "get", "getsid",
            "help", "history", "ifconfig", "ipconfig", "kill", "ls", "map", "memdump", "mkdir",
            "mount", "mv", "netstat", "ps", "reg", "restart", "rm", "run", "runscript", "shutdown",
            "umount", "unmap", "update", "users", "xmemdump", "zip"
          ],
          description: "RTR command to execute"
        },
        arguments: { type: "string", description: "Command arguments" },
        timeout: { type: "number", description: "Command timeout in seconds (default 30, max 600)" },
      },
      required: ["hostId", "command"],
    },
  },

  // ========== Vulnerabilities ==========
  {
    name: "get_vulnerabilities",
    description: "Get vulnerability assessment for hosts",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "FQL filter expression (e.g., 'cve.severity:CRITICAL')" },
        sort: { type: "string", description: "Sort field and direction" },
        limit: { type: "number", description: "Maximum number of results (default 100, max 5000)" },
        offset: { type: "number", description: "Pagination offset" },
        facets: { type: "array", items: { type: "string" }, description: "Fields to facet on" },
      },
    },
  },

  // ========== Prevention Policies ==========
  {
    name: "list_prevention_policies",
    description: "List prevention policies configured in the environment",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "FQL filter expression" },
        sort: { type: "string", description: "Sort field and direction" },
        limit: { type: "number", description: "Maximum number of results (default 100, max 500)" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },

  // ========== Threat Intelligence ==========
  {
    name: "get_threat_intel",
    description: "Get threat intelligence information including actors, indicators, and reports",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["actors", "indicators", "reports"], description: "Type of threat intel to retrieve" },
        filter: { type: "string", description: "FQL filter expression" },
        query: { type: "string", description: "Free text search query" },
        sort: { type: "string", description: "Sort field and direction" },
        limit: { type: "number", description: "Maximum number of results (default 100, max 500)" },
        offset: { type: "number", description: "Pagination offset" },
        ids: { type: "array", items: { type: "string" }, description: "Specific IDs to retrieve (for detailed info)" },
      },
      required: ["type"],
    },
  },
];

// ============================================================================
// IMPLEMENTATION FUNCTIONS
// ============================================================================

// ========== Detections ==========
async function listDetections(params: {
  filter?: string;
  query?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.filter) queryParams.filter = params.filter;
  if (params.query) queryParams.q = params.query;
  if (params.sort) queryParams.sort = params.sort;
  if (params.limit) queryParams.limit = String(params.limit);
  if (params.offset) queryParams.offset = String(params.offset);

  const res = await crowdstrikeRequest("GET", "/detects/queries/detects/v1", undefined, queryParams);
  return {
    detectionIds: res.resources || [],
    total: res.meta?.pagination?.total || 0,
    offset: res.meta?.pagination?.offset || 0,
  };
}

async function getDetection(params: { ids: string[] }): Promise<any> {
  const res = await crowdstrikeRequest("POST", "/detects/entities/summaries/GET/v1", { ids: params.ids });
  return {
    detections: res.resources?.map((d: any) => ({
      id: d.detection_id,
      status: d.status,
      maxSeverity: d.max_severity,
      maxSeverityName: d.max_severity_displayname,
      firstBehavior: d.first_behavior,
      lastBehavior: d.last_behavior,
      hostInfo: {
        hostname: d.device?.hostname,
        deviceId: d.device?.device_id,
        platformName: d.device?.platform_name,
        osVersion: d.device?.os_version,
        externalIp: d.device?.external_ip,
        localIp: d.device?.local_ip,
        macAddress: d.device?.mac_address,
      },
      behaviors: d.behaviors?.map((b: any) => ({
        behaviorId: b.behavior_id,
        filename: b.filename,
        filepath: b.filepath,
        cmdline: b.cmdline,
        sha256: b.sha256,
        md5: b.md5,
        iocType: b.ioc_type,
        iocValue: b.ioc_value,
        tactic: b.tactic,
        technique: b.technique,
        severity: b.severity,
        confidence: b.confidence,
        description: b.description,
        timestamp: b.timestamp,
        parentDetails: b.parent_details,
      })),
      assignedTo: d.assigned_to_name,
      assignedToUuid: d.assigned_to_uuid,
      showInUi: d.show_in_ui,
      quarantinedFiles: d.quarantined_files,
    })),
  };
}

async function updateDetection(params: {
  ids: string[];
  status?: string;
  assignedToUuid?: string;
  showInUi?: boolean;
  comment?: string;
}): Promise<any> {
  const body: any = { ids: params.ids };
  if (params.status) body.status = params.status;
  if (params.assignedToUuid) body.assigned_to_uuid = params.assignedToUuid;
  if (params.showInUi !== undefined) body.show_in_ui = params.showInUi;
  if (params.comment) body.comment = params.comment;

  await crowdstrikeRequest("PATCH", "/detects/entities/detects/v2", body);
  return { updated: true, ids: params.ids };
}

// ========== Hosts ==========
async function listHosts(params: {
  filter?: string;
  query?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.filter) queryParams.filter = params.filter;
  if (params.query) queryParams.q = params.query;
  if (params.sort) queryParams.sort = params.sort;
  if (params.limit) queryParams.limit = String(params.limit);
  if (params.offset) queryParams.offset = String(params.offset);

  const res = await crowdstrikeRequest("GET", "/devices/queries/devices/v1", undefined, queryParams);
  return {
    hostIds: res.resources || [],
    total: res.meta?.pagination?.total || 0,
    offset: res.meta?.pagination?.offset || 0,
  };
}

async function getHost(params: { ids: string[] }): Promise<any> {
  const res = await crowdstrikeRequest("GET", "/devices/entities/devices/v2", undefined, { ids: params.ids });
  return {
    hosts: res.resources?.map((h: any) => ({
      deviceId: h.device_id,
      cid: h.cid,
      hostname: h.hostname,
      localIp: h.local_ip,
      externalIp: h.external_ip,
      macAddress: h.mac_address,
      platformName: h.platform_name,
      platformId: h.platform_id,
      osVersion: h.os_version,
      osBuild: h.os_build,
      kernelVersion: h.kernel_version,
      productType: h.product_type,
      productTypeDesc: h.product_type_desc,
      systemManufacturer: h.system_manufacturer,
      systemProductName: h.system_product_name,
      biosManufacturer: h.bios_manufacturer,
      biosVersion: h.bios_version,
      agentVersion: h.agent_version,
      agentLoadFlags: h.agent_load_flags,
      status: h.status,
      containmentStatus: h.containment_status,
      firstSeen: h.first_seen,
      lastSeen: h.last_seen,
      reducedFunctionalityMode: h.reduced_functionality_mode,
      policies: h.policies?.map((p: any) => ({
        policyId: p.policy_id,
        policyType: p.policy_type,
        applied: p.applied,
        settingsHash: p.settings_hash,
      })),
      groups: h.groups,
      tags: h.tags,
      ou: h.ou,
      siteName: h.site_name,
      machineUuid: h.machine_uuid,
      servicePack: h.service_pack,
    })),
  };
}

async function containHost(params: { ids: string[] }): Promise<any> {
  const body = {
    ids: params.ids,
    action_name: "contain",
  };
  const res = await crowdstrikeRequest("POST", "/devices/entities/devices-actions/v2", body, { action_name: "contain" });
  return {
    contained: true,
    ids: params.ids,
    resources: res.resources,
  };
}

async function liftContainment(params: { ids: string[] }): Promise<any> {
  const body = {
    ids: params.ids,
    action_name: "lift_containment",
  };
  const res = await crowdstrikeRequest("POST", "/devices/entities/devices-actions/v2", body, { action_name: "lift_containment" });
  return {
    containmentLifted: true,
    ids: params.ids,
    resources: res.resources,
  };
}

// ========== Incidents ==========
async function listIncidents(params: {
  filter?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.filter) queryParams.filter = params.filter;
  if (params.sort) queryParams.sort = params.sort;
  if (params.limit) queryParams.limit = String(params.limit);
  if (params.offset) queryParams.offset = String(params.offset);

  const res = await crowdstrikeRequest("GET", "/incidents/queries/incidents/v1", undefined, queryParams);
  return {
    incidentIds: res.resources || [],
    total: res.meta?.pagination?.total || 0,
    offset: res.meta?.pagination?.offset || 0,
  };
}

async function getIncident(params: { ids: string[] }): Promise<any> {
  const res = await crowdstrikeRequest("POST", "/incidents/entities/incidents/GET/v1", { ids: params.ids });
  return {
    incidents: res.resources?.map((i: any) => ({
      incidentId: i.incident_id,
      cid: i.cid,
      hostIds: i.host_ids,
      hosts: i.hosts?.map((h: any) => ({
        deviceId: h.device_id,
        hostname: h.hostname,
        platformName: h.platform_name,
        externalIp: h.external_ip,
        localIp: h.local_ip,
      })),
      users: i.users,
      state: i.state,
      status: i.status,
      tactics: i.tactics,
      techniques: i.techniques,
      objectives: i.objectives,
      fineScore: i.fine_score,
      start: i.start,
      end: i.end,
      assignedTo: i.assigned_to_name,
      assignedToUuid: i.assigned_to,
      description: i.description,
      tags: i.tags,
      created: i.created,
      modified: i.modified_timestamp,
    })),
  };
}

async function updateIncident(params: {
  ids: string[];
  status?: number;
  assignedToUuid?: string;
  addTags?: string[];
  removeTags?: string[];
  description?: string;
}): Promise<any> {
  const actionParameters: any[] = [];

  if (params.status !== undefined) {
    actionParameters.push({ name: "update_status", value: String(params.status) });
  }
  if (params.assignedToUuid) {
    actionParameters.push({ name: "update_assigned_to_v2", value: params.assignedToUuid });
  }
  if (params.addTags?.length) {
    actionParameters.push({ name: "add_tag", value: params.addTags.join(",") });
  }
  if (params.removeTags?.length) {
    actionParameters.push({ name: "delete_tag", value: params.removeTags.join(",") });
  }
  if (params.description) {
    actionParameters.push({ name: "update_description", value: params.description });
  }

  const body = {
    ids: params.ids,
    action_parameters: actionParameters,
  };

  await crowdstrikeRequest("POST", "/incidents/entities/incident-actions/v1", body);
  return { updated: true, ids: params.ids };
}

// ========== IOCs ==========
async function listIocs(params: {
  filter?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.filter) queryParams.filter = params.filter;
  if (params.sort) queryParams.sort = params.sort;
  if (params.limit) queryParams.limit = String(params.limit);
  if (params.offset) queryParams.offset = String(params.offset);

  // First get IDs
  const idsRes = await crowdstrikeRequest("GET", "/iocs/queries/indicators/v1", undefined, queryParams);
  const ids = idsRes.resources || [];

  if (ids.length === 0) {
    return { iocs: [], total: 0 };
  }

  // Then get details
  const detailsRes = await crowdstrikeRequest("GET", "/iocs/entities/indicators/v1", undefined, { ids });
  return {
    iocs: detailsRes.resources?.map((ioc: any) => ({
      id: ioc.id,
      type: ioc.type,
      value: ioc.value,
      action: ioc.action,
      severity: ioc.severity,
      description: ioc.description,
      platforms: ioc.platforms,
      source: ioc.source,
      expiration: ioc.expiration,
      tags: ioc.tags,
      hostGroups: ioc.host_groups,
      appliedGlobally: ioc.applied_globally,
      createdBy: ioc.created_by,
      createdOn: ioc.created_on,
      modifiedBy: ioc.modified_by,
      modifiedOn: ioc.modified_on,
    })),
    total: idsRes.meta?.pagination?.total || ids.length,
  };
}

async function createIoc(params: {
  type: string;
  value: string;
  action: string;
  severity?: string;
  description?: string;
  platforms: string[];
  source?: string;
  expiration?: string;
  tags?: string[];
  hostGroups?: string[];
  appliedGlobally?: boolean;
}): Promise<any> {
  const indicator: any = {
    type: params.type,
    value: params.value,
    action: params.action,
    platforms: params.platforms,
    applied_globally: params.appliedGlobally ?? (params.hostGroups?.length ? false : true),
  };

  if (params.severity) indicator.severity = params.severity;
  if (params.description) indicator.description = params.description;
  if (params.source) indicator.source = params.source;
  if (params.expiration) indicator.expiration = params.expiration;
  if (params.tags?.length) indicator.tags = params.tags;
  if (params.hostGroups?.length) indicator.host_groups = params.hostGroups;

  const res = await crowdstrikeRequest("POST", "/iocs/entities/indicators/v1", { indicators: [indicator] });
  return {
    created: true,
    iocs: res.resources?.map((ioc: any) => ({
      id: ioc.id,
      type: ioc.type,
      value: ioc.value,
      action: ioc.action,
    })),
  };
}

async function deleteIoc(params: { ids: string[] }): Promise<any> {
  await crowdstrikeRequest("DELETE", "/iocs/entities/indicators/v1", undefined, { ids: params.ids });
  return { deleted: true, ids: params.ids };
}

// ========== RTR (Real Time Response) ==========
async function runRtrCommand(params: {
  hostId: string;
  command: string;
  arguments?: string;
  timeout?: number;
}): Promise<any> {
  // First, initialize RTR session
  const sessionRes = await crowdstrikeRequest("POST", "/real-time-response/entities/sessions/v1", {
    device_id: params.hostId,
    origin: "mcp",
    queue_offline: false,
  });

  const sessionId = sessionRes.resources?.[0]?.session_id;
  if (!sessionId) {
    throw new Error("Failed to create RTR session");
  }

  try {
    // Execute command
    const commandBody: any = {
      session_id: sessionId,
      device_id: params.hostId,
      base_command: params.command,
    };
    if (params.arguments) {
      commandBody.command_string = `${params.command} ${params.arguments}`;
    } else {
      commandBody.command_string = params.command;
    }

    // Determine which endpoint to use based on command type
    let commandEndpoint = "/real-time-response/entities/command/v1";
    const adminCommands = ["put", "run", "runscript", "get", "restart", "shutdown", "memdump", "xmemdump"];
    const activeResponderCommands = ["cat", "cd", "clear", "cp", "encrypt", "env", "eventlog", "filehash", "getsid", "kill", "map", "mount", "mkdir", "mv", "reg", "rm", "umount", "unmap", "update", "zip"];

    if (adminCommands.includes(params.command)) {
      commandEndpoint = "/real-time-response/entities/admin-command/v1";
    } else if (activeResponderCommands.includes(params.command)) {
      commandEndpoint = "/real-time-response/entities/active-responder-command/v1";
    }

    const commandRes = await crowdstrikeRequest("POST", commandEndpoint, commandBody);

    const cloudRequestId = commandRes.resources?.[0]?.cloud_request_id;

    // Poll for results (with timeout)
    const timeout = (params.timeout || 30) * 1000;
    const startTime = Date.now();
    let result: any = null;

    while (Date.now() - startTime < timeout) {
      const resultRes = await crowdstrikeRequest("GET", "/real-time-response/entities/command/v1", undefined, {
        cloud_request_id: cloudRequestId,
        sequence_id: "0",
      });

      const resource = resultRes.resources?.[0];
      if (resource?.complete) {
        result = resource;
        break;
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return {
      sessionId,
      cloudRequestId,
      command: params.command,
      arguments: params.arguments,
      complete: result?.complete || false,
      stdout: result?.stdout,
      stderr: result?.stderr,
      baseCommand: result?.base_command,
      offline_queued: result?.offline_queued,
    };
  } finally {
    // Clean up session
    try {
      await crowdstrikeRequest("DELETE", "/real-time-response/entities/sessions/v1", undefined, {
        session_id: sessionId,
      });
    } catch {
      // Ignore cleanup errors
    }
  }
}

// ========== Vulnerabilities ==========
async function getVulnerabilities(params: {
  filter?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  facets?: string[];
}): Promise<any> {
  const queryParams: Record<string, string | string[]> = {};
  if (params.filter) queryParams.filter = params.filter;
  if (params.sort) queryParams.sort = params.sort;
  if (params.limit) queryParams.limit = String(params.limit);
  if (params.offset) queryParams.after = String(params.offset);
  if (params.facets?.length) queryParams.facet = params.facets;

  const res = await crowdstrikeRequest("GET", "/spotlight/combined/vulnerabilities/v1", undefined, queryParams);
  return {
    vulnerabilities: res.resources?.map((v: any) => ({
      id: v.id,
      cid: v.cid,
      aid: v.aid,
      cve: {
        id: v.cve?.id,
        severity: v.cve?.severity,
        baseScore: v.cve?.base_score,
        exploitStatus: v.cve?.exploit_status,
        exploitabilityScore: v.cve?.exploitability_score,
        impactScore: v.cve?.impact_score,
        description: v.cve?.description,
        publishedDate: v.cve?.published_date,
        vector: v.cve?.vector,
      },
      host: {
        hostname: v.host_info?.hostname,
        localIp: v.host_info?.local_ip,
        osVersion: v.host_info?.os_version,
        platformName: v.host_info?.platform_name,
        groups: v.host_info?.groups,
        tags: v.host_info?.tags,
      },
      app: {
        productNameVersion: v.app?.product_name_version,
        subType: v.app?.sub_type,
        vendor: v.app?.vendor,
      },
      status: v.status,
      createdTimestamp: v.created_timestamp,
      updatedTimestamp: v.updated_timestamp,
      remediation: v.remediation,
    })),
    total: res.meta?.pagination?.total || 0,
    facets: res.meta?.facets,
  };
}

// ========== Prevention Policies ==========
async function listPreventionPolicies(params: {
  filter?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}): Promise<any> {
  const queryParams: Record<string, string> = {};
  if (params.filter) queryParams.filter = params.filter;
  if (params.sort) queryParams.sort = params.sort;
  if (params.limit) queryParams.limit = String(params.limit);
  if (params.offset) queryParams.offset = String(params.offset);

  // Get policy IDs
  const idsRes = await crowdstrikeRequest("GET", "/policy/queries/prevention/v1", undefined, queryParams);
  const ids = idsRes.resources || [];

  if (ids.length === 0) {
    return { policies: [], total: 0 };
  }

  // Get policy details
  const detailsRes = await crowdstrikeRequest("GET", "/policy/entities/prevention/v1", undefined, { ids });
  return {
    policies: detailsRes.resources?.map((p: any) => ({
      id: p.id,
      cid: p.cid,
      name: p.name,
      description: p.description,
      platformName: p.platform_name,
      enabled: p.enabled,
      createdBy: p.created_by,
      createdTimestamp: p.created_timestamp,
      modifiedBy: p.modified_by,
      modifiedTimestamp: p.modified_timestamp,
      groups: p.groups?.map((g: any) => ({
        id: g.id,
        name: g.name,
      })),
      preventionSettings: p.prevention_settings,
      ioaRuleGroups: p.ioa_rule_groups,
    })),
    total: idsRes.meta?.pagination?.total || ids.length,
  };
}

// ========== Threat Intelligence ==========
async function getThreatIntel(params: {
  type: string;
  filter?: string;
  query?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  ids?: string[];
}): Promise<any> {
  const queryParams: Record<string, string | string[]> = {};
  if (params.filter) queryParams.filter = params.filter;
  if (params.query) queryParams.q = params.query;
  if (params.sort) queryParams.sort = params.sort;
  if (params.limit) queryParams.limit = String(params.limit);
  if (params.offset) queryParams.offset = String(params.offset);

  let result: any = {};

  switch (params.type) {
    case "actors": {
      if (params.ids?.length) {
        const res = await crowdstrikeRequest("GET", "/intel/entities/actors/v1", undefined, { ids: params.ids });
        result = {
          actors: res.resources?.map((a: any) => ({
            id: a.id,
            name: a.name,
            shortDescription: a.short_description,
            description: a.description,
            knownAs: a.known_as,
            origins: a.origins,
            targetCountries: a.target_countries,
            targetIndustries: a.target_industries,
            motivations: a.motivations,
            capabilities: a.capabilities,
            firstActivityDate: a.first_activity_date,
            lastActivityDate: a.last_activity_date,
            active: a.active,
            killChain: a.kill_chain,
            url: a.url,
          })),
        };
      } else {
        const idsRes = await crowdstrikeRequest("GET", "/intel/queries/actors/v1", undefined, queryParams);
        result = {
          actorIds: idsRes.resources || [],
          total: idsRes.meta?.pagination?.total || 0,
        };
      }
      break;
    }
    case "indicators": {
      if (params.ids?.length) {
        const res = await crowdstrikeRequest("GET", "/intel/entities/indicators/GET/v1", undefined, { ids: params.ids });
        result = {
          indicators: res.resources?.map((ind: any) => ({
            id: ind.id,
            type: ind.type,
            indicator: ind.indicator,
            labels: ind.labels,
            maliciousConfidence: ind.malicious_confidence,
            publishedDate: ind.published_date,
            lastUpdated: ind.last_updated,
            reports: ind.reports,
            actors: ind.actors,
            malwareFamilies: ind.malware_families,
            killChains: ind.kill_chains,
            targets: ind.targets,
          })),
        };
      } else {
        const idsRes = await crowdstrikeRequest("GET", "/intel/queries/indicators/v1", undefined, queryParams);
        result = {
          indicatorIds: idsRes.resources || [],
          total: idsRes.meta?.pagination?.total || 0,
        };
      }
      break;
    }
    case "reports": {
      if (params.ids?.length) {
        const res = await crowdstrikeRequest("GET", "/intel/entities/reports/v1", undefined, { ids: params.ids });
        result = {
          reports: res.resources?.map((r: any) => ({
            id: r.id,
            name: r.name,
            shortDescription: r.short_description,
            description: r.description,
            type: r.type,
            subType: r.sub_type,
            targetCountries: r.target_countries,
            targetIndustries: r.target_industries,
            motivations: r.motivations,
            actors: r.actors,
            malware: r.malware,
            tags: r.tags,
            createdDate: r.created_date,
            lastModifiedDate: r.last_modified_date,
            url: r.url,
          })),
        };
      } else {
        const idsRes = await crowdstrikeRequest("GET", "/intel/queries/reports/v1", undefined, queryParams);
        result = {
          reportIds: idsRes.resources || [],
          total: idsRes.meta?.pagination?.total || 0,
        };
      }
      break;
    }
    default:
      throw new Error(`Unknown threat intel type: ${params.type}`);
  }

  return result;
}

// ============================================================================
// SERVER SETUP
// ============================================================================

const server = new Server(
  {
    name: "crowdstrike-mcp-server",
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
    let result: any;

    switch (name) {
      // Detections
      case "list_detections":
        result = await listDetections(args as any);
        break;
      case "get_detection":
        result = await getDetection(args as any);
        break;
      case "update_detection":
        result = await updateDetection(args as any);
        break;

      // Hosts
      case "list_hosts":
        result = await listHosts(args as any);
        break;
      case "get_host":
        result = await getHost(args as any);
        break;
      case "contain_host":
        result = await containHost(args as any);
        break;
      case "lift_containment":
        result = await liftContainment(args as any);
        break;

      // Incidents
      case "list_incidents":
        result = await listIncidents(args as any);
        break;
      case "get_incident":
        result = await getIncident(args as any);
        break;
      case "update_incident":
        result = await updateIncident(args as any);
        break;

      // IOCs
      case "list_iocs":
        result = await listIocs(args as any);
        break;
      case "create_ioc":
        result = await createIoc(args as any);
        break;
      case "delete_ioc":
        result = await deleteIoc(args as any);
        break;

      // RTR
      case "run_rtr_command":
        result = await runRtrCommand(args as any);
        break;

      // Vulnerabilities
      case "get_vulnerabilities":
        result = await getVulnerabilities(args as any);
        break;

      // Prevention Policies
      case "list_prevention_policies":
        result = await listPreventionPolicies(args as any);
        break;

      // Threat Intelligence
      case "get_threat_intel":
        result = await getThreatIntel(args as any);
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
  console.error("CrowdStrike Falcon MCP Server started");
}

main().catch(console.error);
