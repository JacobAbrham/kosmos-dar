/**
 * Trello MCP Server - Board and card management for KOSMOS agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";

const config = {
  apiKey: process.env.TRELLO_API_KEY || "",
  token: process.env.TRELLO_TOKEN || "",
};

async function trelloRequest(method: string, path: string, body?: any): Promise<any> {
  const separator = path.includes("?") ? "&" : "?";
  const url = `https://api.trello.com/1${path}${separator}key=${config.apiKey}&token=${config.token}`;

  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };

  if (body && (method === "POST" || method === "PUT")) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);

  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText);
    throw new Error(`Trello API error: ${res.status} - ${error}`);
  }

  if (res.status === 204) {
    return { success: true };
  }

  return res.json();
}

const TOOLS: Tool[] = [
  // Boards
  {
    name: "list_boards",
    description: "List all boards for the authenticated user.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["all", "closed", "members", "open", "organization", "public", "starred"], description: "Filter boards" },
        fields: { type: "string", description: "Comma-separated list of fields to return" },
      },
    },
  },
  {
    name: "get_board",
    description: "Get details of a specific board.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string", description: "The ID of the board" },
        fields: { type: "string", description: "Comma-separated list of fields to return" },
      },
      required: ["boardId"],
    },
  },
  {
    name: "create_board",
    description: "Create a new board.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the board" },
        desc: { type: "string", description: "Description of the board" },
        defaultLists: { type: "boolean", description: "Create default lists (To Do, Doing, Done)" },
        defaultLabels: { type: "boolean", description: "Add default labels to the board" },
        idOrganization: { type: "string", description: "Organization ID to create the board in" },
        prefs_permissionLevel: { type: "string", enum: ["private", "org", "public"], description: "Permission level" },
        prefs_background: { type: "string", description: "Background color or image" },
      },
      required: ["name"],
    },
  },
  // Lists
  {
    name: "list_lists",
    description: "List all lists on a board.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string", description: "The ID of the board" },
        filter: { type: "string", enum: ["all", "closed", "none", "open"], description: "Filter lists" },
        fields: { type: "string", description: "Comma-separated list of fields to return" },
      },
      required: ["boardId"],
    },
  },
  {
    name: "create_list",
    description: "Create a new list on a board.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the list" },
        idBoard: { type: "string", description: "The ID of the board to create the list on" },
        pos: { type: "string", description: "Position of the list (top, bottom, or a positive number)" },
      },
      required: ["name", "idBoard"],
    },
  },
  {
    name: "archive_list",
    description: "Archive (close) a list.",
    inputSchema: {
      type: "object",
      properties: {
        listId: { type: "string", description: "The ID of the list to archive" },
      },
      required: ["listId"],
    },
  },
  // Cards
  {
    name: "list_cards",
    description: "List cards in a list or board.",
    inputSchema: {
      type: "object",
      properties: {
        listId: { type: "string", description: "The ID of the list (mutually exclusive with boardId)" },
        boardId: { type: "string", description: "The ID of the board (mutually exclusive with listId)" },
        filter: { type: "string", enum: ["all", "closed", "none", "open", "visible"], description: "Filter cards" },
        fields: { type: "string", description: "Comma-separated list of fields to return" },
      },
    },
  },
  {
    name: "get_card",
    description: "Get details of a specific card.",
    inputSchema: {
      type: "object",
      properties: {
        cardId: { type: "string", description: "The ID of the card" },
        fields: { type: "string", description: "Comma-separated list of fields to return" },
        attachments: { type: "boolean", description: "Include attachments" },
        checklists: { type: "string", enum: ["all", "none"], description: "Include checklists" },
        members: { type: "boolean", description: "Include members" },
      },
      required: ["cardId"],
    },
  },
  {
    name: "create_card",
    description: "Create a new card.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the card" },
        idList: { type: "string", description: "The ID of the list to create the card in" },
        desc: { type: "string", description: "Description of the card" },
        pos: { type: "string", description: "Position of the card (top, bottom, or a positive number)" },
        due: { type: "string", description: "Due date in ISO 8601 format" },
        dueComplete: { type: "boolean", description: "Whether the due date is complete" },
        idMembers: { type: "array", items: { type: "string" }, description: "Member IDs to add to the card" },
        idLabels: { type: "array", items: { type: "string" }, description: "Label IDs to add to the card" },
        urlSource: { type: "string", description: "URL to attach to the card" },
      },
      required: ["name", "idList"],
    },
  },
  {
    name: "update_card",
    description: "Update an existing card.",
    inputSchema: {
      type: "object",
      properties: {
        cardId: { type: "string", description: "The ID of the card to update" },
        name: { type: "string", description: "New name for the card" },
        desc: { type: "string", description: "New description for the card" },
        closed: { type: "boolean", description: "Whether the card is archived" },
        due: { type: "string", description: "Due date in ISO 8601 format" },
        dueComplete: { type: "boolean", description: "Whether the due date is complete" },
        pos: { type: "string", description: "Position of the card" },
      },
      required: ["cardId"],
    },
  },
  {
    name: "move_card",
    description: "Move a card to a different list.",
    inputSchema: {
      type: "object",
      properties: {
        cardId: { type: "string", description: "The ID of the card to move" },
        idList: { type: "string", description: "The ID of the list to move the card to" },
        idBoard: { type: "string", description: "The ID of the board to move the card to (optional, for cross-board moves)" },
        pos: { type: "string", description: "Position in the new list (top, bottom, or a positive number)" },
      },
      required: ["cardId", "idList"],
    },
  },
  {
    name: "delete_card",
    description: "Delete a card permanently.",
    inputSchema: {
      type: "object",
      properties: {
        cardId: { type: "string", description: "The ID of the card to delete" },
      },
      required: ["cardId"],
    },
  },
  // Comments
  {
    name: "add_comment",
    description: "Add a comment to a card.",
    inputSchema: {
      type: "object",
      properties: {
        cardId: { type: "string", description: "The ID of the card" },
        text: { type: "string", description: "The comment text" },
      },
      required: ["cardId", "text"],
    },
  },
  {
    name: "list_comments",
    description: "List comments on a card.",
    inputSchema: {
      type: "object",
      properties: {
        cardId: { type: "string", description: "The ID of the card" },
        limit: { type: "number", description: "Maximum number of comments to return" },
      },
      required: ["cardId"],
    },
  },
  // Members
  {
    name: "add_member",
    description: "Add a member to a card.",
    inputSchema: {
      type: "object",
      properties: {
        cardId: { type: "string", description: "The ID of the card" },
        memberId: { type: "string", description: "The ID of the member to add" },
      },
      required: ["cardId", "memberId"],
    },
  },
  {
    name: "remove_member",
    description: "Remove a member from a card.",
    inputSchema: {
      type: "object",
      properties: {
        cardId: { type: "string", description: "The ID of the card" },
        memberId: { type: "string", description: "The ID of the member to remove" },
      },
      required: ["cardId", "memberId"],
    },
  },
  {
    name: "list_members",
    description: "List members of a board.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string", description: "The ID of the board" },
        fields: { type: "string", description: "Comma-separated list of fields to return" },
      },
      required: ["boardId"],
    },
  },
  // Labels
  {
    name: "add_label",
    description: "Add a label to a card.",
    inputSchema: {
      type: "object",
      properties: {
        cardId: { type: "string", description: "The ID of the card" },
        labelId: { type: "string", description: "The ID of the label to add" },
      },
      required: ["cardId", "labelId"],
    },
  },
  {
    name: "list_labels",
    description: "List labels on a board.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string", description: "The ID of the board" },
        fields: { type: "string", description: "Comma-separated list of fields to return" },
        limit: { type: "number", description: "Maximum number of labels to return" },
      },
      required: ["boardId"],
    },
  },
  // Checklists
  {
    name: "create_checklist",
    description: "Create a checklist on a card.",
    inputSchema: {
      type: "object",
      properties: {
        cardId: { type: "string", description: "The ID of the card" },
        name: { type: "string", description: "Name of the checklist" },
        pos: { type: "string", description: "Position of the checklist (top, bottom, or a positive number)" },
        idChecklistSource: { type: "string", description: "ID of a checklist to copy" },
      },
      required: ["cardId", "name"],
    },
  },
  {
    name: "add_checklist_item",
    description: "Add an item to a checklist.",
    inputSchema: {
      type: "object",
      properties: {
        checklistId: { type: "string", description: "The ID of the checklist" },
        name: { type: "string", description: "Name of the checklist item" },
        pos: { type: "string", description: "Position of the item (top, bottom, or a positive number)" },
        checked: { type: "boolean", description: "Whether the item is checked" },
        due: { type: "string", description: "Due date for the item" },
        idMember: { type: "string", description: "Member ID to assign the item to" },
      },
      required: ["checklistId", "name"],
    },
  },
  // Search
  {
    name: "search",
    description: "Search Trello for cards, boards, members, and organizations.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        idBoards: { type: "string", description: "Comma-separated board IDs to search (or 'mine' for all your boards)" },
        idOrganizations: { type: "string", description: "Comma-separated organization IDs to search" },
        modelTypes: { type: "string", description: "Model types to return (actions, boards, cards, members, organizations)" },
        cards_limit: { type: "number", description: "Maximum number of cards to return" },
        boards_limit: { type: "number", description: "Maximum number of boards to return" },
        partial: { type: "boolean", description: "Allow partial matches" },
      },
      required: ["query"],
    },
  },
];

// Board functions
async function listBoards(params: { filter?: string; fields?: string }): Promise<any> {
  const query: string[] = [];
  if (params.filter) query.push(`filter=${params.filter}`);
  if (params.fields) query.push(`fields=${params.fields}`);
  const queryStr = query.length > 0 ? `?${query.join("&")}` : "";
  return trelloRequest("GET", `/members/me/boards${queryStr}`);
}

async function getBoard(params: { boardId: string; fields?: string }): Promise<any> {
  const query: string[] = [];
  if (params.fields) query.push(`fields=${params.fields}`);
  const queryStr = query.length > 0 ? `?${query.join("&")}` : "";
  return trelloRequest("GET", `/boards/${params.boardId}${queryStr}`);
}

async function createBoard(params: {
  name: string;
  desc?: string;
  defaultLists?: boolean;
  defaultLabels?: boolean;
  idOrganization?: string;
  prefs_permissionLevel?: string;
  prefs_background?: string;
}): Promise<any> {
  const body: any = { name: params.name };
  if (params.desc) body.desc = params.desc;
  if (params.defaultLists !== undefined) body.defaultLists = params.defaultLists;
  if (params.defaultLabels !== undefined) body.defaultLabels = params.defaultLabels;
  if (params.idOrganization) body.idOrganization = params.idOrganization;
  if (params.prefs_permissionLevel) body.prefs_permissionLevel = params.prefs_permissionLevel;
  if (params.prefs_background) body.prefs_background = params.prefs_background;
  return trelloRequest("POST", "/boards", body);
}

// List functions
async function listLists(params: { boardId: string; filter?: string; fields?: string }): Promise<any> {
  const query: string[] = [];
  if (params.filter) query.push(`filter=${params.filter}`);
  if (params.fields) query.push(`fields=${params.fields}`);
  const queryStr = query.length > 0 ? `?${query.join("&")}` : "";
  return trelloRequest("GET", `/boards/${params.boardId}/lists${queryStr}`);
}

async function createList(params: { name: string; idBoard: string; pos?: string }): Promise<any> {
  const body: any = { name: params.name, idBoard: params.idBoard };
  if (params.pos) body.pos = params.pos;
  return trelloRequest("POST", "/lists", body);
}

async function archiveList(params: { listId: string }): Promise<any> {
  return trelloRequest("PUT", `/lists/${params.listId}/closed`, { value: true });
}

// Card functions
async function listCards(params: { listId?: string; boardId?: string; filter?: string; fields?: string }): Promise<any> {
  const query: string[] = [];
  if (params.filter) query.push(`filter=${params.filter}`);
  if (params.fields) query.push(`fields=${params.fields}`);
  const queryStr = query.length > 0 ? `?${query.join("&")}` : "";

  if (params.listId) {
    return trelloRequest("GET", `/lists/${params.listId}/cards${queryStr}`);
  } else if (params.boardId) {
    return trelloRequest("GET", `/boards/${params.boardId}/cards${queryStr}`);
  } else {
    throw new Error("Either listId or boardId is required");
  }
}

async function getCard(params: {
  cardId: string;
  fields?: string;
  attachments?: boolean;
  checklists?: string;
  members?: boolean;
}): Promise<any> {
  const query: string[] = [];
  if (params.fields) query.push(`fields=${params.fields}`);
  if (params.attachments !== undefined) query.push(`attachments=${params.attachments}`);
  if (params.checklists) query.push(`checklists=${params.checklists}`);
  if (params.members !== undefined) query.push(`members=${params.members}`);
  const queryStr = query.length > 0 ? `?${query.join("&")}` : "";
  return trelloRequest("GET", `/cards/${params.cardId}${queryStr}`);
}

async function createCard(params: {
  name: string;
  idList: string;
  desc?: string;
  pos?: string;
  due?: string;
  dueComplete?: boolean;
  idMembers?: string[];
  idLabels?: string[];
  urlSource?: string;
}): Promise<any> {
  const body: any = { name: params.name, idList: params.idList };
  if (params.desc) body.desc = params.desc;
  if (params.pos) body.pos = params.pos;
  if (params.due) body.due = params.due;
  if (params.dueComplete !== undefined) body.dueComplete = params.dueComplete;
  if (params.idMembers) body.idMembers = params.idMembers.join(",");
  if (params.idLabels) body.idLabels = params.idLabels.join(",");
  if (params.urlSource) body.urlSource = params.urlSource;
  return trelloRequest("POST", "/cards", body);
}

async function updateCard(params: {
  cardId: string;
  name?: string;
  desc?: string;
  closed?: boolean;
  due?: string;
  dueComplete?: boolean;
  pos?: string;
}): Promise<any> {
  const body: any = {};
  if (params.name) body.name = params.name;
  if (params.desc !== undefined) body.desc = params.desc;
  if (params.closed !== undefined) body.closed = params.closed;
  if (params.due !== undefined) body.due = params.due;
  if (params.dueComplete !== undefined) body.dueComplete = params.dueComplete;
  if (params.pos) body.pos = params.pos;
  return trelloRequest("PUT", `/cards/${params.cardId}`, body);
}

async function moveCard(params: { cardId: string; idList: string; idBoard?: string; pos?: string }): Promise<any> {
  const body: any = { idList: params.idList };
  if (params.idBoard) body.idBoard = params.idBoard;
  if (params.pos) body.pos = params.pos;
  return trelloRequest("PUT", `/cards/${params.cardId}`, body);
}

async function deleteCard(params: { cardId: string }): Promise<any> {
  await trelloRequest("DELETE", `/cards/${params.cardId}`);
  return { cardId: params.cardId, deleted: true };
}

// Comment functions
async function addComment(params: { cardId: string; text: string }): Promise<any> {
  return trelloRequest("POST", `/cards/${params.cardId}/actions/comments`, { text: params.text });
}

async function listComments(params: { cardId: string; limit?: number }): Promise<any> {
  const query: string[] = ["filter=commentCard"];
  if (params.limit) query.push(`limit=${params.limit}`);
  return trelloRequest("GET", `/cards/${params.cardId}/actions?${query.join("&")}`);
}

// Member functions
async function addMember(params: { cardId: string; memberId: string }): Promise<any> {
  return trelloRequest("POST", `/cards/${params.cardId}/idMembers`, { value: params.memberId });
}

async function removeMember(params: { cardId: string; memberId: string }): Promise<any> {
  await trelloRequest("DELETE", `/cards/${params.cardId}/idMembers/${params.memberId}`);
  return { cardId: params.cardId, memberId: params.memberId, removed: true };
}

async function listMembers(params: { boardId: string; fields?: string }): Promise<any> {
  const query: string[] = [];
  if (params.fields) query.push(`fields=${params.fields}`);
  const queryStr = query.length > 0 ? `?${query.join("&")}` : "";
  return trelloRequest("GET", `/boards/${params.boardId}/members${queryStr}`);
}

// Label functions
async function addLabel(params: { cardId: string; labelId: string }): Promise<any> {
  return trelloRequest("POST", `/cards/${params.cardId}/idLabels`, { value: params.labelId });
}

async function listLabels(params: { boardId: string; fields?: string; limit?: number }): Promise<any> {
  const query: string[] = [];
  if (params.fields) query.push(`fields=${params.fields}`);
  if (params.limit) query.push(`limit=${params.limit}`);
  const queryStr = query.length > 0 ? `?${query.join("&")}` : "";
  return trelloRequest("GET", `/boards/${params.boardId}/labels${queryStr}`);
}

// Checklist functions
async function createChecklist(params: {
  cardId: string;
  name: string;
  pos?: string;
  idChecklistSource?: string;
}): Promise<any> {
  const body: any = { idCard: params.cardId, name: params.name };
  if (params.pos) body.pos = params.pos;
  if (params.idChecklistSource) body.idChecklistSource = params.idChecklistSource;
  return trelloRequest("POST", "/checklists", body);
}

async function addChecklistItem(params: {
  checklistId: string;
  name: string;
  pos?: string;
  checked?: boolean;
  due?: string;
  idMember?: string;
}): Promise<any> {
  const body: any = { name: params.name };
  if (params.pos) body.pos = params.pos;
  if (params.checked !== undefined) body.checked = params.checked;
  if (params.due) body.due = params.due;
  if (params.idMember) body.idMember = params.idMember;
  return trelloRequest("POST", `/checklists/${params.checklistId}/checkItems`, body);
}

// Search function
async function search(params: {
  query: string;
  idBoards?: string;
  idOrganizations?: string;
  modelTypes?: string;
  cards_limit?: number;
  boards_limit?: number;
  partial?: boolean;
}): Promise<any> {
  const query: string[] = [`query=${encodeURIComponent(params.query)}`];
  if (params.idBoards) query.push(`idBoards=${params.idBoards}`);
  if (params.idOrganizations) query.push(`idOrganizations=${params.idOrganizations}`);
  if (params.modelTypes) query.push(`modelTypes=${params.modelTypes}`);
  if (params.cards_limit) query.push(`cards_limit=${params.cards_limit}`);
  if (params.boards_limit) query.push(`boards_limit=${params.boards_limit}`);
  if (params.partial !== undefined) query.push(`partial=${params.partial}`);
  return trelloRequest("GET", `/search?${query.join("&")}`);
}

const server = new Server(
  { name: "trello-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // Boards
      case "list_boards":
        result = await listBoards(args as any);
        break;
      case "get_board":
        result = await getBoard(args as any);
        break;
      case "create_board":
        result = await createBoard(args as any);
        break;
      // Lists
      case "list_lists":
        result = await listLists(args as any);
        break;
      case "create_list":
        result = await createList(args as any);
        break;
      case "archive_list":
        result = await archiveList(args as any);
        break;
      // Cards
      case "list_cards":
        result = await listCards(args as any);
        break;
      case "get_card":
        result = await getCard(args as any);
        break;
      case "create_card":
        result = await createCard(args as any);
        break;
      case "update_card":
        result = await updateCard(args as any);
        break;
      case "move_card":
        result = await moveCard(args as any);
        break;
      case "delete_card":
        result = await deleteCard(args as any);
        break;
      // Comments
      case "add_comment":
        result = await addComment(args as any);
        break;
      case "list_comments":
        result = await listComments(args as any);
        break;
      // Members
      case "add_member":
        result = await addMember(args as any);
        break;
      case "remove_member":
        result = await removeMember(args as any);
        break;
      case "list_members":
        result = await listMembers(args as any);
        break;
      // Labels
      case "add_label":
        result = await addLabel(args as any);
        break;
      case "list_labels":
        result = await listLabels(args as any);
        break;
      // Checklists
      case "create_checklist":
        result = await createChecklist(args as any);
        break;
      case "add_checklist_item":
        result = await addChecklistItem(args as any);
        break;
      // Search
      case "search":
        result = await search(args as any);
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
  console.error("Trello MCP Server running on stdio");
}

main().catch(console.error);
