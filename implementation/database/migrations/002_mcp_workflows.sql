-- =============================================================================
-- KOSMOS V2.0 Database Schema - Migration 002
-- MCP Server Integration & Workflow Engine
-- Based on KOSMOS Enterprise Governance Package specifications
-- =============================================================================

-- Create MCP schema
CREATE SCHEMA IF NOT EXISTS mcp;

-- =============================================================================
-- MCP SCHEMA - Tool Invocations and Server Registry
-- Reference: KOSMOS MCP tool execution log specification [1][4]
-- =============================================================================

-- MCP Server Registry
CREATE TABLE mcp.servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200),
    category VARCHAR(50) NOT NULL, -- 'database', 'ai', 'productivity', 'security', 'devops', 'messaging', 'finance', 'cloud'
    description TEXT,
    transport_type VARCHAR(20) DEFAULT 'stdio' CHECK (transport_type IN ('stdio', 'http', 'websocket')),
    command TEXT, -- npx command or executable path
    args JSONB DEFAULT '[]',
    env_vars JSONB DEFAULT '{}', -- Required environment variables
    tools JSONB DEFAULT '[]', -- List of available tools
    resources JSONB DEFAULT '[]', -- List of available resources
    prompts JSONB DEFAULT '[]', -- List of available prompts
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'maintenance')),
    health_check_url TEXT,
    last_health_check TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MCP Tool Invocations - Execution log
-- Reference: mcp.invocations table specification [4]
CREATE TABLE mcp.invocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Context
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES core.conversations(id) ON DELETE SET NULL,
    message_id UUID REFERENCES core.messages(id) ON DELETE SET NULL,
    agent VARCHAR(50), -- Agent that invoked the tool
    -- Tool info
    server_name VARCHAR(100) NOT NULL REFERENCES mcp.servers(name),
    tool_name VARCHAR(100) NOT NULL,
    -- Execution
    input JSONB,
    output JSONB,
    -- Result
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failure', 'timeout', 'cancelled')),
    error_message TEXT,
    error_code VARCHAR(50),
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    -- Cost tracking
    estimated_cost DECIMAL(12, 6),
    actual_cost DECIMAL(12, 6),
    tokens_used INTEGER,
    -- Metadata
    trace_id VARCHAR(100),
    span_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'
);

-- MCP Server Health History
CREATE TABLE mcp.health_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_name VARCHAR(100) NOT NULL REFERENCES mcp.servers(name),
    status VARCHAR(20) NOT NULL,
    response_time_ms INTEGER,
    error_message TEXT,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- WORKFLOWS SCHEMA - Workflow Definitions and Execution
-- Reference: workflows and workflow_runs tables [2][5][6]
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS workflows;

-- Workflow Definitions
CREATE TABLE workflows.definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    user_id UUID REFERENCES core.users(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    -- Definition
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('manual', 'schedule', 'event', 'webhook', 'api')),
    trigger_config JSONB DEFAULT '{}', -- Cron expression, event patterns, etc.
    steps JSONB NOT NULL, -- Array of workflow steps
    variables JSONB DEFAULT '{}', -- Default variables
    -- Settings
    timeout_ms INTEGER DEFAULT 3600000, -- 1 hour default
    max_retries INTEGER DEFAULT 3,
    retry_delay_ms INTEGER DEFAULT 5000,
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_template BOOLEAN DEFAULT false,
    -- Metadata
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- Workflow Runs - Execution history
-- Reference: workflow_runs table specification [2][5]
CREATE TABLE workflows.runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows.definitions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    -- Execution info
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'paused')),
    trigger_type VARCHAR(50), -- 'manual', 'schedule', 'event'
    trigger_data JSONB, -- Data that triggered the run
    triggered_by UUID REFERENCES core.users(id),
    -- State
    current_step INTEGER DEFAULT 0,
    variables JSONB DEFAULT '{}', -- Runtime variables
    checkpoint JSONB, -- LangGraph checkpoint data
    -- Results
    output JSONB,
    error_message TEXT,
    error_step INTEGER,
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    -- Metadata
    parent_run_id UUID REFERENCES workflows.runs(id), -- For sub-workflows
    trace_id VARCHAR(100)
);

-- Workflow Step Executions
CREATE TABLE workflows.step_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES workflows.runs(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    step_name VARCHAR(200),
    step_type VARCHAR(50) NOT NULL, -- 'agent', 'tool', 'condition', 'loop', 'parallel', 'human_approval'
    -- Execution
    input JSONB,
    output JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'waiting')),
    error_message TEXT,
    -- Agent/Tool reference
    agent_id VARCHAR(50),
    tool_name VARCHAR(100),
    mcp_invocation_id UUID REFERENCES mcp.invocations(id),
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER
);

