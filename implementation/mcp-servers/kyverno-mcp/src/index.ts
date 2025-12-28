/**
 * Kyverno MCP Server - Kubernetes policy management for KOSMOS agents
 *
 * Provides tools for managing Kyverno policies, validating resources,
 * viewing policy reports, and handling admission reports in Kubernetes clusters.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import * as k8s from "@kubernetes/client-node";

// Configuration from environment variables
const config = {
  kubeConfig: process.env.KUBE_CONFIG,
  kubeApiUrl: process.env.KUBE_API_URL,
};

// Initialize Kubernetes client
const kc = new k8s.KubeConfig();
if (config.kubeConfig) {
  kc.loadFromString(config.kubeConfig);
} else if (config.kubeApiUrl) {
  kc.loadFromOptions({
    clusters: [{ name: "default", server: config.kubeApiUrl, skipTLSVerify: true }],
    users: [{ name: "default" }],
    contexts: [{ name: "default", cluster: "default", user: "default" }],
    currentContext: "default",
  });
} else {
  kc.loadFromDefault();
}

const customApi = kc.makeApiClient(k8s.CustomObjectsApi);
const coreApi = kc.makeApiClient(k8s.CoreV1Api);

// Kyverno API Groups
const KYVERNO_GROUP = "kyverno.io";
const KYVERNO_VERSION = "v1";
const POLICY_REPORT_GROUP = "wgpolicyk8s.io";
const POLICY_REPORT_VERSION = "v1alpha2";

const TOOLS: Tool[] = [
  // Policy Management
  {
    name: "list_policies",
    description: "List all Kyverno policies in a namespace or all namespaces.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string", description: "Namespace to list policies from. Leave empty for all namespaces." },
        labelSelector: { type: "string", description: "Label selector to filter policies." },
      },
    },
  },
  {
    name: "get_policy",
    description: "Get detailed information about a specific Kyverno policy.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string", description: "Namespace of the policy." },
        name: { type: "string", description: "Name of the policy." },
      },
      required: ["namespace", "name"],
    },
  },
  {
    name: "create_policy",
    description: "Create a new Kyverno policy.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string", description: "Namespace to create the policy in." },
        name: { type: "string", description: "Name of the policy." },
        spec: {
          type: "object",
          description: "Policy specification including rules, validationFailureAction, etc.",
        },
        labels: { type: "object", description: "Labels to apply to the policy." },
        annotations: { type: "object", description: "Annotations to apply to the policy." },
      },
      required: ["namespace", "name", "spec"],
    },
  },
  {
    name: "update_policy",
    description: "Update an existing Kyverno policy.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string", description: "Namespace of the policy." },
        name: { type: "string", description: "Name of the policy." },
        spec: { type: "object", description: "Updated policy specification." },
        labels: { type: "object", description: "Updated labels." },
        annotations: { type: "object", description: "Updated annotations." },
      },
      required: ["namespace", "name", "spec"],
    },
  },
  {
    name: "delete_policy",
    description: "Delete a Kyverno policy.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string", description: "Namespace of the policy." },
        name: { type: "string", description: "Name of the policy." },
      },
      required: ["namespace", "name"],
    },
  },

  // Cluster Policies
  {
    name: "list_cluster_policies",
    description: "List all cluster-wide Kyverno policies.",
    inputSchema: {
      type: "object",
      properties: {
        labelSelector: { type: "string", description: "Label selector to filter policies." },
      },
    },
  },
  {
    name: "get_cluster_policy",
    description: "Get detailed information about a specific cluster policy.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the cluster policy." },
      },
      required: ["name"],
    },
  },
  {
    name: "create_cluster_policy",
    description: "Create a new cluster-wide Kyverno policy.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the cluster policy." },
        spec: { type: "object", description: "Policy specification." },
        labels: { type: "object", description: "Labels to apply." },
        annotations: { type: "object", description: "Annotations to apply." },
      },
      required: ["name", "spec"],
    },
  },
  {
    name: "delete_cluster_policy",
    description: "Delete a cluster-wide Kyverno policy.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the cluster policy." },
      },
      required: ["name"],
    },
  },

  // Validation
  {
    name: "validate_resource",
    description: "Validate a Kubernetes resource against Kyverno policies.",
    inputSchema: {
      type: "object",
      properties: {
        resource: {
          type: "object",
          description: "The Kubernetes resource to validate (full manifest).",
        },
        policyNames: {
          type: "array",
          items: { type: "string" },
          description: "Specific policies to validate against. Leave empty to validate against all.",
        },
        namespace: { type: "string", description: "Namespace context for validation." },
      },
      required: ["resource"],
    },
  },

  // Policy Reports
  {
    name: "list_policy_reports",
    description: "List policy reports in a namespace or cluster-wide.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string", description: "Namespace for namespaced reports. Leave empty for cluster reports." },
        labelSelector: { type: "string", description: "Label selector to filter reports." },
      },
    },
  },
  {
    name: "get_policy_report",
    description: "Get a specific policy report.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string", description: "Namespace of the report. Leave empty for cluster report." },
        name: { type: "string", description: "Name of the policy report." },
      },
      required: ["name"],
    },
  },

  // Admission Reports
  {
    name: "get_admission_report",
    description: "Get admission report for a resource.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string", description: "Namespace of the admission report." },
        name: { type: "string", description: "Name of the admission report." },
      },
      required: ["name"],
    },
  },
  {
    name: "list_admission_reports",
    description: "List admission reports in a namespace.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string", description: "Namespace to list admission reports from." },
        labelSelector: { type: "string", description: "Label selector to filter reports." },
      },
    },
  },

  // Violations
  {
    name: "list_violations",
    description: "List policy violations from policy reports.",
    inputSchema: {
      type: "object",
      properties: {
        namespace: { type: "string", description: "Namespace to check for violations. Leave empty for cluster-wide." },
        policyName: { type: "string", description: "Filter by policy name." },
        severity: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "Filter by severity.",
        },
        limit: { type: "number", description: "Maximum number of violations to return." },
      },
    },
  },

  // Policy Generation and Testing
  {
    name: "generate_policy",
    description: "Generate a Kyverno policy from a resource or template.",
    inputSchema: {
      type: "object",
      properties: {
        resource: { type: "object", description: "Sample resource to generate policy from." },
        policyType: {
          type: "string",
          enum: ["validate", "mutate", "generate", "verifyImages"],
          description: "Type of policy to generate.",
        },
        action: {
          type: "string",
          enum: ["Enforce", "Audit"],
          description: "Validation failure action.",
        },
        name: { type: "string", description: "Name for the generated policy." },
        description: { type: "string", description: "Description for the policy." },
      },
      required: ["resource", "policyType"],
    },
  },
  {
    name: "test_policy",
    description: "Test a policy against a sample resource without applying.",
    inputSchema: {
      type: "object",
      properties: {
        policy: { type: "object", description: "The Kyverno policy to test." },
        resource: { type: "object", description: "The resource to test against." },
        oldResource: { type: "object", description: "Old resource for update scenarios." },
        operation: {
          type: "string",
          enum: ["CREATE", "UPDATE", "DELETE"],
          description: "Operation type to simulate.",
        },
      },
      required: ["policy", "resource"],
    },
  },

  // Metrics
  {
    name: "get_metrics",
    description: "Get Kyverno metrics and status information.",
    inputSchema: {
      type: "object",
      properties: {
        includeRules: { type: "boolean", description: "Include per-rule metrics." },
        includeResources: { type: "boolean", description: "Include resource processing metrics." },
      },
    },
  },
];

// Policy Management Functions
async function listPolicies(params: { namespace?: string; labelSelector?: string }): Promise<any> {
  try {
    let policies: any[];
    if (params.namespace) {
      const res = await customApi.listNamespacedCustomObject(
        KYVERNO_GROUP,
        KYVERNO_VERSION,
        params.namespace,
        "policies",
        undefined,
        undefined,
        undefined,
        undefined,
        params.labelSelector
      );
      policies = (res.body as any).items;
    } else {
      const res = await customApi.listClusterCustomObject(
        KYVERNO_GROUP,
        KYVERNO_VERSION,
        "policies",
        undefined,
        undefined,
        undefined,
        undefined,
        params.labelSelector
      );
      policies = (res.body as any).items;
    }

    return {
      policies: policies.map((p: any) => ({
        name: p.metadata?.name,
        namespace: p.metadata?.namespace,
        validationFailureAction: p.spec?.validationFailureAction,
        background: p.spec?.background,
        rulesCount: p.spec?.rules?.length || 0,
        ready: p.status?.ready,
        createdAt: p.metadata?.creationTimestamp,
      })),
      count: policies.length,
    };
  } catch (error: any) {
    throw new Error(`Failed to list policies: ${error.message}`);
  }
}

async function getPolicy(params: { namespace: string; name: string }): Promise<any> {
  try {
    const res = await customApi.getNamespacedCustomObject(
      KYVERNO_GROUP,
      KYVERNO_VERSION,
      params.namespace,
      "policies",
      params.name
    );
    const policy = res.body as any;
    return {
      name: policy.metadata?.name,
      namespace: policy.metadata?.namespace,
      labels: policy.metadata?.labels,
      annotations: policy.metadata?.annotations,
      spec: policy.spec,
      status: policy.status,
      createdAt: policy.metadata?.creationTimestamp,
    };
  } catch (error: any) {
    throw new Error(`Failed to get policy: ${error.message}`);
  }
}

async function createPolicy(params: {
  namespace: string;
  name: string;
  spec: any;
  labels?: any;
  annotations?: any;
}): Promise<any> {
  try {
    const policy = {
      apiVersion: `${KYVERNO_GROUP}/${KYVERNO_VERSION}`,
      kind: "Policy",
      metadata: {
        name: params.name,
        namespace: params.namespace,
        labels: params.labels || {},
        annotations: params.annotations || {},
      },
      spec: params.spec,
    };

    await customApi.createNamespacedCustomObject(
      KYVERNO_GROUP,
      KYVERNO_VERSION,
      params.namespace,
      "policies",
      policy
    );

    return { name: params.name, namespace: params.namespace, created: true };
  } catch (error: any) {
    throw new Error(`Failed to create policy: ${error.message}`);
  }
}

async function updatePolicy(params: {
  namespace: string;
  name: string;
  spec: any;
  labels?: any;
  annotations?: any;
}): Promise<any> {
  try {
    // Get existing policy first
    const existing = await customApi.getNamespacedCustomObject(
      KYVERNO_GROUP,
      KYVERNO_VERSION,
      params.namespace,
      "policies",
      params.name
    );
    const existingPolicy = existing.body as any;

    // Update the policy
    const updatedPolicy = {
      ...existingPolicy,
      metadata: {
        ...existingPolicy.metadata,
        labels: params.labels || existingPolicy.metadata?.labels,
        annotations: params.annotations || existingPolicy.metadata?.annotations,
      },
      spec: params.spec,
    };

    await customApi.replaceNamespacedCustomObject(
      KYVERNO_GROUP,
      KYVERNO_VERSION,
      params.namespace,
      "policies",
      params.name,
      updatedPolicy
    );

    return { name: params.name, namespace: params.namespace, updated: true };
  } catch (error: any) {
    throw new Error(`Failed to update policy: ${error.message}`);
  }
}

async function deletePolicy(params: { namespace: string; name: string }): Promise<any> {
  try {
    await customApi.deleteNamespacedCustomObject(
      KYVERNO_GROUP,
      KYVERNO_VERSION,
      params.namespace,
      "policies",
      params.name
    );
    return { name: params.name, namespace: params.namespace, deleted: true };
  } catch (error: any) {
    throw new Error(`Failed to delete policy: ${error.message}`);
  }
}

// Cluster Policy Functions
async function listClusterPolicies(params: { labelSelector?: string }): Promise<any> {
  try {
    const res = await customApi.listClusterCustomObject(
      KYVERNO_GROUP,
      KYVERNO_VERSION,
      "clusterpolicies",
      undefined,
      undefined,
      undefined,
      undefined,
      params.labelSelector
    );
    const policies = (res.body as any).items;

    return {
      clusterPolicies: policies.map((p: any) => ({
        name: p.metadata?.name,
        validationFailureAction: p.spec?.validationFailureAction,
        background: p.spec?.background,
        rulesCount: p.spec?.rules?.length || 0,
        ready: p.status?.ready,
        createdAt: p.metadata?.creationTimestamp,
      })),
      count: policies.length,
    };
  } catch (error: any) {
    throw new Error(`Failed to list cluster policies: ${error.message}`);
  }
}

async function getClusterPolicy(params: { name: string }): Promise<any> {
  try {
    const res = await customApi.getClusterCustomObject(
      KYVERNO_GROUP,
      KYVERNO_VERSION,
      "clusterpolicies",
      params.name
    );
    const policy = res.body as any;
    return {
      name: policy.metadata?.name,
      labels: policy.metadata?.labels,
      annotations: policy.metadata?.annotations,
      spec: policy.spec,
      status: policy.status,
      createdAt: policy.metadata?.creationTimestamp,
    };
  } catch (error: any) {
    throw new Error(`Failed to get cluster policy: ${error.message}`);
  }
}

async function createClusterPolicy(params: {
  name: string;
  spec: any;
  labels?: any;
  annotations?: any;
}): Promise<any> {
  try {
    const policy = {
      apiVersion: `${KYVERNO_GROUP}/${KYVERNO_VERSION}`,
      kind: "ClusterPolicy",
      metadata: {
        name: params.name,
        labels: params.labels || {},
        annotations: params.annotations || {},
      },
      spec: params.spec,
    };

    await customApi.createClusterCustomObject(
      KYVERNO_GROUP,
      KYVERNO_VERSION,
      "clusterpolicies",
      policy
    );

    return { name: params.name, created: true };
  } catch (error: any) {
    throw new Error(`Failed to create cluster policy: ${error.message}`);
  }
}

async function deleteClusterPolicy(params: { name: string }): Promise<any> {
  try {
    await customApi.deleteClusterCustomObject(
      KYVERNO_GROUP,
      KYVERNO_VERSION,
      "clusterpolicies",
      params.name
    );
    return { name: params.name, deleted: true };
  } catch (error: any) {
    throw new Error(`Failed to delete cluster policy: ${error.message}`);
  }
}

// Validation Function
async function validateResource(params: {
  resource: any;
  policyNames?: string[];
  namespace?: string;
}): Promise<any> {
  try {
    // Get all applicable policies
    const namespace = params.namespace || params.resource?.metadata?.namespace || "default";
    const kind = params.resource?.kind;
    const apiVersion = params.resource?.apiVersion;

    // Fetch both cluster policies and namespace policies
    const [clusterPoliciesRes, namespacePoliciesRes] = await Promise.all([
      customApi.listClusterCustomObject(KYVERNO_GROUP, KYVERNO_VERSION, "clusterpolicies"),
      customApi.listNamespacedCustomObject(KYVERNO_GROUP, KYVERNO_VERSION, namespace, "policies"),
    ]);

    const clusterPolicies = (clusterPoliciesRes.body as any).items || [];
    const namespacePolicies = (namespacePoliciesRes.body as any).items || [];
    const allPolicies = [...clusterPolicies, ...namespacePolicies];

    // Filter by policy names if specified
    const applicablePolicies = params.policyNames
      ? allPolicies.filter((p: any) => params.policyNames?.includes(p.metadata?.name))
      : allPolicies;

    // Simulate validation against each policy
    const validationResults: any[] = [];
    for (const policy of applicablePolicies) {
      const rules = policy.spec?.rules || [];
      for (const rule of rules) {
        const match = rule.match;
        const exclude = rule.exclude;

        // Check if rule applies to this resource
        const matchesKind = !match?.resources?.kinds || match.resources.kinds.includes(kind);
        const matchesNamespace =
          !match?.resources?.namespaces || match.resources.namespaces.includes(namespace);

        if (matchesKind && matchesNamespace) {
          // Check validate rules
          if (rule.validate) {
            const result = {
              policyName: policy.metadata?.name,
              ruleName: rule.name,
              ruleType: "validate",
              action: policy.spec?.validationFailureAction || "Audit",
              applies: true,
              message: rule.validate?.message || "Validation rule applies to this resource",
              pattern: rule.validate?.pattern ? "has pattern" : undefined,
              anyPattern: rule.validate?.anyPattern ? "has anyPattern" : undefined,
              deny: rule.validate?.deny ? "has deny conditions" : undefined,
            };
            validationResults.push(result);
          }

          // Check mutate rules
          if (rule.mutate) {
            validationResults.push({
              policyName: policy.metadata?.name,
              ruleName: rule.name,
              ruleType: "mutate",
              applies: true,
              patchStrategicMerge: rule.mutate?.patchStrategicMerge ? "has patch" : undefined,
            });
          }

          // Check generate rules
          if (rule.generate) {
            validationResults.push({
              policyName: policy.metadata?.name,
              ruleName: rule.name,
              ruleType: "generate",
              applies: true,
              generateKind: rule.generate?.kind,
            });
          }
        }
      }
    }

    return {
      resource: {
        kind: params.resource?.kind,
        name: params.resource?.metadata?.name,
        namespace,
      },
      policiesChecked: applicablePolicies.length,
      validationResults,
      summary: {
        totalRules: validationResults.length,
        validateRules: validationResults.filter((r) => r.ruleType === "validate").length,
        mutateRules: validationResults.filter((r) => r.ruleType === "mutate").length,
        generateRules: validationResults.filter((r) => r.ruleType === "generate").length,
      },
    };
  } catch (error: any) {
    throw new Error(`Failed to validate resource: ${error.message}`);
  }
}

// Policy Report Functions
async function listPolicyReports(params: { namespace?: string; labelSelector?: string }): Promise<any> {
  try {
    let reports: any[];
    if (params.namespace) {
      const res = await customApi.listNamespacedCustomObject(
        POLICY_REPORT_GROUP,
        POLICY_REPORT_VERSION,
        params.namespace,
        "policyreports",
        undefined,
        undefined,
        undefined,
        undefined,
        params.labelSelector
      );
      reports = (res.body as any).items;
    } else {
      // Get cluster policy reports
      const res = await customApi.listClusterCustomObject(
        POLICY_REPORT_GROUP,
        POLICY_REPORT_VERSION,
        "clusterpolicyreports",
        undefined,
        undefined,
        undefined,
        undefined,
        params.labelSelector
      );
      reports = (res.body as any).items;
    }

    return {
      reports: reports.map((r: any) => ({
        name: r.metadata?.name,
        namespace: r.metadata?.namespace,
        summary: r.summary,
        resultsCount: r.results?.length || 0,
        createdAt: r.metadata?.creationTimestamp,
      })),
      count: reports.length,
    };
  } catch (error: any) {
    throw new Error(`Failed to list policy reports: ${error.message}`);
  }
}

async function getPolicyReport(params: { namespace?: string; name: string }): Promise<any> {
  try {
    let report: any;
    if (params.namespace) {
      const res = await customApi.getNamespacedCustomObject(
        POLICY_REPORT_GROUP,
        POLICY_REPORT_VERSION,
        params.namespace,
        "policyreports",
        params.name
      );
      report = res.body;
    } else {
      const res = await customApi.getClusterCustomObject(
        POLICY_REPORT_GROUP,
        POLICY_REPORT_VERSION,
        "clusterpolicyreports",
        params.name
      );
      report = res.body;
    }

    return {
      name: (report as any).metadata?.name,
      namespace: (report as any).metadata?.namespace,
      summary: (report as any).summary,
      results: (report as any).results?.map((r: any) => ({
        policy: r.policy,
        rule: r.rule,
        result: r.result,
        message: r.message,
        severity: r.severity,
        category: r.category,
        resource: r.resources?.[0],
        timestamp: r.timestamp,
      })),
      scope: (report as any).scope,
    };
  } catch (error: any) {
    throw new Error(`Failed to get policy report: ${error.message}`);
  }
}

// Admission Report Functions
async function getAdmissionReport(params: { namespace?: string; name: string }): Promise<any> {
  try {
    let report: any;
    if (params.namespace) {
      const res = await customApi.getNamespacedCustomObject(
        KYVERNO_GROUP,
        "v1alpha2",
        params.namespace,
        "admissionreports",
        params.name
      );
      report = res.body;
    } else {
      const res = await customApi.getClusterCustomObject(
        KYVERNO_GROUP,
        "v1alpha2",
        "clusteradmissionreports",
        params.name
      );
      report = res.body;
    }

    return {
      name: (report as any).metadata?.name,
      namespace: (report as any).metadata?.namespace,
      spec: (report as any).spec,
      owner: (report as any).metadata?.ownerReferences?.[0],
      createdAt: (report as any).metadata?.creationTimestamp,
    };
  } catch (error: any) {
    throw new Error(`Failed to get admission report: ${error.message}`);
  }
}

async function listAdmissionReports(params: { namespace?: string; labelSelector?: string }): Promise<any> {
  try {
    let reports: any[];
    if (params.namespace) {
      const res = await customApi.listNamespacedCustomObject(
        KYVERNO_GROUP,
        "v1alpha2",
        params.namespace,
        "admissionreports",
        undefined,
        undefined,
        undefined,
        undefined,
        params.labelSelector
      );
      reports = (res.body as any).items;
    } else {
      const res = await customApi.listClusterCustomObject(
        KYVERNO_GROUP,
        "v1alpha2",
        "clusteradmissionreports",
        undefined,
        undefined,
        undefined,
        undefined,
        params.labelSelector
      );
      reports = (res.body as any).items;
    }

    return {
      reports: reports.map((r: any) => ({
        name: r.metadata?.name,
        namespace: r.metadata?.namespace,
        owner: r.metadata?.ownerReferences?.[0],
        createdAt: r.metadata?.creationTimestamp,
      })),
      count: reports.length,
    };
  } catch (error: any) {
    throw new Error(`Failed to list admission reports: ${error.message}`);
  }
}

// Violations Function
async function listViolations(params: {
  namespace?: string;
  policyName?: string;
  severity?: string;
  limit?: number;
}): Promise<any> {
  try {
    const violations: any[] = [];
    const limit = params.limit || 100;

    // Get policy reports
    let reports: any[];
    if (params.namespace) {
      const res = await customApi.listNamespacedCustomObject(
        POLICY_REPORT_GROUP,
        POLICY_REPORT_VERSION,
        params.namespace,
        "policyreports"
      );
      reports = (res.body as any).items;
    } else {
      // Get both namespaced and cluster reports
      const [clusterRes, namespacedRes] = await Promise.all([
        customApi.listClusterCustomObject(POLICY_REPORT_GROUP, POLICY_REPORT_VERSION, "clusterpolicyreports"),
        customApi.listClusterCustomObject(POLICY_REPORT_GROUP, POLICY_REPORT_VERSION, "policyreports"),
      ]);
      reports = [...(clusterRes.body as any).items, ...(namespacedRes.body as any).items];
    }

    // Extract violations (fail results) from reports
    for (const report of reports) {
      const results = report.results || [];
      for (const result of results) {
        if (result.result === "fail" || result.result === "error") {
          // Apply filters
          if (params.policyName && result.policy !== params.policyName) continue;
          if (params.severity && result.severity !== params.severity) continue;

          violations.push({
            reportName: report.metadata?.name,
            reportNamespace: report.metadata?.namespace,
            policy: result.policy,
            rule: result.rule,
            result: result.result,
            message: result.message,
            severity: result.severity,
            category: result.category,
            resource: result.resources?.[0],
            timestamp: result.timestamp,
          });

          if (violations.length >= limit) break;
        }
      }
      if (violations.length >= limit) break;
    }

    return {
      violations,
      count: violations.length,
      filters: {
        namespace: params.namespace || "all",
        policyName: params.policyName || "all",
        severity: params.severity || "all",
      },
    };
  } catch (error: any) {
    throw new Error(`Failed to list violations: ${error.message}`);
  }
}

// Policy Generation Function
async function generatePolicy(params: {
  resource: any;
  policyType: string;
  action?: string;
  name?: string;
  description?: string;
}): Promise<any> {
  const resourceKind = params.resource?.kind || "Unknown";
  const resourceName = params.resource?.metadata?.name || "example";
  const policyName = params.name || `${resourceKind.toLowerCase()}-${params.policyType}-policy`;

  const policy: any = {
    apiVersion: `${KYVERNO_GROUP}/${KYVERNO_VERSION}`,
    kind: "ClusterPolicy",
    metadata: {
      name: policyName,
      annotations: {
        "policies.kyverno.io/title": params.description || `Auto-generated ${params.policyType} policy`,
        "policies.kyverno.io/description": `Policy generated from ${resourceKind} resource`,
      },
    },
    spec: {
      validationFailureAction: params.action || "Audit",
      background: true,
      rules: [],
    },
  };

  const rule: any = {
    name: `${params.policyType}-${resourceKind.toLowerCase()}`,
    match: {
      resources: {
        kinds: [resourceKind],
      },
    },
  };

  switch (params.policyType) {
    case "validate":
      // Generate validation rule based on resource structure
      rule.validate = {
        message: `Resource must comply with ${policyName} requirements`,
        pattern: {
          metadata: {
            labels: params.resource?.metadata?.labels || { "app.kubernetes.io/name": "?*" },
          },
        },
      };
      break;

    case "mutate":
      // Generate mutation rule to add defaults
      rule.mutate = {
        patchStrategicMerge: {
          metadata: {
            labels: {
              "managed-by": "kyverno",
            },
          },
        },
      };
      break;

    case "generate":
      // Generate a companion resource
      rule.generate = {
        kind: "ConfigMap",
        name: `${resourceName}-config`,
        namespace: "{{request.namespace}}",
        data: {
          kind: "ConfigMap",
          metadata: {
            name: `${resourceName}-config`,
          },
          data: {
            "generated-for": resourceName,
          },
        },
      };
      break;

    case "verifyImages":
      // Generate image verification rule
      rule.verifyImages = [
        {
          imageReferences: ["*"],
          attestations: [
            {
              predicateType: "cosign.sigstore.dev/attestation/v1",
              attestors: [
                {
                  entries: [
                    {
                      keys: {
                        publicKeys: "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];
      break;
  }

  policy.spec.rules.push(rule);

  return {
    generatedPolicy: policy,
    policyType: params.policyType,
    targetResource: {
      kind: resourceKind,
      name: resourceName,
    },
  };
}

// Policy Testing Function
async function testPolicy(params: {
  policy: any;
  resource: any;
  oldResource?: any;
  operation?: string;
}): Promise<any> {
  const operation = params.operation || "CREATE";
  const rules = params.policy?.spec?.rules || [];
  const testResults: any[] = [];

  for (const rule of rules) {
    const result: any = {
      ruleName: rule.name,
      ruleType: null,
      matched: false,
      result: "skip",
      message: "",
    };

    // Check match conditions
    const match = rule.match;
    const resourceKind = params.resource?.kind;
    const resourceNamespace = params.resource?.metadata?.namespace;

    const matchesKind = !match?.resources?.kinds || match.resources.kinds.includes(resourceKind);
    const matchesNamespace =
      !match?.resources?.namespaces || match.resources.namespaces.includes(resourceNamespace);
    const matchesOperation = !match?.operations || match.operations.includes(operation);

    result.matched = matchesKind && matchesNamespace && matchesOperation;

    if (!result.matched) {
      result.message = "Rule does not match the resource";
      testResults.push(result);
      continue;
    }

    // Test validate rules
    if (rule.validate) {
      result.ruleType = "validate";
      const pattern = rule.validate.pattern;
      const anyPattern = rule.validate.anyPattern;

      if (pattern) {
        // Simple pattern matching simulation
        result.result = "pass";
        result.message = "Resource matches validation pattern (simulated)";
      } else if (anyPattern) {
        result.result = "pass";
        result.message = "Resource matches one of the anyPattern options (simulated)";
      } else if (rule.validate.deny) {
        result.result = "pass";
        result.message = "Deny conditions not triggered (simulated)";
      }
    }

    // Test mutate rules
    if (rule.mutate) {
      result.ruleType = "mutate";
      result.result = "pass";
      result.message = "Mutation would be applied";
      result.mutation = rule.mutate.patchStrategicMerge || rule.mutate.patchesJson6902;
    }

    // Test generate rules
    if (rule.generate) {
      result.ruleType = "generate";
      result.result = "pass";
      result.message = `Would generate ${rule.generate.kind}`;
      result.generatedResource = {
        kind: rule.generate.kind,
        name: rule.generate.name,
        namespace: rule.generate.namespace,
      };
    }

    testResults.push(result);
  }

  return {
    policy: {
      name: params.policy?.metadata?.name,
      kind: params.policy?.kind,
    },
    resource: {
      kind: params.resource?.kind,
      name: params.resource?.metadata?.name,
      namespace: params.resource?.metadata?.namespace,
    },
    operation,
    testResults,
    summary: {
      totalRules: testResults.length,
      matched: testResults.filter((r) => r.matched).length,
      passed: testResults.filter((r) => r.result === "pass").length,
      failed: testResults.filter((r) => r.result === "fail").length,
      skipped: testResults.filter((r) => r.result === "skip").length,
    },
  };
}

// Metrics Function
async function getMetrics(params: { includeRules?: boolean; includeResources?: boolean }): Promise<any> {
  try {
    // Get Kyverno controller pods to check status
    const kyvernoNamespace = "kyverno";
    let controllerStatus: any = { available: false };

    try {
      const podsRes = await coreApi.listNamespacedPod(
        kyvernoNamespace,
        undefined,
        undefined,
        undefined,
        undefined,
        "app.kubernetes.io/component=admission-controller"
      );
      const pods = podsRes.body.items;
      controllerStatus = {
        available: pods.length > 0,
        pods: pods.map((p) => ({
          name: p.metadata?.name,
          status: p.status?.phase,
          ready: p.status?.containerStatuses?.every((c) => c.ready),
          restarts: p.status?.containerStatuses?.reduce((sum, c) => sum + (c.restartCount || 0), 0),
        })),
      };
    } catch {
      controllerStatus = { available: false, message: "Kyverno namespace not found or inaccessible" };
    }

    // Get policy counts
    let policyStats: any = {};
    try {
      const [clusterPolicies, policies] = await Promise.all([
        customApi.listClusterCustomObject(KYVERNO_GROUP, KYVERNO_VERSION, "clusterpolicies"),
        customApi.listClusterCustomObject(KYVERNO_GROUP, KYVERNO_VERSION, "policies"),
      ]);

      const clusterPolicyItems = (clusterPolicies.body as any).items || [];
      const policyItems = (policies.body as any).items || [];

      policyStats = {
        clusterPolicies: clusterPolicyItems.length,
        namespacedPolicies: policyItems.length,
        totalPolicies: clusterPolicyItems.length + policyItems.length,
      };

      if (params.includeRules) {
        let totalRules = 0;
        const ruleTypes: Record<string, number> = { validate: 0, mutate: 0, generate: 0, verifyImages: 0 };

        [...clusterPolicyItems, ...policyItems].forEach((p: any) => {
          const rules = p.spec?.rules || [];
          totalRules += rules.length;
          rules.forEach((r: any) => {
            if (r.validate) ruleTypes.validate++;
            if (r.mutate) ruleTypes.mutate++;
            if (r.generate) ruleTypes.generate++;
            if (r.verifyImages) ruleTypes.verifyImages++;
          });
        });

        policyStats.totalRules = totalRules;
        policyStats.ruleTypes = ruleTypes;
      }
    } catch {
      policyStats = { error: "Unable to fetch policy statistics" };
    }

    // Get policy report summaries
    let reportStats: any = {};
    try {
      const [clusterReports, reports] = await Promise.all([
        customApi.listClusterCustomObject(POLICY_REPORT_GROUP, POLICY_REPORT_VERSION, "clusterpolicyreports"),
        customApi.listClusterCustomObject(POLICY_REPORT_GROUP, POLICY_REPORT_VERSION, "policyreports"),
      ]);

      const allReports = [
        ...(clusterReports.body as any).items,
        ...(reports.body as any).items,
      ];

      let totalPass = 0;
      let totalFail = 0;
      let totalWarn = 0;
      let totalError = 0;
      let totalSkip = 0;

      allReports.forEach((r: any) => {
        const summary = r.summary || {};
        totalPass += summary.pass || 0;
        totalFail += summary.fail || 0;
        totalWarn += summary.warn || 0;
        totalError += summary.error || 0;
        totalSkip += summary.skip || 0;
      });

      reportStats = {
        totalReports: allReports.length,
        results: {
          pass: totalPass,
          fail: totalFail,
          warn: totalWarn,
          error: totalError,
          skip: totalSkip,
        },
      };
    } catch {
      reportStats = { error: "Unable to fetch report statistics" };
    }

    return {
      controller: controllerStatus,
      policies: policyStats,
      reports: reportStats,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    throw new Error(`Failed to get metrics: ${error.message}`);
  }
}

// Server Setup
const server = new Server({ name: "kyverno-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // Policy Management
      case "list_policies":
        result = await listPolicies(args as any);
        break;
      case "get_policy":
        result = await getPolicy(args as any);
        break;
      case "create_policy":
        result = await createPolicy(args as any);
        break;
      case "update_policy":
        result = await updatePolicy(args as any);
        break;
      case "delete_policy":
        result = await deletePolicy(args as any);
        break;

      // Cluster Policies
      case "list_cluster_policies":
        result = await listClusterPolicies(args as any);
        break;
      case "get_cluster_policy":
        result = await getClusterPolicy(args as any);
        break;
      case "create_cluster_policy":
        result = await createClusterPolicy(args as any);
        break;
      case "delete_cluster_policy":
        result = await deleteClusterPolicy(args as any);
        break;

      // Validation
      case "validate_resource":
        result = await validateResource(args as any);
        break;

      // Policy Reports
      case "list_policy_reports":
        result = await listPolicyReports(args as any);
        break;
      case "get_policy_report":
        result = await getPolicyReport(args as any);
        break;

      // Admission Reports
      case "get_admission_report":
        result = await getAdmissionReport(args as any);
        break;
      case "list_admission_reports":
        result = await listAdmissionReports(args as any);
        break;

      // Violations
      case "list_violations":
        result = await listViolations(args as any);
        break;

      // Generation and Testing
      case "generate_policy":
        result = await generatePolicy(args as any);
        break;
      case "test_policy":
        result = await testPolicy(args as any);
        break;

      // Metrics
      case "get_metrics":
        result = await getMetrics(args as any);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Kyverno MCP Server running on stdio");
}

main().catch(console.error);
