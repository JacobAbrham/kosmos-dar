# Next Priority MCP Servers Integration Guide

**Last Updated:** January 2026  
**Status:** ✅ Ready for Integration

---

## Overview

After successfully integrating GitHub, PostgreSQL, and Slack MCP servers, the next priority servers are:

1. **Gmail** (Hermes Agent) - Email communication
2. **Notion** (Athena Agent) - Knowledge management
3. **Jira** (Hephaestus Agent) - Issue tracking
4. **Google Calendar** (Chronos Agent) - Scheduling

All servers are **already implemented** and **configured** in the tool registry. They just need environment variables to function.

---

## 1. Gmail MCP Server

**Status:** ✅ Implemented & Configured  
**Agent:** Hermes (Communications)  
**Purpose:** Email operations for KOSMOS agents

### Features

- List, search, and get messages
- Send, reply, and forward emails
- Manage labels
- Handle threads and drafts
- Mark messages as read/unread
- Get attachments

### Configuration

**Environment Variables:**
```bash
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REFRESH_TOKEN=your_refresh_token
```

**Setup Steps:**

1. **Create Google Cloud Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Gmail API

2. **Create OAuth 2.0 Credentials:**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Choose "Desktop app" or "Web application"
   - Download credentials

3. **Get Refresh Token:**
   - Use OAuth 2.0 Playground or a script to get refresh token
   - Grant Gmail API scopes: `https://www.googleapis.com/auth/gmail.modify`

4. **Set Environment Variables:**
   ```bash
   export GMAIL_CLIENT_ID="your_client_id"
   export GMAIL_CLIENT_SECRET="your_client_secret"
   export GMAIL_REFRESH_TOKEN="your_refresh_token"
   ```

### Usage

```python
from core.tool_registry import get_tool_registry

registry = await get_tool_registry()

# Send email
result = await registry.call_tool(
    server="gmail-mcp",
    tool="send_message",
    params={
        "to": "user@example.com",
        "subject": "Hello",
        "body": "This is a test email"
    }
)

# Search emails
result = await registry.call_tool(
    server="gmail-mcp",
    tool="search_messages",
    params={"query": "from:important@example.com"}
)
```

### Tools Available

- `list_messages` - List messages with pagination
- `get_message` - Get message by ID
- `search_messages` - Search messages with query
- `send_message` - Send new email
- `reply_to_message` - Reply to existing message
- `forward_message` - Forward message
- `add_label` - Add label to message
- `remove_label` - Remove label from message
- `mark_as_read` - Mark message as read
- `mark_as_unread` - Mark message as unread
- `get_attachment` - Get attachment from message

---

## 2. Notion MCP Server

**Status:** ✅ Implemented & Configured  
**Agent:** Athena (Knowledge & RAG)  
**Purpose:** Notion workspace integration for knowledge management

### Features

- Search across pages, databases, and blocks
- Create, read, update, archive pages
- Query and modify databases
- Manage blocks and content
- Handle page properties and relations
- User and comment management

### Configuration

**Environment Variables:**
```bash
NOTION_API_KEY=your_notion_api_key
```

**Setup Steps:**