-- Workflow Schedules
CREATE TABLE workflows.schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows.definitions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES for MCP and Workflows
-- =============================================================================

-- MCP indexes
CREATE INDEX idx_mcp_invocations_tenant ON mcp.invocations(tenant_id);
CREATE INDEX idx_mcp_invocations_server ON mcp.invocations(server_name);
CREATE INDEX idx_mcp_invocations_agent ON mcp.invocations(agent);
CREATE INDEX idx_mcp_invocations_status ON mcp.invocations(status);
CREATE INDEX idx_mcp_invocations_started ON mcp.invocations(started_at);
CREATE INDEX idx_mcp_invocations_trace ON mcp.invocations(trace_id);
CREATE INDEX idx_mcp_servers_category ON mcp.servers(category);
CREATE INDEX idx_mcp_health_server ON mcp.health_history(server_name);
CREATE INDEX idx_mcp_health_checked ON mcp.health_history(checked_at);

-- Workflow indexes
CREATE INDEX idx_workflows_tenant ON workflows.definitions(tenant_id);
CREATE INDEX idx_workflows_active ON workflows.definitions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_workflow_runs_workflow ON workflows.runs(workflow_id);
CREATE INDEX idx_workflow_runs_tenant ON workflows.runs(tenant_id);
CREATE INDEX idx_workflow_runs_status ON workflows.runs(status);
CREATE INDEX idx_workflow_runs_started ON workflows.runs(started_at);
CREATE INDEX idx_workflow_steps_run ON workflows.step_executions(run_id);
CREATE INDEX idx_workflow_schedules_next ON workflows.schedules(next_run_at) WHERE is_active = TRUE;

-- =============================================================================
-- ROW LEVEL SECURITY for MCP and Workflows
-- =============================================================================

ALTER TABLE mcp.invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows.definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows.step_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_mcp_invocations ON mcp.invocations
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_workflow_definitions ON workflows.definitions
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_workflow_runs ON workflows.runs
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_workflow_schedules ON workflows.schedules
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- =============================================================================
-- SEED DATA - MCP Server Registry
-- =============================================================================

INSERT INTO mcp.servers (name, display_name, category, description, transport_type, tools) VALUES
-- Database & Storage
('postgres-mcp', 'PostgreSQL', 'database', 'PostgreSQL database operations', 'stdio', 
 '["query", "execute", "describe_table", "list_tables"]'::jsonb),
('mongodb-mcp', 'MongoDB', 'database', 'MongoDB document database operations', 'stdio',
 '["find", "insert", "update", "delete", "aggregate"]'::jsonb),
('redis-mcp', 'Redis', 'database', 'Redis cache and data structure operations', 'stdio',
 '["get", "set", "del", "hget", "hset", "lpush", "rpush"]'::jsonb),
('qdrant-mcp', 'Qdrant', 'database', 'Vector database for embeddings', 'stdio',
 '["search", "upsert", "delete", "create_collection"]'::jsonb),
('neo4j-mcp', 'Neo4j', 'database', 'Graph database operations', 'stdio',
 '["query", "create_node", "create_relationship"]'::jsonb),

-- AI & LLM
('openai-mcp', 'OpenAI', 'ai', 'OpenAI API integration', 'stdio',
 '["chat", "complete", "embed", "generate_image"]'::jsonb),
('anthropic-mcp', 'Anthropic', 'ai', 'Claude API integration', 'stdio',
 '["chat", "complete"]'::jsonb),
('ollama-mcp', 'Ollama', 'ai', 'Local LLM inference', 'stdio',
 '["generate", "chat", "embed"]'::jsonb),
('litellm-mcp', 'LiteLLM', 'ai', 'Unified LLM routing', 'stdio',
 '["chat", "complete", "embed"]'::jsonb),
('sequential-thinking-mcp', 'Sequential Thinking', 'ai', 'Step-by-step reasoning', 'stdio',
 '["think", "analyze", "plan"]'::jsonb),
('context7-mcp', 'Context7', 'ai', 'External library documentation lookup', 'stdio',
 '["resolve_library_id", "get_library_docs"]'::jsonb),

-- Productivity
('slack-mcp', 'Slack', 'productivity', 'Slack messaging integration', 'stdio',
 '["send_message", "list_channels", "get_messages"]'::jsonb),
