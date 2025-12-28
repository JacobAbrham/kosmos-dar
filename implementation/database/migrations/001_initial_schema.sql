-- =============================================================================
-- KOSMOS V2.0 Database Schema - Migration 001
-- Initial Schema Setup
-- =============================================================================

-- Create schemas
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS agents;
CREATE SCHEMA IF NOT EXISTS governance;
CREATE SCHEMA IF NOT EXISTS knowledge;
CREATE SCHEMA IF NOT EXISTS metrics;
CREATE SCHEMA IF NOT EXISTS audit;

-- =============================================================================
-- CORE SCHEMA - Tenants, Users, Conversations
-- =============================================================================

-- Tenants table (multi-tenancy)
CREATE TABLE core.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table
CREATE TABLE core.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    external_id VARCHAR(255),  -- Zitadel user ID
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

-- Conversations table
CREATE TABLE core.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    user_id UUID NOT NULL REFERENCES core.users(id),
    title VARCHAR(500),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE core.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES core.conversations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    agent_id VARCHAR(50),
    tool_calls JSONB,
    tokens_input INTEGER,
    tokens_output INTEGER,
    cost_usd DECIMAL(10, 6),
    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- AGENTS SCHEMA - Agent State and Configuration
-- =============================================================================

-- Agent registry
CREATE TABLE agents.registry (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    domain VARCHAR(100) NOT NULL,
    description TEXT,
    tools JSONB DEFAULT '[]',
    mcp_servers JSONB DEFAULT '[]',
    config JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent state (for persistence)
CREATE TABLE agents.state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(50) NOT NULL REFERENCES agents.registry(id),
    conversation_id UUID REFERENCES core.conversations(id),
    state JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent metrics
CREATE TABLE agents.metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(50) NOT NULL REFERENCES agents.registry(id),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DOUBLE PRECISION NOT NULL,
    labels JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- GOVERNANCE SCHEMA - Pentarchy Voting and Approvals
-- =============================================================================

-- Proposals
CREATE TABLE governance.proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    conversation_id UUID REFERENCES core.conversations(id),
    action VARCHAR(200) NOT NULL,
    description TEXT,
    estimated_cost DECIMAL(10, 2),
    risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    context JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'voting', 'approved', 'rejected', 'escalated')),
    outcome VARCHAR(20),
    decided_by VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Votes
CREATE TABLE governance.votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id UUID NOT NULL REFERENCES governance.proposals(id) ON DELETE CASCADE,
    voter_agent VARCHAR(50) NOT NULL,
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('approve', 'reject', 'abstain', 'defer')),
    confidence DECIMAL(3, 2) CHECK (confidence >= 0 AND confidence <= 1),
    reasoning TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cost tracking
CREATE TABLE governance.cost_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    proposal_id UUID REFERENCES governance.proposals(id),
    tool_name VARCHAR(100) NOT NULL,
    agent_id VARCHAR(50),
    estimated_cost DECIMAL(12, 4) NOT NULL,
    actual_cost DECIMAL(12, 4),
    variance_pct DECIMAL(5, 2),
    governance_decision VARCHAR(20),
    approved_by VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- =============================================================================
-- KNOWLEDGE SCHEMA - RAG and Documents
-- =============================================================================

-- Documents
CREATE TABLE knowledge.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    source_url TEXT,
    title VARCHAR(500),
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text/plain',
    metadata JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks with embeddings
CREATE TABLE knowledge.chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES knowledge.documents(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    content TEXT NOT NULL,
    embedding vector(768),  -- all-mpnet-base-v2 dimensions
    chunk_index INTEGER NOT NULL,
    token_count INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search column
ALTER TABLE knowledge.chunks ADD COLUMN content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Memory entities (knowledge graph)
CREATE TABLE knowledge.entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    user_id UUID REFERENCES core.users(id),
    name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    observations JSONB DEFAULT '[]',
    embedding vector(1536),  -- For semantic search
    importance_score FLOAT DEFAULT 0.5,
    decay_rate FLOAT DEFAULT 0.01,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memory relations
CREATE TABLE knowledge.relations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    from_entity_id UUID NOT NULL REFERENCES knowledge.entities(id) ON DELETE CASCADE,
    to_entity_id UUID NOT NULL REFERENCES knowledge.entities(id) ON DELETE CASCADE,
    relation_type VARCHAR(100) NOT NULL,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- AUDIT SCHEMA - Immutable Audit Log
-- =============================================================================

-- Audit events
CREATE TABLE audit.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('user', 'agent', 'system')),
    actor_id VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent modifications to audit table
CREATE OR REPLACE FUNCTION audit.prevent_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log is immutable - modifications not allowed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_modification
    BEFORE UPDATE OR DELETE ON audit.events
    FOR EACH ROW EXECUTE FUNCTION audit.prevent_modification();

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Core indexes
CREATE INDEX idx_users_tenant ON core.users(tenant_id);
CREATE INDEX idx_users_email ON core.users(email);
CREATE INDEX idx_conversations_tenant ON core.conversations(tenant_id);
CREATE INDEX idx_conversations_user ON core.conversations(user_id);
CREATE INDEX idx_messages_conversation ON core.messages(conversation_id);
CREATE INDEX idx_messages_created ON core.messages(created_at);

-- Agent indexes
CREATE INDEX idx_agent_state_agent ON agents.state(agent_id);
CREATE INDEX idx_agent_state_conversation ON agents.state(conversation_id);
CREATE INDEX idx_agent_metrics_agent ON agents.metrics(agent_id);
CREATE INDEX idx_agent_metrics_recorded ON agents.metrics(recorded_at);