1. **Create Notion Integration:**
   - Go to [Notion Integrations](https://www.notion.so/my-integrations)
   - Click "New integration"
   - Name it (e.g., "KOSMOS Agent")
   - Select capabilities (Read content, Update content, etc.)
   - Copy the "Internal Integration Token"

2. **Share Pages/Databases:**
   - Open the Notion page/database you want to access
   - Click "..." → "Add connections"
   - Select your integration

3. **Set Environment Variable:**
   ```bash
   export NOTION_API_KEY="secret_your_token_here"
   ```

### Usage

```python
# Search Notion workspace
result = await registry.call_tool(
    server="notion-mcp",
    tool="search",
    params={"query": "project planning"}
)

# Create page
result = await registry.call_tool(
    server="notion-mcp",
    tool="create_page",
    params={
        "parent_id": "parent_page_id",
        "title": "New Page",
        "content": [{"type": "paragraph", "text": "Content here"}]
    }
)

# Query database
result = await registry.call_tool(
    server="notion-mcp",
    tool="query_database",
    params={"database_id": "database_id", "filter": {...}}
)
```

### Tools Available

- `search` - Search across workspace
- `get_page` - Get page by ID
- `create_page` - Create new page
- `update_page` - Update page content
- `archive_page` - Archive page
- `query_database` - Query database with filters
- `create_database_entry` - Create database entry
- `update_database_entry` - Update database entry
- `get_block` - Get block by ID
- `append_block` - Append block to page
- `update_block` - Update block content
- `delete_block` - Delete block

---

## 3. Jira MCP Server

**Status:** ✅ Implemented & Configured  
**Agent:** Hephaestus (DevOps)  
**Purpose:** Issue tracking and project management

### Features

- Issue CRUD operations with JQL search
- Comment management
- Status transitions
- Sprint and board management (Agile API)
- User management
- Attachments
- Issue linking

### Configuration

**Environment Variables:**
```bash
JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your_email@example.com
JIRA_API_TOKEN=your_api_token
```

**Setup Steps:**

1. **Get Jira API Token:**
   - Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
   - Click "Create API token"
   - Copy the token

2. **Set Environment Variables:**
   ```bash
   export JIRA_URL="https://your-domain.atlassian.net"
   export JIRA_EMAIL="your_email@example.com"
   export JIRA_API_TOKEN="your_api_token"
   ```

### Usage

```python
# Search issues with JQL
result = await registry.call_tool(
    server="jira-mcp",
    tool="search_issues",
    params={"jql": "project = PROJ AND status = Open"}
)

# Create issue
result = await registry.call_tool(
    server="jira-mcp",
    tool="create_issue",
    params={
        "project_key": "PROJ",
        "issue_type": "Task",
        "summary": "Fix bug",
        "description": "Bug description"
    }
)

# Transition issue
result = await registry.call_tool(
    server="jira-mcp",
    tool="transition_issue",
    params={
        "issue_key": "PROJ-123",
        "transition_id": "21"  # "In Progress"
    }
)
```

### Tools Available

- `search_issues` - Search issues with JQL
- `get_issue` - Get issue by key
- `create_issue` - Create new issue
- `update_issue` - Update issue fields
- `delete_issue` - Delete issue
- `add_comment` - Add comment to issue
- `get_comments` - Get issue comments
- `transition_issue` - Change issue status
- `get_transitions` - Get available transitions
- `assign_issue` - Assign issue to user
- `add_attachment` - Add attachment to issue
- `get_attachments` - Get issue attachments
- `link_issues` - Link two issues
- `get_sprints` - Get sprints for board
- `get_board_issues` - Get issues on board

---

## 4. Google Calendar MCP Server

**Status:** ✅ Implemented & Configured  
**Agent:** Chronos (Scheduling)  
**Purpose:** Calendar operations for scheduling

### Features

- List and search calendar events
- Create, update, and delete events
- Manage multiple calendars
- Check free/busy times
- Handle recurring events

### Configuration

**Option 1: OAuth 2.0 (Recommended for user calendars)**
```bash
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
GOOGLE_CALENDAR_ID=primary  # or specific calendar ID
```

**Option 2: Service Account (Recommended for shared calendars)**
```bash
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_CALENDAR_ID=shared_calendar_id
```

**Setup Steps:**

1. **OAuth 2.0 Setup (same as Gmail):**
   - Use same Google Cloud Project
   - Enable Calendar API
   - Grant scopes: `https://www.googleapis.com/auth/calendar`

2. **Service Account Setup:**
   - Create Service Account in Google Cloud Console
   - Download JSON key
   - Share calendar with service account email
   - Set `GOOGLE_SERVICE_ACCOUNT_KEY` to JSON content

3. **Set Environment Variables:**
   ```bash
   # OAuth 2.0
   export GOOGLE_CLIENT_ID="your_client_id"
   export GOOGLE_CLIENT_SECRET="your_client_secret"
   export GOOGLE_REFRESH_TOKEN="your_refresh_token"
   export GOOGLE_CALENDAR_ID="primary"
   
   # OR Service Account
   export GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
   export GOOGLE_CALENDAR_ID="shared_calendar_id"
   ```

### Usage

```python
# List events
result = await registry.call_tool(
    server="gcal-mcp",
    tool="list_events",
    params={
        "time_min": "2026-01-15T00:00:00Z",
        "time_max": "2026-01-16T00:00:00Z"
    }
)

# Create event
result = await registry.call_tool(
    server="gcal-mcp",
    tool="create_event",
    params={
        "summary": "Team Meeting",
        "start": "2026-01-15T10:00:00Z",
        "end": "2026-01-15T11:00:00Z",
        "attendees": ["user@example.com"]
    }
)

# Check free/busy
result = await registry.call_tool(
    server="gcal-mcp",
    tool="freebusy_query",
    params={
        "time_min": "2026-01-15T00:00:00Z",
        "time_max": "2026-01-15T23:59:59Z",
        "items": [{"id": "user@example.com"}]
    }
)
```

### Tools Available

- `list_events` - List calendar events
- `get_event` - Get event by ID
- `create_event` - Create new event
- `update_event` - Update event
- `delete_event` - Delete event
- `search_events` - Search events with query
- `freebusy_query` - Check free/busy times
- `list_calendars` - List available calendars
- `get_calendar` - Get calendar by ID

---

## Integration Checklist

### For Each Server:

- [ ] Environment variables set
- [ ] API credentials obtained
- [ ] Permissions/scopes granted
- [ ] Test connection (use tool registry health check)
- [ ] Test basic operations
- [ ] Document any custom configuration

### Testing

```python
# Test server discovery
registry = await get_tool_registry()
await registry.initialize()

# Check server status
status = registry.get_server_status("gmail-mcp")
print(f"Gmail MCP Status: {status}")

# List available tools
tools = registry.list_tools_by_server("gmail-mcp")
print(f"Available tools: {[t.name for t in tools]}")

# Test tool call
result = await registry.call_tool(
    server="gmail-mcp",
    tool="list_messages",
    params={"max_results": 5}
)
print(f"Result: {result}")
```

---

## Next Steps

1. **Set Environment Variables** - Add to `.env` or Docker Compose
2. **Test Connections** - Verify each server can connect
3. **Agent Integration** - Agents will automatically discover tools
4. **Monitor Usage** - Check tool registry metrics

---

## Troubleshooting

### Common Issues

1. **Authentication Errors:**
   - Verify credentials are correct
   - Check token expiration (refresh if needed)
   - Ensure scopes/permissions are granted

2. **Connection Timeouts:**
   - Check network connectivity
   - Verify API endpoints are accessible
   - Check firewall rules

3. **Tool Not Found:**
   - Run `registry.discover_all_tools()` to refresh
   - Check server is enabled in config
   - Verify server process is running

### Debug Mode

Enable debug logging:
```python
import logging
logging.getLogger("core.tool_registry").setLevel(logging.DEBUG)
```

---

**See Also:**
- [MCP Server Framework](docs/architecture/mcp-servers.md)
- [Tool Registry Documentation](implementation/backend/core/tool_registry.py)
- [Agent Integration Guide](docs/development/agents.md)