('gmail-mcp', 'Gmail', 'productivity', 'Gmail email integration', 'http',
 '["send_email", "list_emails", "search_emails", "get_email"]'::jsonb),
('notion-mcp', 'Notion', 'productivity', 'Notion workspace integration', 'stdio',
 '["create_page", "update_page", "search", "get_database"]'::jsonb),
('jira-mcp', 'Jira', 'productivity', 'Jira project management', 'stdio',
 '["create_issue", "update_issue", "search_issues", "get_project"]'::jsonb),
('github-mcp', 'GitHub', 'productivity', 'GitHub repository operations', 'stdio',
 '["create_issue", "create_pr", "search_code", "get_file"]'::jsonb),
('gcal-mcp', 'Google Calendar', 'productivity', 'Google Calendar integration', 'http',
 '["create_event", "list_events", "update_event", "delete_event"]'::jsonb),

-- Security
('zitadel-mcp', 'Zitadel', 'security', 'Identity and access management', 'stdio',
 '["create_user", "validate_token", "list_users", "assign_role"]'::jsonb),
('infisical-mcp', 'Infisical', 'security', 'Secrets management', 'stdio',
 '["get_secret", "set_secret", "list_secrets"]'::jsonb),
('vault-mcp', 'HashiCorp Vault', 'security', 'Secrets and encryption', 'stdio',
 '["read_secret", "write_secret", "encrypt", "decrypt"]'::jsonb),
('falco-mcp', 'Falco', 'security', 'Runtime security monitoring', 'stdio',
 '["get_alerts", "list_rules", "update_rule"]'::jsonb),
('guardrails-mcp', 'Guardrails', 'security', 'AI safety guardrails', 'stdio',
 '["validate_input", "validate_output", "check_policy"]'::jsonb),

-- DevOps
('docker-mcp', 'Docker', 'devops', 'Docker container management', 'stdio',
 '["list_containers", "start_container", "stop_container", "logs"]'::jsonb),
('kubernetes-mcp', 'Kubernetes', 'devops', 'Kubernetes cluster management', 'stdio',
 '["get_pods", "get_deployments", "apply_manifest", "logs"]'::jsonb),
('terraform-mcp', 'Terraform', 'devops', 'Infrastructure as code', 'stdio',
 '["plan", "apply", "destroy", "state"]'::jsonb),
('argocd-mcp', 'Argo CD', 'devops', 'GitOps continuous delivery', 'stdio',
 '["sync", "get_app", "list_apps", "rollback"]'::jsonb),
('prometheus-mcp', 'Prometheus', 'devops', 'Metrics and monitoring', 'stdio',
 '["query", "query_range", "alerts"]'::jsonb),
('grafana-mcp', 'Grafana', 'devops', 'Dashboards and visualization', 'stdio',
 '["get_dashboard", "create_dashboard", "list_datasources"]'::jsonb),

-- Cloud Providers
('aws-mcp', 'AWS', 'cloud', 'Amazon Web Services', 'stdio',
 '["s3_list", "s3_get", "s3_put", "lambda_invoke", "ec2_describe"]'::jsonb),
('gcp-mcp', 'Google Cloud', 'cloud', 'Google Cloud Platform', 'stdio',
 '["storage_list", "storage_get", "functions_invoke", "compute_describe"]'::jsonb),
('azure-mcp', 'Azure', 'cloud', 'Microsoft Azure', 'stdio',
 '["blob_list", "blob_get", "functions_invoke", "vm_describe"]'::jsonb),
('alicloud-mcp', 'Alibaba Cloud', 'cloud', 'Alibaba Cloud services', 'stdio',
 '["oss_list", "oss_get", "fc_invoke"]'::jsonb),

-- Finance
('stripe-mcp', 'Stripe', 'finance', 'Payment processing', 'stdio',
 '["create_payment", "get_customer", "list_transactions"]'::jsonb),
('quickbooks-mcp', 'QuickBooks', 'finance', 'Accounting integration', 'stdio',
 '["create_invoice", "get_accounts", "list_transactions"]'::jsonb),
('plaid-mcp', 'Plaid', 'finance', 'Banking data integration', 'stdio',
 '["get_accounts", "get_transactions", "get_balance"]'::jsonb),

-- Memory & Knowledge
('memory-server', 'Memory Server', 'ai', 'Knowledge graph and persistent memory', 'stdio',
 '["create_entities", "delete_entities", "create_relations", "delete_relations", "add_observations", "delete_observations", "read_graph", "search_nodes", "open_nodes"]'::jsonb);

-- Record migration
INSERT INTO public.schema_migrations (version) VALUES ('002_mcp_workflows');
