/**
 * Linear MCP Server
 *
 * Provides Linear issue tracking for KOSMOS agents.
 * Features:
 * - Create, update, and search issues
 * - Manage projects and cycles
 * - Handle comments and attachments
 * - Team and user operations
 * - Workflow state management
 *
 * Authentication: Uses Linear API Key.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { LinearClient } from "@linear/sdk";

// =============================================================================
// Configuration
// =============================================================================

const config = {
  apiKey: process.env.LINEAR_API_KEY || "",
};

const linear = new LinearClient({ apiKey: config.apiKey });

// =============================================================================
// Tool Definitions
// =============================================================================

const TOOLS: Tool[] = [
  {
    name: "search_issues",
    description: "Search for issues across the workspace.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query text",
        },
        teamId: {
          type: "string",
          description: "Filter by team ID",
        },
        projectId: {
          type: "string",
          description: "Filter by project ID",
        },
        stateId: {
          type: "string",
          description: "Filter by workflow state ID",
        },
        assigneeId: {
          type: "string",
          description: "Filter by assignee ID",
        },
        labelIds: {
          type: "array",
          items: { type: "string" },
          description: "Filter by label IDs",
        },
        priority: {
          type: "number",
          description: "Filter by priority (0=none, 1=urgent, 2=high, 3=medium, 4=low)",
        },
        first: {
          type: "number",
          description: "Number of results to return",
        },
      },
    },
  },
  {
    name: "get_issue",
    description: "Get a specific issue by ID or identifier.",
    inputSchema: {
      type: "object",
      properties: {
        issueId: {
          type: "string",
          description: "Issue ID (UUID) or identifier (e.g., 'ENG-123')",
        },
      },
      required: ["issueId"],
    },
  },
  {
    name: "create_issue",
    description: "Create a new issue.",
    inputSchema: {
      type: "object",
      properties: {
        teamId: {
          type: "string",
          description: "Team ID to create the issue in",
        },
        title: {
          type: "string",
          description: "Issue title",
        },
        description: {
          type: "string",
          description: "Issue description (markdown supported)",
        },
        priority: {
          type: "number",
          description: "Priority (0=none, 1=urgent, 2=high, 3=medium, 4=low)",
        },
        stateId: {
          type: "string",
          description: "Workflow state ID",
        },
        assigneeId: {
          type: "string",
          description: "Assignee user ID",
        },
        projectId: {
          type: "string",
          description: "Project ID",
        },
        cycleId: {
          type: "string",
          description: "Cycle ID",
        },
        labelIds: {
          type: "array",
          items: { type: "string" },
          description: "Label IDs to add",
        },
        estimate: {
          type: "number",
          description: "Estimate points",
        },
        dueDate: {
          type: "string",
          description: "Due date (YYYY-MM-DD format)",
        },
        parentId: {
          type: "string",
          description: "Parent issue ID (for sub-issues)",
        },
      },
      required: ["teamId", "title"],
    },
  },
  {
    name: "update_issue",
    description: "Update an existing issue.",
    inputSchema: {
      type: "object",
      properties: {
        issueId: {
          type: "string",
          description: "Issue ID to update",
        },
        title: {
          type: "string",
          description: "New title",
        },
        description: {
          type: "string",
          description: "New description",
        },
        priority: {
          type: "number",
          description: "New priority",
        },
        stateId: {
          type: "string",
          description: "New workflow state ID",
        },
        assigneeId: {
          type: "string",
          description: "New assignee ID (null to unassign)",
        },
        projectId: {
          type: "string",
          description: "New project ID",
        },
        cycleId: {
          type: "string",
          description: "New cycle ID",
        },
        labelIds: {
          type: "array",
          items: { type: "string" },
          description: "New label IDs (replaces existing)",
        },
        estimate: {
          type: "number",
          description: "New estimate",
        },
        dueDate: {
          type: "string",
          description: "New due date",
        },
      },
      required: ["issueId"],
    },
  },
  {
    name: "delete_issue",
    description: "Delete (archive) an issue.",
    inputSchema: {
      type: "object",
      properties: {
        issueId: {
          type: "string",
          description: "Issue ID to delete",
        },
      },
      required: ["issueId"],
    },
  },
  {
    name: "add_comment",
    description: "Add a comment to an issue.",
    inputSchema: {
      type: "object",
      properties: {
        issueId: {
          type: "string",
          description: "Issue ID",
        },
        body: {
          type: "string",
          description: "Comment body (markdown supported)",
        },
      },
      required: ["issueId", "body"],
    },
  },
  {
    name: "get_comments",
    description: "Get comments on an issue.",
    inputSchema: {
      type: "object",
      properties: {
        issueId: {
          type: "string",
          description: "Issue ID",
        },
        first: {
          type: "number",
          description: "Number of comments to return",
        },
      },
      required: ["issueId"],
    },
  },
  {
    name: "list_teams",
    description: "List all teams in the workspace.",
    inputSchema: {
      type: "object",
      properties: {
        first: {
          type: "number",
          description: "Number of teams to return",
        },
      },
    },
  },
  {
    name: "get_team",
    description: "Get a team by ID or key.",
    inputSchema: {
      type: "object",
      properties: {
        teamId: {
          type: "string",
          description: "Team ID or key (e.g., 'ENG')",
        },
      },
      required: ["teamId"],
    },
  },
  {
    name: "list_projects",
    description: "List projects, optionally filtered by team.",
    inputSchema: {
      type: "object",
      properties: {
        teamId: {
          type: "string",
          description: "Filter by team ID",
        },
        first: {
          type: "number",
          description: "Number of projects to return",
        },
      },
    },
  },
  {
    name: "get_project",
    description: "Get a project by ID.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "Project ID",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "list_cycles",
    description: "List cycles for a team.",
    inputSchema: {
      type: "object",
      properties: {
        teamId: {
          type: "string",
          description: "Team ID",
        },
        first: {
          type: "number",
          description: "Number of cycles to return",
        },
      },
      required: ["teamId"],
    },
  },
  {
    name: "list_workflow_states",
    description: "List workflow states for a team.",
    inputSchema: {
      type: "object",
      properties: {
        teamId: {
          type: "string",
          description: "Team ID",
        },
      },
      required: ["teamId"],
    },
  },
  {
    name: "list_labels",
    description: "List labels, optionally filtered by team.",
    inputSchema: {
      type: "object",
      properties: {
        teamId: {
          type: "string",
          description: "Filter by team ID",
        },
        first: {
          type: "number",
          description: "Number of labels to return",
        },
      },
    },
  },
  {
    name: "list_users",
    description: "List users in the workspace.",
    inputSchema: {
      type: "object",
      properties: {
        first: {
          type: "number",
          description: "Number of users to return",
        },
      },
    },
  },
  {
    name: "get_user",
    description: "Get a user by ID.",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "User ID",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_viewer",
    description: "Get the currently authenticated user.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

function formatIssue(issue: any): any {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description,
    priority: issue.priority,
    priorityLabel: issue.priorityLabel,
    state: issue.state ? { id: issue.state.id, name: issue.state.name, color: issue.state.color } : null,
    assignee: issue.assignee ? { id: issue.assignee.id, name: issue.assignee.name } : null,
    project: issue.project ? { id: issue.project.id, name: issue.project.name } : null,
    cycle: issue.cycle ? { id: issue.cycle.id, name: issue.cycle.name } : null,
    labels: issue.labels?.nodes?.map((l: any) => ({ id: l.id, name: l.name, color: l.color })) || [],
    estimate: issue.estimate,
    dueDate: issue.dueDate,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    url: issue.url,
  };
}

// =============================================================================
// Tool Implementations
// =============================================================================

async function searchIssues(params: {
  query?: string;
  teamId?: string;
  projectId?: string;
  stateId?: string;
  assigneeId?: string;
  labelIds?: string[];
  priority?: number;
  first?: number;
}): Promise<any> {
  const filter: any = {};

  if (params.teamId) filter.team = { id: { eq: params.teamId } };
  if (params.projectId) filter.project = { id: { eq: params.projectId } };
  if (params.stateId) filter.state = { id: { eq: params.stateId } };
  if (params.assigneeId) filter.assignee = { id: { eq: params.assigneeId } };
  if (params.priority !== undefined) filter.priority = { eq: params.priority };
  if (params.labelIds?.length) filter.labels = { id: { in: params.labelIds } };

  let issues;
  if (params.query) {
    issues = await linear.issueSearch(params.query, {
      filter,
      first: params.first || 25,
    });
  } else {
    issues = await linear.issues({
      filter,
      first: params.first || 25,
    });
  }

  const nodes = await Promise.all(
    issues.nodes.map(async (issue) => {
      const state = await issue.state;
      const assignee = await issue.assignee;
      const project = await issue.project;
      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        priority: issue.priority,
        priorityLabel: issue.priorityLabel,
        state: state ? { id: state.id, name: state.name } : null,
        assignee: assignee ? { id: assignee.id, name: assignee.name } : null,
        project: project ? { id: project.id, name: project.name } : null,
        url: issue.url,
      };
    })
  );

  return {
    issues: nodes,
    count: nodes.length,
  };
}

async function getIssue(params: { issueId: string }): Promise<any> {
  const issue = await linear.issue(params.issueId);
  const state = await issue.state;
  const assignee = await issue.assignee;
  const project = await issue.project;
  const cycle = await issue.cycle;
  const labels = await issue.labels();

  return formatIssue({
    ...issue,
    state,
    assignee,
    project,
    cycle,
    labels,
  });
}

async function createIssue(params: {
  teamId: string;
  title: string;
  description?: string;
  priority?: number;
  stateId?: string;
  assigneeId?: string;
  projectId?: string;
  cycleId?: string;
  labelIds?: string[];
  estimate?: number;
  dueDate?: string;
  parentId?: string;
}): Promise<any> {
  const issuePayload = await linear.createIssue({
    teamId: params.teamId,
    title: params.title,
    description: params.description,
    priority: params.priority,
    stateId: params.stateId,
    assigneeId: params.assigneeId,
    projectId: params.projectId,
    cycleId: params.cycleId,
    labelIds: params.labelIds,
    estimate: params.estimate,
    dueDate: params.dueDate,
    parentId: params.parentId,
  });

  const issue = await issuePayload.issue;
  if (!issue) {
    throw new Error("Failed to create issue");
  }

  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    url: issue.url,
  };
}

async function updateIssue(params: {
  issueId: string;
  title?: string;
  description?: string;
  priority?: number;
  stateId?: string;
  assigneeId?: string;
  projectId?: string;
  cycleId?: string;
  labelIds?: string[];
  estimate?: number;
  dueDate?: string;
}): Promise<any> {
  const { issueId, ...updateData } = params;

  const issuePayload = await linear.updateIssue(issueId, updateData);
  const issue = await issuePayload.issue;

  if (!issue) {
    throw new Error("Failed to update issue");
  }

  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    updated: true,
  };
}

async function deleteIssue(params: { issueId: string }): Promise<any> {
  await linear.deleteIssue(params.issueId);
  return { deleted: true, issueId: params.issueId };
}

async function addComment(params: { issueId: string; body: string }): Promise<any> {
  const commentPayload = await linear.createComment({
    issueId: params.issueId,
    body: params.body,
  });

  const comment = await commentPayload.comment;
  if (!comment) {
    throw new Error("Failed to create comment");
  }

  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt,
  };
}

async function getComments(params: { issueId: string; first?: number }): Promise<any> {
  const issue = await linear.issue(params.issueId);
  const comments = await issue.comments({ first: params.first || 25 });

  const nodes = await Promise.all(
    comments.nodes.map(async (comment) => {
      const user = await comment.user;
      return {
        id: comment.id,
        body: comment.body,
        user: user ? { id: user.id, name: user.name } : null,
        createdAt: comment.createdAt,
      };
    })
  );

  return { comments: nodes };
}

async function listTeams(params: { first?: number }): Promise<any> {
  const teams = await linear.teams({ first: params.first || 50 });

  return {
    teams: teams.nodes.map((team) => ({
      id: team.id,
      key: team.key,
      name: team.name,
      description: team.description,
    })),
  };
}

async function getTeam(params: { teamId: string }): Promise<any> {
  const team = await linear.team(params.teamId);

  return {
    id: team.id,
    key: team.key,
    name: team.name,
    description: team.description,
    timezone: team.timezone,
  };
}

async function listProjects(params: { teamId?: string; first?: number }): Promise<any> {
  const filter = params.teamId ? { accessibleTeams: { id: { eq: params.teamId } } } : undefined;
  const projects = await linear.projects({ filter, first: params.first || 50 });

  return {
    projects: projects.nodes.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      state: project.state,
      progress: project.progress,
      targetDate: project.targetDate,
    })),
  };
}

async function getProject(params: { projectId: string }): Promise<any> {
  const project = await linear.project(params.projectId);

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    state: project.state,
    progress: project.progress,
    targetDate: project.targetDate,
    startDate: project.startDate,
    url: project.url,
  };
}

async function listCycles(params: { teamId: string; first?: number }): Promise<any> {
  const team = await linear.team(params.teamId);
  const cycles = await team.cycles({ first: params.first || 25 });

  return {
    cycles: cycles.nodes.map((cycle) => ({
      id: cycle.id,
      name: cycle.name,
      number: cycle.number,
      startsAt: cycle.startsAt,
      endsAt: cycle.endsAt,
      progress: cycle.progress,
    })),
  };
}

async function listWorkflowStates(params: { teamId: string }): Promise<any> {
  const team = await linear.team(params.teamId);
  const states = await team.states();

  return {
    states: states.nodes.map((state) => ({
      id: state.id,
      name: state.name,
      color: state.color,
      type: state.type,
      position: state.position,
    })),
  };
}

async function listLabels(params: { teamId?: string; first?: number }): Promise<any> {
  const filter = params.teamId ? { team: { id: { eq: params.teamId } } } : undefined;
  const labels = await linear.issueLabels({ filter, first: params.first || 100 });

  return {
    labels: labels.nodes.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description,
    })),
  };
}

async function listUsers(params: { first?: number }): Promise<any> {
  const users = await linear.users({ first: params.first || 50 });

  return {
    users: users.nodes.map((user) => ({
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      email: user.email,
      active: user.active,
      admin: user.admin,
    })),
  };
}

async function getUser(params: { userId: string }): Promise<any> {
  const user = await linear.user(params.userId);

  return {
    id: user.id,
    name: user.name,
    displayName: user.displayName,
    email: user.email,
    active: user.active,
    admin: user.admin,
    avatarUrl: user.avatarUrl,
  };
}

async function getViewer(): Promise<any> {
  const viewer = await linear.viewer;

  return {
    id: viewer.id,
    name: viewer.name,
    displayName: viewer.displayName,
    email: viewer.email,
    admin: viewer.admin,
  };
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new Server(
  {
    name: "linear-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case "search_issues":
        result = await searchIssues(args as any);
        break;
      case "get_issue":
        result = await getIssue(args as any);
        break;
      case "create_issue":
        result = await createIssue(args as any);
        break;
      case "update_issue":
        result = await updateIssue(args as any);
        break;
      case "delete_issue":
        result = await deleteIssue(args as any);
        break;
      case "add_comment":
        result = await addComment(args as any);
        break;
      case "get_comments":
        result = await getComments(args as any);
        break;
      case "list_teams":
        result = await listTeams(args as any);
        break;
      case "get_team":
        result = await getTeam(args as any);
        break;
      case "list_projects":
        result = await listProjects(args as any);
        break;
      case "get_project":
        result = await getProject(args as any);
        break;
      case "list_cycles":
        result = await listCycles(args as any);
        break;
      case "list_workflow_states":
        result = await listWorkflowStates(args as any);
        break;
      case "list_labels":
        result = await listLabels(args as any);
        break;
      case "list_users":
        result = await listUsers(args as any);
        break;
      case "get_user":
        result = await getUser(args as any);
        break;
      case "get_viewer":
        result = await getViewer();
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
          text: JSON.stringify({
            error: error.message,
          }),
        },
      ],
      isError: true,
    };
  }
});

// =============================================================================
// Main
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Linear MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