-- Governance indexes
CREATE INDEX idx_proposals_tenant ON governance.proposals(tenant_id);
CREATE INDEX idx_proposals_status ON governance.proposals(status);
CREATE INDEX idx_votes_proposal ON governance.votes(proposal_id);
CREATE INDEX idx_cost_tracking_tenant ON governance.cost_tracking(tenant_id);

-- Knowledge indexes
CREATE INDEX idx_documents_tenant ON knowledge.documents(tenant_id);
CREATE INDEX idx_chunks_document ON knowledge.chunks(document_id);
CREATE INDEX idx_chunks_tenant ON knowledge.chunks(tenant_id);
CREATE INDEX idx_chunks_fts ON knowledge.chunks USING gin(content_tsv);
CREATE INDEX idx_chunks_embedding ON knowledge.chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_entities_tenant ON knowledge.entities(tenant_id);
CREATE INDEX idx_entities_user ON knowledge.entities(user_id);
CREATE INDEX idx_entities_type ON knowledge.entities(entity_type);
CREATE INDEX idx_relations_from ON knowledge.relations(from_entity_id);
CREATE INDEX idx_relations_to ON knowledge.relations(to_entity_id);

-- Audit indexes
CREATE INDEX idx_audit_tenant ON audit.events(tenant_id);
CREATE INDEX idx_audit_created ON audit.events(created_at);
CREATE INDEX idx_audit_actor ON audit.events(actor_type, actor_id);
CREATE INDEX idx_audit_resource ON audit.events(resource_type, resource_id);

-- =============================================================================
-- ROW LEVEL SECURITY (Multi-tenancy)
-- =============================================================================

-- Enable RLS on tenant-scoped tables
ALTER TABLE core.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.cost_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.relations ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policies
CREATE POLICY tenant_isolation_users ON core.users
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_conversations ON core.conversations
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_messages ON core.messages
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_proposals ON governance.proposals
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_documents ON knowledge.documents
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_chunks ON knowledge.chunks
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_isolation_entities ON knowledge.entities
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- =============================================================================
-- SEED DATA - Default Agent Registry
-- =============================================================================

INSERT INTO agents.registry (id, name, domain, description, tools, mcp_servers) VALUES
('zeus', 'Zeus', 'Orchestration & Supervision', 'Master orchestrator coordinating all agents',
 '["process_message", "classify_intent", "route_to_agent", "conduct_pentarchy_vote"]'::jsonb,
 '["sequential-thinking", "memory-server"]'::jsonb),

('hermes', 'Hermes', 'Communications', 'Email, notifications, messaging integration',
 '["send_email", "send_slack_message", "get_inbox", "compose_message"]'::jsonb,
 '["mcp-gmail", "mcp-slack"]'::jsonb),

('aegis', 'AEGIS', 'Security', 'Security monitoring, threat detection, access control',
 '["scan_for_threats", "validate_permissions", "audit_access", "veto_action"]'::jsonb,
 '["mcp-falco", "mcp-zitadel", "prompt-armor"]'::jsonb),

('chronos', 'Chronos', 'Scheduling & Time Management', 'Calendar, meetings, time-based orchestration',
 '["schedule_meeting", "check_availability", "set_reminder", "manage_calendar"]'::jsonb,
 '["mcp-google-calendar"]'::jsonb),

('athena', 'Athena', 'Knowledge & RAG', 'Document search, knowledge retrieval, RAG operations',
 '["search_documents", "query_knowledge_base", "embed_document", "summarize_content"]'::jsonb,
 '["mcp-haystack", "context7-mcp", "memory-server"]'::jsonb),

('hephaestus', 'Hephaestus', 'DevOps & Tooling', 'CI/CD, deployments, infrastructure management',
 '["run_pipeline", "deploy_service", "check_status", "manage_mcp_servers"]'::jsonb,
 '["mcp-github", "mcp-docker", "mcp-kubernetes"]'::jsonb),

('nur_prometheus', 'Nur PROMETHEUS', 'Analytics & Insights', 'Data analysis, business intelligence, metrics',
 '["analyze_data", "generate_report", "create_visualization", "predict_trend"]'::jsonb,
 '["mcp-postgresql", "mcp-grafana"]'::jsonb),

('iris', 'Iris', 'Notifications & Alerts', 'Alert management, notification routing, escalation',
 '["send_notification", "create_alert", "escalate_issue", "manage_preferences"]'::jsonb,
 '["mcp-alertmanager"]'::jsonb),

('memorix', 'MEMORIX', 'Memory & Context', 'Conversation memory, knowledge graph, context persistence',
 '["store_memory", "retrieve_memory", "create_entity", "create_relation", "search_knowledge_graph"]'::jsonb,
 '["memory-server"]'::jsonb),

('hestia', 'Hestia', 'Personal & Wellness', 'Personal data, wellness, ergonomic recommendations',
 '["get_ergonomic_settings", "suggest_break", "manage_preferences", "track_wellness"]'::jsonb,
 '["mcp-personal"]'::jsonb),

('morpheus', 'Morpheus', 'Learning & Adaptation', 'User learning patterns, adaptive UI, personalization',
 '["learn_pattern", "adapt_interface", "suggest_improvement", "personalize_experience"]'::jsonb,
 '["mcp-langfuse"]'::jsonb);

-- Record migration
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.schema_migrations (version) VALUES ('001_initial_schema');
