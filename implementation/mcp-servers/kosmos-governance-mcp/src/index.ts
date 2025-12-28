/**
 * KOSMOS Governance MCP Server
 *
 * Implements governance tools for the KOSMOS Pentarchy system:
 *
 * Pentarchy Voting:
 * 1. create_proposal - Create a governance proposal
 * 2. cast_vote - Cast a vote on a proposal
 * 3. get_voting_results - Get voting results for a proposal
 *
 * Agent Governance:
 * 4. register_agent - Register an agent in the governance system
 * 5. update_agent_permissions - Update agent permissions
 * 6. deregister_agent - Remove agent from governance
 *
 * Decision Tracking:
 * 7. list_decisions - List governance decisions
 * 8. get_decision_history - Get full history of a decision
 *
 * Appeals:
 * 9. submit_appeal - Submit an appeal against a decision
 * 10. review_appeal - Review and resolve an appeal
 *
 * Quorum Management:
 * 11. get_quorum_status - Get current quorum status
 * 12. set_quorum_requirements - Set quorum requirements for proposal types
 *
 * Voting Weights:
 * 13. get_voting_weights - Get current voting weights
 * 14. set_voting_weight - Set voting weight for an agent
 *
 * Governance Metrics:
 * 15. get_governance_metrics - Get comprehensive governance metrics
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// =============================================================================
// Types and Interfaces
// =============================================================================

type ProposalStatus = "draft" | "active" | "passed" | "rejected" | "expired" | "appealed";
type ProposalType = "policy" | "agent_action" | "resource_allocation" | "emergency" | "constitutional";
type VoteChoice = "approve" | "reject" | "abstain" | "veto";
type AppealStatus = "pending" | "under_review" | "upheld" | "overturned" | "dismissed";
type PentarchyRole = "archon" | "strategos" | "logistes" | "nomothetes" | "ephoros";

interface Proposal {
  id: string;
  title: string;
  description: string;
  type: ProposalType;
  status: ProposalStatus;
  proposerId: string;
  createdAt: Date;
  expiresAt: Date;
  quorumRequired: number;
  superMajorityRequired: boolean;
  metadata: Record<string, unknown>;
}

interface Vote {
  id: string;
  proposalId: string;
  voterId: string;
  voterRole: PentarchyRole;
  choice: VoteChoice;
  weight: number;
  reason?: string;
  timestamp: Date;
}

interface Agent {
  id: string;
  name: string;
  role: PentarchyRole;
  permissions: string[];
  votingWeight: number;
  isActive: boolean;
  registeredAt: Date;
  lastActiveAt: Date;
  metadata: Record<string, unknown>;
}

interface Decision {
  id: string;
  proposalId: string;
  outcome: "approved" | "rejected";
  finalVotes: {
    approve: number;
    reject: number;
    abstain: number;
    veto: number;
  };
  quorumMet: boolean;
  decidedAt: Date;
  implementedAt?: Date;
  history: DecisionEvent[];
}

interface DecisionEvent {
  timestamp: Date;
  event: string;
  actor?: string;
  details?: Record<string, unknown>;
}

interface Appeal {
  id: string;
  decisionId: string;
  appellantId: string;
  reason: string;
  status: AppealStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewerId?: string;
  resolution?: string;
  metadata: Record<string, unknown>;
}

interface QuorumRequirement {
  proposalType: ProposalType;
  minParticipation: number; // 0-1 percentage
  minApprovalRate: number; // 0-1 percentage
  requiresUnanimity: boolean;
  vetoThreshold: number; // number of vetos to block
}

// =============================================================================
// Zod Schemas
// =============================================================================

const CreateProposalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  type: z.enum(["policy", "agent_action", "resource_allocation", "emergency", "constitutional"]),
  proposerId: z.string(),
  expiresInHours: z.number().min(1).max(720).default(72),
  metadata: z.record(z.unknown()).optional(),
});

const CastVoteSchema = z.object({
  proposalId: z.string(),
  voterId: z.string(),
  choice: z.enum(["approve", "reject", "abstain", "veto"]),
  reason: z.string().optional(),
});

const GetVotingResultsSchema = z.object({
  proposalId: z.string(),
});

const RegisterAgentSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.enum(["archon", "strategos", "logistes", "nomothetes", "ephoros"]),
  permissions: z.array(z.string()).default([]),
  initialWeight: z.number().min(0).max(10).default(1),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateAgentPermissionsSchema = z.object({
  agentId: z.string(),
  permissions: z.array(z.string()),
  action: z.enum(["set", "add", "remove"]).default("set"),
});

const DeregisterAgentSchema = z.object({
  agentId: z.string(),
  reason: z.string().optional(),
});

const ListDecisionsSchema = z.object({
  status: z.enum(["all", "approved", "rejected"]).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
});

const GetDecisionHistorySchema = z.object({
  decisionId: z.string(),
});

const SubmitAppealSchema = z.object({
  decisionId: z.string(),
  appellantId: z.string(),
  reason: z.string().min(10),
  metadata: z.record(z.unknown()).optional(),
});

const ReviewAppealSchema = z.object({
  appealId: z.string(),
  reviewerId: z.string(),
  resolution: z.enum(["upheld", "overturned", "dismissed"]),
  explanation: z.string(),
});

const GetQuorumStatusSchema = z.object({
  proposalId: z.string().optional(),
  proposalType: z.enum(["policy", "agent_action", "resource_allocation", "emergency", "constitutional"]).optional(),
});

const SetQuorumRequirementsSchema = z.object({
  proposalType: z.enum(["policy", "agent_action", "resource_allocation", "emergency", "constitutional"]),
  minParticipation: z.number().min(0).max(1),
  minApprovalRate: z.number().min(0).max(1),
  requiresUnanimity: z.boolean().default(false),
  vetoThreshold: z.number().min(1).default(1),
});

const GetVotingWeightsSchema = z.object({
  agentId: z.string().optional(),
  role: z.enum(["archon", "strategos", "logistes", "nomothetes", "ephoros"]).optional(),
});

const SetVotingWeightSchema = z.object({
  agentId: z.string(),
  weight: z.number().min(0).max(10),
  reason: z.string().optional(),
});

const GetGovernanceMetricsSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  // Pentarchy Voting Tools
  {
    name: "create_proposal",
    description: "Create a new governance proposal for Pentarchy voting",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Proposal title (max 200 chars)" },
        description: { type: "string", description: "Detailed proposal description" },
        type: {
          type: "string",
          enum: ["policy", "agent_action", "resource_allocation", "emergency", "constitutional"],
          description: "Type of proposal determines quorum and voting rules",
        },
        proposerId: { type: "string", description: "ID of the agent creating the proposal" },
        expiresInHours: { type: "number", description: "Hours until proposal expires (1-720)", default: 72 },
        metadata: { type: "object", description: "Additional proposal metadata" },
      },
      required: ["title", "description", "type", "proposerId"],
    },
  },
  {
    name: "cast_vote",
    description: "Cast a vote on an active proposal",
    inputSchema: {
      type: "object",
      properties: {
        proposalId: { type: "string", description: "ID of the proposal to vote on" },
        voterId: { type: "string", description: "ID of the voting agent" },
        choice: {
          type: "string",
          enum: ["approve", "reject", "abstain", "veto"],
          description: "Vote choice (veto is reserved for specific roles)",
        },
        reason: { type: "string", description: "Optional reason for the vote" },
      },
      required: ["proposalId", "voterId", "choice"],
    },
  },
  {
    name: "get_voting_results",
    description: "Get current voting results for a proposal",
    inputSchema: {
      type: "object",
      properties: {
        proposalId: { type: "string", description: "ID of the proposal" },
      },
      required: ["proposalId"],
    },
  },

  // Agent Governance Tools
  {
    name: "register_agent",
    description: "Register a new agent in the governance system",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Agent name" },
        role: {
          type: "string",
          enum: ["archon", "strategos", "logistes", "nomothetes", "ephoros"],
          description: "Pentarchy role for the agent",
        },
        permissions: { type: "array", items: { type: "string" }, description: "Initial permissions" },
        initialWeight: { type: "number", description: "Initial voting weight (0-10)" },
        metadata: { type: "object", description: "Additional agent metadata" },
      },
      required: ["name", "role"],
    },
  },
  {
    name: "update_agent_permissions",
    description: "Update permissions for a registered agent",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "ID of the agent" },
        permissions: { type: "array", items: { type: "string" }, description: "Permissions to update" },
        action: {
          type: "string",
          enum: ["set", "add", "remove"],
          description: "How to apply the permissions",
        },
      },
      required: ["agentId", "permissions"],
    },
  },
  {
    name: "deregister_agent",
    description: "Remove an agent from the governance system",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "ID of the agent to deregister" },
        reason: { type: "string", description: "Reason for deregistration" },
      },
      required: ["agentId"],
    },
  },

  // Decision Tracking Tools
  {
    name: "list_decisions",
    description: "List governance decisions with optional filters",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["all", "approved", "rejected"],
          description: "Filter by decision outcome",
        },
        fromDate: { type: "string", description: "Start date (ISO format)" },
        toDate: { type: "string", description: "End date (ISO format)" },
        limit: { type: "number", description: "Maximum results to return" },
      },
    },
  },
  {
    name: "get_decision_history",
    description: "Get complete history of a governance decision",
    inputSchema: {
      type: "object",
      properties: {
        decisionId: { type: "string", description: "ID of the decision" },
      },
      required: ["decisionId"],
    },
  },

  // Appeals Tools
  {
    name: "submit_appeal",
    description: "Submit an appeal against a governance decision",
    inputSchema: {
      type: "object",
      properties: {
        decisionId: { type: "string", description: "ID of the decision to appeal" },
        appellantId: { type: "string", description: "ID of the appealing agent" },
        reason: { type: "string", description: "Detailed reason for appeal (min 10 chars)" },
        metadata: { type: "object", description: "Additional appeal metadata" },
      },
      required: ["decisionId", "appellantId", "reason"],
    },
  },
  {
    name: "review_appeal",
    description: "Review and resolve an appeal",
    inputSchema: {
      type: "object",
      properties: {
        appealId: { type: "string", description: "ID of the appeal" },
        reviewerId: { type: "string", description: "ID of the reviewing agent" },
        resolution: {
          type: "string",
          enum: ["upheld", "overturned", "dismissed"],
          description: "Appeal resolution",
        },
        explanation: { type: "string", description: "Explanation for the resolution" },
      },
      required: ["appealId", "reviewerId", "resolution", "explanation"],
    },
  },

  // Quorum Management Tools
  {
    name: "get_quorum_status",
    description: "Get current quorum status for a proposal or proposal type",
    inputSchema: {
      type: "object",
      properties: {
        proposalId: { type: "string", description: "Specific proposal ID (optional)" },
        proposalType: {
          type: "string",
          enum: ["policy", "agent_action", "resource_allocation", "emergency", "constitutional"],
          description: "Proposal type to check requirements",
        },
      },
    },
  },
  {
    name: "set_quorum_requirements",
    description: "Set quorum requirements for a proposal type",
    inputSchema: {
      type: "object",
      properties: {
        proposalType: {
          type: "string",
          enum: ["policy", "agent_action", "resource_allocation", "emergency", "constitutional"],
        },
        minParticipation: { type: "number", description: "Minimum participation rate (0-1)" },
        minApprovalRate: { type: "number", description: "Minimum approval rate (0-1)" },
        requiresUnanimity: { type: "boolean", description: "Requires unanimous approval" },
        vetoThreshold: { type: "number", description: "Number of vetos to block" },
      },
      required: ["proposalType", "minParticipation", "minApprovalRate"],
    },
  },

  // Voting Weights Tools
  {
    name: "get_voting_weights",
    description: "Get voting weights for agents",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Specific agent ID (optional)" },
        role: {
          type: "string",
          enum: ["archon", "strategos", "logistes", "nomothetes", "ephoros"],
          description: "Filter by role",
        },
      },
    },
  },
  {
    name: "set_voting_weight",
    description: "Set voting weight for an agent",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "ID of the agent" },
        weight: { type: "number", description: "New voting weight (0-10)" },
        reason: { type: "string", description: "Reason for weight change" },
      },
      required: ["agentId", "weight"],
    },
  },

  // Governance Metrics Tool
  {
    name: "get_governance_metrics",
    description: "Get comprehensive governance metrics and statistics",
    inputSchema: {
      type: "object",
      properties: {
        fromDate: { type: "string", description: "Start date for metrics (ISO format)" },
        toDate: { type: "string", description: "End date for metrics (ISO format)" },
      },
    },
  },
];

// =============================================================================
// In-Memory Storage
// =============================================================================

const proposals: Map<string, Proposal> = new Map();
const votes: Map<string, Vote> = new Map();
const agents: Map<string, Agent> = new Map();
const decisions: Map<string, Decision> = new Map();
const appeals: Map<string, Appeal> = new Map();
const quorumRequirements: Map<ProposalType, QuorumRequirement> = new Map();

// Initialize default quorum requirements
function initializeDefaults() {
  const defaults: QuorumRequirement[] = [
    { proposalType: "policy", minParticipation: 0.5, minApprovalRate: 0.6, requiresUnanimity: false, vetoThreshold: 2 },
    { proposalType: "agent_action", minParticipation: 0.3, minApprovalRate: 0.5, requiresUnanimity: false, vetoThreshold: 1 },
    { proposalType: "resource_allocation", minParticipation: 0.4, minApprovalRate: 0.6, requiresUnanimity: false, vetoThreshold: 2 },
    { proposalType: "emergency", minParticipation: 0.2, minApprovalRate: 0.5, requiresUnanimity: false, vetoThreshold: 1 },
    { proposalType: "constitutional", minParticipation: 0.8, minApprovalRate: 0.75, requiresUnanimity: false, vetoThreshold: 1 },
  ];
  defaults.forEach((req) => quorumRequirements.set(req.proposalType, req));
}

initializeDefaults();

// =============================================================================
// Helper Functions
// =============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getVotesForProposal(proposalId: string): Vote[] {
  return Array.from(votes.values()).filter((v) => v.proposalId === proposalId);
}

function calculateVotingResults(proposalId: string) {
  const proposalVotes = getVotesForProposal(proposalId);
  const results = {
    approve: 0,
    reject: 0,
    abstain: 0,
    veto: 0,
    totalWeight: 0,
    voterCount: proposalVotes.length,
  };

  for (const vote of proposalVotes) {
    results[vote.choice] += vote.weight;
    results.totalWeight += vote.weight;
  }

  return results;
}

function checkQuorum(proposalId: string): { met: boolean; participation: number; approvalRate: number } {
  const proposal = proposals.get(proposalId);
  if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);

  const requirement = quorumRequirements.get(proposal.type);
  if (!requirement) throw new Error(`No quorum requirements for type: ${proposal.type}`);

  const activeAgents = Array.from(agents.values()).filter((a) => a.isActive);
  const totalPossibleWeight = activeAgents.reduce((sum, a) => sum + a.votingWeight, 0);
  const results = calculateVotingResults(proposalId);

  const participation = totalPossibleWeight > 0 ? results.totalWeight / totalPossibleWeight : 0;
  const approvalRate = results.totalWeight > 0 ? results.approve / results.totalWeight : 0;

  const vetoBlocked = results.veto >= requirement.vetoThreshold;
  const participationMet = participation >= requirement.minParticipation;
  const approvalMet = approvalRate >= requirement.minApprovalRate;

  return {
    met: participationMet && approvalMet && !vetoBlocked,
    participation,
    approvalRate,
  };
}

// =============================================================================
// Tool Handlers
// =============================================================================

// Pentarchy Voting Handlers

async function createProposal(params: z.infer<typeof CreateProposalSchema>): Promise<Proposal> {
  const id = generateId("prop");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (params.expiresInHours ?? 72) * 60 * 60 * 1000);

  const requirement = quorumRequirements.get(params.type);

  const proposal: Proposal = {
    id,
    title: params.title,
    description: params.description,
    type: params.type,
    status: "active",
    proposerId: params.proposerId,
    createdAt: now,
    expiresAt,
    quorumRequired: requirement?.minParticipation ?? 0.5,
    superMajorityRequired: params.type === "constitutional",
    metadata: params.metadata ?? {},
  };

  proposals.set(id, proposal);
  return proposal;
}

async function castVote(params: z.infer<typeof CastVoteSchema>): Promise<Vote> {
  const proposal = proposals.get(params.proposalId);
  if (!proposal) throw new Error(`Proposal not found: ${params.proposalId}`);
  if (proposal.status !== "active") throw new Error(`Proposal is not active: ${proposal.status}`);
  if (new Date() > proposal.expiresAt) throw new Error("Proposal has expired");

  const voter = agents.get(params.voterId);
  if (!voter) throw new Error(`Agent not found: ${params.voterId}`);
  if (!voter.isActive) throw new Error("Agent is not active");

  // Check for existing vote
  const existingVote = Array.from(votes.values()).find(
    (v) => v.proposalId === params.proposalId && v.voterId === params.voterId
  );
  if (existingVote) throw new Error("Agent has already voted on this proposal");

  // Veto power check (only archon and ephoros can veto)
  if (params.choice === "veto" && !["archon", "ephoros"].includes(voter.role)) {
    throw new Error(`Role ${voter.role} cannot cast veto votes`);
  }

  const id = generateId("vote");
  const vote: Vote = {
    id,
    proposalId: params.proposalId,
    voterId: params.voterId,
    voterRole: voter.role,
    choice: params.choice,
    weight: voter.votingWeight,
    reason: params.reason,
    timestamp: new Date(),
  };

  votes.set(id, vote);

  // Update voter's last active time
  voter.lastActiveAt = new Date();

  return vote;
}

async function getVotingResults(params: z.infer<typeof GetVotingResultsSchema>) {
  const proposal = proposals.get(params.proposalId);
  if (!proposal) throw new Error(`Proposal not found: ${params.proposalId}`);

  const results = calculateVotingResults(params.proposalId);
  const quorumStatus = checkQuorum(params.proposalId);
  const proposalVotes = getVotesForProposal(params.proposalId);

  return {
    proposal: {
      id: proposal.id,
      title: proposal.title,
      type: proposal.type,
      status: proposal.status,
      expiresAt: proposal.expiresAt,
    },
    results,
    quorum: quorumStatus,
    votes: proposalVotes.map((v) => ({
      voterId: v.voterId,
      voterRole: v.voterRole,
      choice: v.choice,
      weight: v.weight,
      timestamp: v.timestamp,
    })),
  };
}

// Agent Governance Handlers

async function registerAgent(params: z.infer<typeof RegisterAgentSchema>): Promise<Agent> {
  const id = generateId("agent");
  const now = new Date();

  const agent: Agent = {
    id,
    name: params.name,
    role: params.role,
    permissions: params.permissions ?? [],
    votingWeight: params.initialWeight ?? 1,
    isActive: true,
    registeredAt: now,
    lastActiveAt: now,
    metadata: params.metadata ?? {},
  };

  agents.set(id, agent);
  return agent;
}

async function updateAgentPermissions(params: z.infer<typeof UpdateAgentPermissionsSchema>): Promise<Agent> {
  const agent = agents.get(params.agentId);
  if (!agent) throw new Error(`Agent not found: ${params.agentId}`);

  switch (params.action) {
    case "set":
      agent.permissions = params.permissions;
      break;
    case "add":
      agent.permissions = [...new Set([...agent.permissions, ...params.permissions])];
      break;
    case "remove":
      agent.permissions = agent.permissions.filter((p) => !params.permissions.includes(p));
      break;
  }

  return agent;
}

async function deregisterAgent(params: z.infer<typeof DeregisterAgentSchema>) {
  const agent = agents.get(params.agentId);
  if (!agent) throw new Error(`Agent not found: ${params.agentId}`);

  agent.isActive = false;

  return {
    deregistered: true,
    agentId: params.agentId,
    agentName: agent.name,
    reason: params.reason ?? "No reason provided",
    timestamp: new Date().toISOString(),
  };
}

// Decision Tracking Handlers

async function listDecisions(params: z.infer<typeof ListDecisionsSchema>) {
  let results = Array.from(decisions.values());

  if (params.status && params.status !== "all") {
    results = results.filter((d) => d.outcome === params.status);
  }

  if (params.fromDate) {
    const from = new Date(params.fromDate);
    results = results.filter((d) => d.decidedAt >= from);
  }

  if (params.toDate) {
    const to = new Date(params.toDate);
    results = results.filter((d) => d.decidedAt <= to);
  }

  results.sort((a, b) => b.decidedAt.getTime() - a.decidedAt.getTime());

  return results.slice(0, params.limit ?? 50).map((d) => ({
    id: d.id,
    proposalId: d.proposalId,
    outcome: d.outcome,
    quorumMet: d.quorumMet,
    decidedAt: d.decidedAt,
    finalVotes: d.finalVotes,
  }));
}

async function getDecisionHistory(params: z.infer<typeof GetDecisionHistorySchema>) {
  const decision = decisions.get(params.decisionId);
  if (!decision) throw new Error(`Decision not found: ${params.decisionId}`);

  const proposal = proposals.get(decision.proposalId);

  return {
    decision,
    proposal: proposal
      ? {
          id: proposal.id,
          title: proposal.title,
          description: proposal.description,
          type: proposal.type,
          proposerId: proposal.proposerId,
          createdAt: proposal.createdAt,
        }
      : null,
    relatedAppeals: Array.from(appeals.values()).filter((a) => a.decisionId === params.decisionId),
  };
}

// Appeals Handlers

async function submitAppeal(params: z.infer<typeof SubmitAppealSchema>): Promise<Appeal> {
  const decision = decisions.get(params.decisionId);
  if (!decision) throw new Error(`Decision not found: ${params.decisionId}`);

  const appellant = agents.get(params.appellantId);
  if (!appellant) throw new Error(`Agent not found: ${params.appellantId}`);

  // Check for existing pending appeal
  const existingAppeal = Array.from(appeals.values()).find(
    (a) => a.decisionId === params.decisionId && a.status === "pending"
  );
  if (existingAppeal) throw new Error("An appeal is already pending for this decision");

  const id = generateId("appeal");
  const appeal: Appeal = {
    id,
    decisionId: params.decisionId,
    appellantId: params.appellantId,
    reason: params.reason,
    status: "pending",
    submittedAt: new Date(),
    metadata: params.metadata ?? {},
  };

  appeals.set(id, appeal);

  // Update proposal status
  const proposal = proposals.get(decision.proposalId);
  if (proposal) {
    proposal.status = "appealed";
  }

  return appeal;
}

async function reviewAppeal(params: z.infer<typeof ReviewAppealSchema>) {
  const appeal = appeals.get(params.appealId);
  if (!appeal) throw new Error(`Appeal not found: ${params.appealId}`);
  if (appeal.status !== "pending" && appeal.status !== "under_review") {
    throw new Error(`Appeal cannot be reviewed: status is ${appeal.status}`);
  }

  const reviewer = agents.get(params.reviewerId);
  if (!reviewer) throw new Error(`Reviewer not found: ${params.reviewerId}`);

  // Only archon, ephoros, or nomothetes can review appeals
  if (!["archon", "ephoros", "nomothetes"].includes(reviewer.role)) {
    throw new Error(`Role ${reviewer.role} cannot review appeals`);
  }

  appeal.status = params.resolution;
  appeal.reviewedAt = new Date();
  appeal.reviewerId = params.reviewerId;
  appeal.resolution = params.explanation;

  // If overturned, update the decision
  if (params.resolution === "overturned") {
    const decision = decisions.get(appeal.decisionId);
    if (decision) {
      decision.outcome = decision.outcome === "approved" ? "rejected" : "approved";
      decision.history.push({
        timestamp: new Date(),
        event: "appeal_overturned",
        actor: params.reviewerId,
        details: { explanation: params.explanation },
      });
    }
  }

  return appeal;
}

// Quorum Management Handlers

async function getQuorumStatus(params: z.infer<typeof GetQuorumStatusSchema>) {
  if (params.proposalId) {
    const proposal = proposals.get(params.proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${params.proposalId}`);

    const quorumStatus = checkQuorum(params.proposalId);
    const requirement = quorumRequirements.get(proposal.type);

    return {
      proposalId: params.proposalId,
      proposalType: proposal.type,
      requirement,
      current: quorumStatus,
      activeAgentCount: Array.from(agents.values()).filter((a) => a.isActive).length,
    };
  }

  if (params.proposalType) {
    const requirement = quorumRequirements.get(params.proposalType);
    return {
      proposalType: params.proposalType,
      requirement,
      activeAgentCount: Array.from(agents.values()).filter((a) => a.isActive).length,
    };
  }

  // Return all requirements
  return {
    requirements: Object.fromEntries(quorumRequirements),
    activeAgentCount: Array.from(agents.values()).filter((a) => a.isActive).length,
  };
}

async function setQuorumRequirements(params: z.infer<typeof SetQuorumRequirementsSchema>) {
  const requirement: QuorumRequirement = {
    proposalType: params.proposalType,
    minParticipation: params.minParticipation,
    minApprovalRate: params.minApprovalRate,
    requiresUnanimity: params.requiresUnanimity ?? false,
    vetoThreshold: params.vetoThreshold ?? 1,
  };

  quorumRequirements.set(params.proposalType, requirement);

  return {
    updated: true,
    requirement,
  };
}

// Voting Weights Handlers

async function getVotingWeights(params: z.infer<typeof GetVotingWeightsSchema>) {
  let agentList = Array.from(agents.values());

  if (params.agentId) {
    const agent = agents.get(params.agentId);
    if (!agent) throw new Error(`Agent not found: ${params.agentId}`);
    return {
      agentId: agent.id,
      name: agent.name,
      role: agent.role,
      weight: agent.votingWeight,
      isActive: agent.isActive,
    };
  }

  if (params.role) {
    agentList = agentList.filter((a) => a.role === params.role);
  }

  return {
    agents: agentList.map((a) => ({
      agentId: a.id,
      name: a.name,
      role: a.role,
      weight: a.votingWeight,
      isActive: a.isActive,
    })),
    totalWeight: agentList.reduce((sum, a) => sum + (a.isActive ? a.votingWeight : 0), 0),
    activeCount: agentList.filter((a) => a.isActive).length,
  };
}

async function setVotingWeight(params: z.infer<typeof SetVotingWeightSchema>) {
  const agent = agents.get(params.agentId);
  if (!agent) throw new Error(`Agent not found: ${params.agentId}`);

  const previousWeight = agent.votingWeight;
  agent.votingWeight = params.weight;

  return {
    agentId: agent.id,
    name: agent.name,
    previousWeight,
    newWeight: params.weight,
    reason: params.reason ?? "Administrative adjustment",
    timestamp: new Date().toISOString(),
  };
}

// Governance Metrics Handler

async function getGovernanceMetrics(params: z.infer<typeof GetGovernanceMetricsSchema>) {
  let proposalList = Array.from(proposals.values());
  let decisionList = Array.from(decisions.values());
  let voteList = Array.from(votes.values());
  let appealList = Array.from(appeals.values());

  if (params.fromDate) {
    const from = new Date(params.fromDate);
    proposalList = proposalList.filter((p) => p.createdAt >= from);
    decisionList = decisionList.filter((d) => d.decidedAt >= from);
    voteList = voteList.filter((v) => v.timestamp >= from);
    appealList = appealList.filter((a) => a.submittedAt >= from);
  }

  if (params.toDate) {
    const to = new Date(params.toDate);
    proposalList = proposalList.filter((p) => p.createdAt <= to);
    decisionList = decisionList.filter((d) => d.decidedAt <= to);
    voteList = voteList.filter((v) => v.timestamp <= to);
    appealList = appealList.filter((a) => a.submittedAt <= to);
  }

  const agentList = Array.from(agents.values());

  // Calculate metrics
  const proposalsByType: Record<ProposalType, number> = {
    policy: 0,
    agent_action: 0,
    resource_allocation: 0,
    emergency: 0,
    constitutional: 0,
  };
  proposalList.forEach((p) => proposalsByType[p.type]++);

  const proposalsByStatus: Record<ProposalStatus, number> = {
    draft: 0,
    active: 0,
    passed: 0,
    rejected: 0,
    expired: 0,
    appealed: 0,
  };
  proposalList.forEach((p) => proposalsByStatus[p.status]++);

  const votesByChoice: Record<VoteChoice, number> = {
    approve: 0,
    reject: 0,
    abstain: 0,
    veto: 0,
  };
  voteList.forEach((v) => votesByChoice[v.choice]++);

  const agentsByRole: Record<PentarchyRole, number> = {
    archon: 0,
    strategos: 0,
    logistes: 0,
    nomothetes: 0,
    ephoros: 0,
  };
  agentList.forEach((a) => agentsByRole[a.role]++);

  return {
    summary: {
      totalProposals: proposalList.length,
      totalDecisions: decisionList.length,
      totalVotes: voteList.length,
      totalAppeals: appealList.length,
      totalAgents: agentList.length,
      activeAgents: agentList.filter((a) => a.isActive).length,
    },
    proposals: {
      byType: proposalsByType,
      byStatus: proposalsByStatus,
    },
    decisions: {
      approved: decisionList.filter((d) => d.outcome === "approved").length,
      rejected: decisionList.filter((d) => d.outcome === "rejected").length,
      quorumMetRate: decisionList.length > 0
        ? decisionList.filter((d) => d.quorumMet).length / decisionList.length
        : 0,
    },
    votes: {
      byChoice: votesByChoice,
      averageWeightPerVote: voteList.length > 0
        ? voteList.reduce((sum, v) => sum + v.weight, 0) / voteList.length
        : 0,
    },
    appeals: {
      pending: appealList.filter((a) => a.status === "pending").length,
      underReview: appealList.filter((a) => a.status === "under_review").length,
      upheld: appealList.filter((a) => a.status === "upheld").length,
      overturned: appealList.filter((a) => a.status === "overturned").length,
      dismissed: appealList.filter((a) => a.status === "dismissed").length,
    },
    agents: {
      byRole: agentsByRole,
      totalVotingWeight: agentList.filter((a) => a.isActive).reduce((sum, a) => sum + a.votingWeight, 0),
    },
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "kosmos-governance-mcp",
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
    let result;

    switch (name) {
      // Pentarchy Voting
      case "create_proposal":
        result = await createProposal(CreateProposalSchema.parse(args));
        break;
      case "cast_vote":
        result = await castVote(CastVoteSchema.parse(args));
        break;
      case "get_voting_results":
        result = await getVotingResults(GetVotingResultsSchema.parse(args));
        break;

      // Agent Governance
      case "register_agent":
        result = await registerAgent(RegisterAgentSchema.parse(args));
        break;
      case "update_agent_permissions":
        result = await updateAgentPermissions(UpdateAgentPermissionsSchema.parse(args));
        break;
      case "deregister_agent":
        result = await deregisterAgent(DeregisterAgentSchema.parse(args));
        break;

      // Decision Tracking
      case "list_decisions":
        result = await listDecisions(ListDecisionsSchema.parse(args ?? {}));
        break;
      case "get_decision_history":
        result = await getDecisionHistory(GetDecisionHistorySchema.parse(args));
        break;

      // Appeals
      case "submit_appeal":
        result = await submitAppeal(SubmitAppealSchema.parse(args));
        break;
      case "review_appeal":
        result = await reviewAppeal(ReviewAppealSchema.parse(args));
        break;

      // Quorum Management
      case "get_quorum_status":
        result = await getQuorumStatus(GetQuorumStatusSchema.parse(args ?? {}));
        break;
      case "set_quorum_requirements":
        result = await setQuorumRequirements(SetQuorumRequirementsSchema.parse(args));
        break;

      // Voting Weights
      case "get_voting_weights":
        result = await getVotingWeights(GetVotingWeightsSchema.parse(args ?? {}));
        break;
      case "set_voting_weight":
        result = await setVotingWeight(SetVotingWeightSchema.parse(args));
        break;

      // Governance Metrics
      case "get_governance_metrics":
        result = await getGovernanceMetrics(GetGovernanceMetricsSchema.parse(args ?? {}));
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
  console.error("KOSMOS Governance MCP Server started");
}

main().catch(console.error);
