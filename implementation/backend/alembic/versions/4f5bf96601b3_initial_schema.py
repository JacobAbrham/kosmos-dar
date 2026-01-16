"""Initial schema

Revision ID: 4f5bf96601b3
Revises: 
Create Date: 2025-12-27 23:06:57.940262

This migration combines all SQL migrations (001, 002, 003, 010, 011) into Alembic format.
Includes: schemas, tables, indexes, RLS policies, functions, and seed data.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '4f5bf96601b3'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Apply all migrations: 001, 002, 003, 010, 011"""
    
    # =============================================================================
    # EXTENSIONS (from 001 and 011)
    # =============================================================================
    op.execute(text("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\""))
    op.execute(text("CREATE EXTENSION IF NOT EXISTS \"pgcrypto\""))
    op.execute(text("CREATE EXTENSION IF NOT EXISTS \"pg_trgm\""))
    op.execute(text("CREATE EXTENSION IF NOT EXISTS \"vector\""))
    
    # =============================================================================
    # SCHEMAS (from 001, 002, 003, 010)
    # =============================================================================
    op.execute(text("CREATE SCHEMA IF NOT EXISTS core"))
    op.execute(text("CREATE SCHEMA IF NOT EXISTS agents"))
    op.execute(text("CREATE SCHEMA IF NOT EXISTS governance"))
    op.execute(text("CREATE SCHEMA IF NOT EXISTS knowledge"))
    op.execute(text("CREATE SCHEMA IF NOT EXISTS metrics"))
    op.execute(text("CREATE SCHEMA IF NOT EXISTS audit"))
    op.execute(text("CREATE SCHEMA IF NOT EXISTS mcp"))
    op.execute(text("CREATE SCHEMA IF NOT EXISTS workflows"))
    op.execute(text("CREATE SCHEMA IF NOT EXISTS routing"))
    
    # =============================================================================
    # MIGRATION 001: Initial Schema
    # =============================================================================
    
    # Core schema tables
    op.execute(text("""
        CREATE TABLE core.tenants (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(100) UNIQUE NOT NULL,
            settings JSONB DEFAULT '{}',
            status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    op.execute(text("""
        CREATE TABLE core.users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL REFERENCES core.tenants(id),
            external_id VARCHAR(255),
            email VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            role VARCHAR(50) DEFAULT 'user',
            preferences JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(tenant_id, email)
        )
    """))
    
    op.execute(text("""
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
        )
    """))
    
    op.execute(text("""
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
        )
    """))
    
    # Agents schema tables
    op.execute(text("""
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
        )
    """))
    
    op.execute(text("""
        CREATE TABLE agents.state (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            agent_id VARCHAR(50) NOT NULL REFERENCES agents.registry(id),
            conversation_id UUID REFERENCES core.conversations(id),
            state JSONB NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    op.execute(text("""
        CREATE TABLE agents.metrics (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            agent_id VARCHAR(50) NOT NULL REFERENCES agents.registry(id),
            metric_name VARCHAR(100) NOT NULL,
            metric_value DOUBLE PRECISION NOT NULL,
            labels JSONB DEFAULT '{}',
            recorded_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    # Governance schema tables
    op.execute(text("""
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
        )
    """))
    
    op.execute(text("""
        CREATE TABLE governance.votes (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            proposal_id UUID NOT NULL REFERENCES governance.proposals(id) ON DELETE CASCADE,
            voter_agent VARCHAR(50) NOT NULL,
            decision VARCHAR(20) NOT NULL CHECK (decision IN ('approve', 'reject', 'abstain', 'defer')),
            confidence DECIMAL(3, 2) CHECK (confidence >= 0 AND confidence <= 1),
            reasoning TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    op.execute(text("""
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
        )
    """))
    
    # Knowledge schema tables (with vector types)
    op.execute(text("""
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
        )
    """))
    
    op.execute(text("""
        CREATE TABLE knowledge.chunks (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            document_id UUID NOT NULL REFERENCES knowledge.documents(id) ON DELETE CASCADE,
            tenant_id UUID NOT NULL REFERENCES core.tenants(id),
            content TEXT NOT NULL,
            embedding vector(768),
            chunk_index INTEGER NOT NULL,
            token_count INTEGER,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    op.execute(text("""
        ALTER TABLE knowledge.chunks ADD COLUMN content_tsv tsvector
            GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
    """))
    
    op.execute(text("""
        CREATE TABLE knowledge.entities (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL REFERENCES core.tenants(id),
            user_id UUID REFERENCES core.users(id),
            name VARCHAR(255) NOT NULL,
            entity_type VARCHAR(100) NOT NULL,
            observations JSONB DEFAULT '[]',
            embedding vector(1536),
            importance_score FLOAT DEFAULT 0.5,
            decay_rate FLOAT DEFAULT 0.01,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            accessed_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    op.execute(text("""
        CREATE TABLE knowledge.relations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL REFERENCES core.tenants(id),
            from_entity_id UUID NOT NULL REFERENCES knowledge.entities(id) ON DELETE CASCADE,
            to_entity_id UUID NOT NULL REFERENCES knowledge.entities(id) ON DELETE CASCADE,
            relation_type VARCHAR(100) NOT NULL,
            properties JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    # Audit schema (from 001 and 003)
    op.execute(text("""
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
        )
    """))
    
    # Audit prevention trigger
    op.execute(text("""
        CREATE OR REPLACE FUNCTION audit.prevent_modification()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'Audit log is immutable - modifications not allowed';
        END;
        $$ LANGUAGE plpgsql
    """))
    
    op.execute(text("""
        CREATE TRIGGER prevent_audit_modification
            BEFORE UPDATE OR DELETE ON audit.events
            FOR EACH ROW EXECUTE FUNCTION audit.prevent_modification()
    """))
    
    # =============================================================================
    # MIGRATION 002: MCP Workflows
    # =============================================================================
    
    op.execute(text("""
        CREATE TABLE mcp.servers (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(100) NOT NULL UNIQUE,
            display_name VARCHAR(200),
            category VARCHAR(50) NOT NULL,
            description TEXT,
            transport_type VARCHAR(20) DEFAULT 'stdio' CHECK (transport_type IN ('stdio', 'http', 'websocket')),
            command TEXT,
            args JSONB DEFAULT '[]',
            env_vars JSONB DEFAULT '{}',
            tools JSONB DEFAULT '[]',
            resources JSONB DEFAULT '[]',
            prompts JSONB DEFAULT '[]',
            status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'maintenance')),
            health_check_url TEXT,
            last_health_check TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    op.execute(text("""
        CREATE TABLE mcp.invocations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL REFERENCES core.tenants(id),
            user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
            conversation_id UUID REFERENCES core.conversations(id) ON DELETE SET NULL,
            message_id UUID REFERENCES core.messages(id) ON DELETE SET NULL,
            agent VARCHAR(50),
            server_name VARCHAR(100) NOT NULL REFERENCES mcp.servers(name),
            tool_name VARCHAR(100) NOT NULL,
            input JSONB,
            output JSONB,
            status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failure', 'timeout', 'cancelled')),
            error_message TEXT,
            error_code VARCHAR(50),
            started_at TIMESTAMPTZ DEFAULT NOW(),
            completed_at TIMESTAMPTZ,
            duration_ms INTEGER,
            estimated_cost DECIMAL(12, 6),
            actual_cost DECIMAL(12, 6),
            tokens_used INTEGER,
            trace_id VARCHAR(100),
            span_id VARCHAR(100),
            metadata JSONB DEFAULT '{}'
        )
    """))
    
    op.execute(text("""
        CREATE TABLE mcp.health_history (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            server_name VARCHAR(100) NOT NULL REFERENCES mcp.servers(name),
            status VARCHAR(20) NOT NULL,
            response_time_ms INTEGER,
            error_message TEXT,
            checked_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    # Workflows schema
    op.execute(text("""
        CREATE TABLE workflows.definitions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL REFERENCES core.tenants(id),
            user_id UUID REFERENCES core.users(id),
            name VARCHAR(200) NOT NULL,
            description TEXT,
            trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('manual', 'schedule', 'event', 'webhook', 'api')),
            trigger_config JSONB DEFAULT '{}',
            steps JSONB NOT NULL,
            variables JSONB DEFAULT '{}',
            timeout_ms INTEGER DEFAULT 3600000,
            max_retries INTEGER DEFAULT 3,
            retry_delay_ms INTEGER DEFAULT 5000,
            is_active BOOLEAN DEFAULT true,
            is_template BOOLEAN DEFAULT false,
            tags JSONB DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(tenant_id, name)
        )
    """))
    
    op.execute(text("""
        CREATE TABLE workflows.runs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            workflow_id UUID NOT NULL REFERENCES workflows.definitions(id) ON DELETE CASCADE,
            tenant_id UUID NOT NULL REFERENCES core.tenants(id),
            status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'paused')),
            trigger_type VARCHAR(50),
            trigger_data JSONB,
            triggered_by UUID REFERENCES core.users(id),
            current_step INTEGER DEFAULT 0,
            variables JSONB DEFAULT '{}',
            checkpoint JSONB,
            output JSONB,
            error_message TEXT,
            error_step INTEGER,
            started_at TIMESTAMPTZ DEFAULT NOW(),
            completed_at TIMESTAMPTZ,
            duration_ms INTEGER,
            parent_run_id UUID REFERENCES workflows.runs(id),
            trace_id VARCHAR(100)
        )
    """))
    
    op.execute(text("""
        CREATE TABLE workflows.step_executions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            run_id UUID NOT NULL REFERENCES workflows.runs(id) ON DELETE CASCADE,
            step_index INTEGER NOT NULL,
            step_name VARCHAR(200),
            step_type VARCHAR(50) NOT NULL,
            input JSONB,
            output JSONB,
            status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'waiting')),
            error_message TEXT,
            agent_id VARCHAR(50),
            tool_name VARCHAR(100),
            mcp_invocation_id UUID REFERENCES mcp.invocations(id),
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            duration_ms INTEGER
        )
    """))
    
    op.execute(text("""
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
        )
    """))
    
    # =============================================================================
    # MIGRATION 010: Intent Embeddings
    # =============================================================================
    
    op.execute(text("""
        CREATE TABLE routing.intent_categories (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            parent_category_id VARCHAR(50) REFERENCES routing.intent_categories(id),
            priority_weight DECIMAL(3, 2) DEFAULT 1.0,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    op.execute(text("""
        CREATE TABLE routing.intents (
            id VARCHAR(100) PRIMARY KEY,
            category_id VARCHAR(50) NOT NULL REFERENCES routing.intent_categories(id),
            name VARCHAR(200) NOT NULL,
            description TEXT,
            example_utterances TEXT[] NOT NULL,
            embedding vector(768),
            target_agent VARCHAR(50) NOT NULL,
            secondary_agents VARCHAR(50)[] DEFAULT '{}',
            required_capabilities VARCHAR(100)[] DEFAULT '{}',
            confidence_threshold DECIMAL(3, 2) DEFAULT 0.75,
            priority INTEGER DEFAULT 5,
            metadata JSONB DEFAULT '{}',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    op.execute(text("""
        CREATE TABLE routing.intent_utterance_embeddings (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            intent_id VARCHAR(100) NOT NULL REFERENCES routing.intents(id) ON DELETE CASCADE,
            utterance TEXT NOT NULL,
            embedding vector(768) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    op.execute(text("""
        CREATE TABLE routing.keyword_rules (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            pattern TEXT NOT NULL,
            pattern_type VARCHAR(20) DEFAULT 'regex' CHECK (pattern_type IN ('regex', 'exact', 'contains')),
            target_agent VARCHAR(50) NOT NULL,
            priority INTEGER DEFAULT 5,
            confidence_boost DECIMAL(3, 2) DEFAULT 0.0,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    op.execute(text("""
        CREATE TABLE routing.context_overrides (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            context_condition JSONB NOT NULL,
            target_agent VARCHAR(50) NOT NULL,
            priority INTEGER DEFAULT 10,
            valid_duration_minutes INTEGER DEFAULT 60,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    op.execute(text("""
        CREATE TABLE routing.decisions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID NOT NULL,
            conversation_id UUID,
            message_id UUID,
            input_text TEXT NOT NULL,
            input_embedding vector(768),
            matched_intent_id VARCHAR(100) REFERENCES routing.intents(id),
            semantic_confidence DECIMAL(5, 4),
            keyword_match BOOLEAN DEFAULT FALSE,
            context_override BOOLEAN DEFAULT FALSE,
            selected_agent VARCHAR(50) NOT NULL,
            alternative_agents JSONB DEFAULT '[]',
            routing_latency_ms INTEGER,
            routing_method VARCHAR(20) CHECK (routing_method IN ('semantic', 'keyword', 'context', 'fallback')),
            feedback_score INTEGER CHECK (feedback_score >= 1 AND feedback_score <= 5),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    op.execute(text("""
        CREATE TABLE routing.performance_metrics (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            metric_date DATE NOT NULL,
            intent_id VARCHAR(100),
            agent_id VARCHAR(50),
            total_routes INTEGER DEFAULT 0,
            avg_confidence DECIMAL(5, 4),
            avg_latency_ms DECIMAL(10, 2),
            positive_feedback INTEGER DEFAULT 0,
            negative_feedback INTEGER DEFAULT 0,
            misroutes INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(metric_date, intent_id, agent_id)
        )
    """))
    
    op.execute(text("""
        CREATE TABLE routing.experiments (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(200) NOT NULL,
            description TEXT,
            strategy_a JSONB NOT NULL,
            strategy_b JSONB NOT NULL,
            traffic_split DECIMAL(3, 2) DEFAULT 0.5,
            status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
            started_at TIMESTAMPTZ,
            ended_at TIMESTAMPTZ,
            winner VARCHAR(10),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    op.execute(text("""
        CREATE TABLE routing.experiment_assignments (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            experiment_id UUID NOT NULL REFERENCES routing.experiments(id),
            user_id UUID NOT NULL,
            assigned_strategy VARCHAR(10) NOT NULL CHECK (assigned_strategy IN ('a', 'b')),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(experiment_id, user_id)
        )
    """))
    
    # =============================================================================
    # MIGRATION 011: Workflow Checkpoints
    # =============================================================================
    
    op.execute(text("""
        CREATE TABLE workflow_checkpoints (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            thread_id VARCHAR(100) NOT NULL,
            checkpoint_data JSONB NOT NULL,
            parent_id UUID REFERENCES workflow_checkpoints(id),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT fk_parent CHECK (parent_id IS NULL OR parent_id != id)
        )
    """))
    
    op.execute(text("""
        CREATE TABLE workflow_executions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            session_id VARCHAR(100) UNIQUE NOT NULL,
            thread_id VARCHAR(100) NOT NULL,
            tenant_id VARCHAR(50),
            user_id VARCHAR(100),
            trace_id VARCHAR(100),
            agent_id VARCHAR(50) NOT NULL,
            agent_name VARCHAR(100) NOT NULL,
            task_description TEXT,
            intent_id VARCHAR(100),
            intent_confidence DECIMAL(3, 2),
            routing_method VARCHAR(50),
            phase VARCHAR(50) DEFAULT 'planning',
            current_step INTEGER DEFAULT 0,
            total_steps INTEGER DEFAULT 0,
            final_result JSONB,
            final_response TEXT,
            error TEXT,
            estimated_cost DECIMAL(10, 4) DEFAULT 0,
            actual_cost DECIMAL(10, 4) DEFAULT 0,
            token_usage JSONB DEFAULT '{}',
            requires_governance BOOLEAN DEFAULT FALSE,
            governance_proposal_id VARCHAR(100),
            governance_approved BOOLEAN,
            governance_reason TEXT,
            human_inputs_count INTEGER DEFAULT 0,
            human_inputs_log JSONB DEFAULT '[]',
            started_at TIMESTAMPTZ DEFAULT NOW(),
            completed_at TIMESTAMPTZ,
            duration_ms DECIMAL(12, 2),
            metadata JSONB DEFAULT '{}'
        )
    """))
    
    op.execute(text("""
        CREATE TABLE workflow_steps (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
            step_index INTEGER NOT NULL,
            step_id VARCHAR(100) NOT NULL,
            step_name VARCHAR(200) NOT NULL,
            step_description TEXT,
            tool_path VARCHAR(200),
            tool_server VARCHAR(100),
            tool_params JSONB DEFAULT '{}',
            status VARCHAR(50) DEFAULT 'pending',
            result JSONB,
            error TEXT,
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            duration_ms DECIMAL(10, 2),
            retry_count INTEGER DEFAULT 0,
            CONSTRAINT uq_execution_step UNIQUE (execution_id, step_index)
        )
    """))
    
    op.execute(text("""
        CREATE TABLE hitl_requests (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,
            session_id VARCHAR(100) NOT NULL,
            request_type VARCHAR(50) NOT NULL,
            prompt TEXT NOT NULL,
            options JSONB,
            context JSONB DEFAULT '{}',
            timeout_seconds INTEGER DEFAULT 300,
            required BOOLEAN DEFAULT TRUE,
            default_value TEXT,
            response_value TEXT,
            response_skipped BOOLEAN DEFAULT FALSE,
            responded_at TIMESTAMPTZ,
            responder_id VARCHAR(100),
            status VARCHAR(50) DEFAULT 'pending',
            expired_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            metadata JSONB DEFAULT '{}'
        )
    """))
    
    op.execute(text("""
        CREATE TABLE governance_proposals (
            id VARCHAR(100) PRIMARY KEY,
            proposal_type VARCHAR(50) NOT NULL,
            title VARCHAR(500) NOT NULL,
            description TEXT,
            payload JSONB NOT NULL,
            requestor_id VARCHAR(100) NOT NULL,
            requestor_agent VARCHAR(50),
            tenant_id VARCHAR(50),
            execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,
            status VARCHAR(50) DEFAULT 'pending',
            estimated_cost DECIMAL(10, 4) DEFAULT 0,
            security_reviewed BOOLEAN DEFAULT FALSE,
            security_veto BOOLEAN DEFAULT FALSE,
            security_reason TEXT,
            security_risks JSONB DEFAULT '[]',
            security_reviewed_at TIMESTAMPTZ,
            votes JSONB DEFAULT '[]',
            votes_for INTEGER DEFAULT 0,
            votes_against INTEGER DEFAULT 0,
            abstentions INTEGER DEFAULT 0,
            quorum_met BOOLEAN DEFAULT FALSE,
            approved BOOLEAN,
            decision_reason TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            voting_started_at TIMESTAMPTZ,
            resolved_at TIMESTAMPTZ,
            metadata JSONB DEFAULT '{}'
        )
    """))
    
    op.execute(text("""
        CREATE TABLE agent_metrics (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            agent_id VARCHAR(50) NOT NULL,
            metric_date DATE NOT NULL,
            executions_total INTEGER DEFAULT 0,
            executions_success INTEGER DEFAULT 0,
            executions_failed INTEGER DEFAULT 0,
            avg_latency_ms DECIMAL(10, 2) DEFAULT 0,
            min_latency_ms DECIMAL(10, 2) DEFAULT 0,
            max_latency_ms DECIMAL(10, 2) DEFAULT 0,
            p50_latency_ms DECIMAL(10, 2) DEFAULT 0,
            p95_latency_ms DECIMAL(10, 2) DEFAULT 0,
            p99_latency_ms DECIMAL(10, 2) DEFAULT 0,
            tool_calls_total INTEGER DEFAULT 0,
            tool_calls_success INTEGER DEFAULT 0,
            tool_calls_failed INTEGER DEFAULT 0,
            top_tools JSONB DEFAULT '[]',
            hitl_requests_total INTEGER DEFAULT 0,
            hitl_requests_completed INTEGER DEFAULT 0,
            hitl_avg_response_time_ms DECIMAL(10, 2) DEFAULT 0,
            governance_requests INTEGER DEFAULT 0,
            governance_approved INTEGER DEFAULT 0,
            governance_denied INTEGER DEFAULT 0,
            total_cost DECIMAL(12, 4) DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            intent_matches JSONB DEFAULT '{}',
            routing_methods JSONB DEFAULT '{}',
            avg_intent_confidence DECIMAL(3, 2) DEFAULT 0,
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_agent_date UNIQUE (agent_id, metric_date)
        )
    """))
    
    op.execute(text("""
        CREATE TABLE tool_usage_stats (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tool_path VARCHAR(200) NOT NULL,
            usage_date DATE NOT NULL,
            calls_total INTEGER DEFAULT 0,
            calls_success INTEGER DEFAULT 0,
            calls_failed INTEGER DEFAULT 0,
            avg_latency_ms DECIMAL(10, 2) DEFAULT 0,
            min_latency_ms DECIMAL(10, 2) DEFAULT 0,
            max_latency_ms DECIMAL(10, 2) DEFAULT 0,
            calls_by_agent JSONB DEFAULT '{}',
            error_counts JSONB DEFAULT '{}',
            last_error TEXT,
            last_error_at TIMESTAMPTZ,
            circuit_trips INTEGER DEFAULT 0,
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_tool_date UNIQUE (tool_path, usage_date)
        )
    """))
    
    op.execute(text("""
        CREATE TABLE workflow_templates (
            id VARCHAR(100) PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            domain VARCHAR(50),
            agent_id VARCHAR(50),
            graph_definition JSONB NOT NULL,
            default_config JSONB DEFAULT '{}',
            version INTEGER DEFAULT 1,
            is_active BOOLEAN DEFAULT TRUE,
            created_by VARCHAR(100),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    # =============================================================================
    # INDEXES
    # =============================================================================
    
    # Core indexes
    op.execute(text("CREATE INDEX idx_users_tenant ON core.users(tenant_id)"))
    op.execute(text("CREATE INDEX idx_users_email ON core.users(email)"))
    op.execute(text("CREATE INDEX idx_conversations_tenant ON core.conversations(tenant_id)"))
    op.execute(text("CREATE INDEX idx_conversations_user ON core.conversations(user_id)"))
    op.execute(text("CREATE INDEX idx_messages_conversation ON core.messages(conversation_id)"))
    op.execute(text("CREATE INDEX idx_messages_created ON core.messages(created_at)"))
    
    # Agent indexes
    op.execute(text("CREATE INDEX idx_agent_state_agent ON agents.state(agent_id)"))
    op.execute(text("CREATE INDEX idx_agent_state_conversation ON agents.state(conversation_id)"))
    op.execute(text("CREATE INDEX idx_agent_metrics_agent ON agents.metrics(agent_id)"))
    op.execute(text("CREATE INDEX idx_agent_metrics_recorded ON agents.metrics(recorded_at)"))
    
    # Governance indexes
    op.execute(text("CREATE INDEX idx_proposals_tenant ON governance.proposals(tenant_id)"))
    op.execute(text("CREATE INDEX idx_proposals_status ON governance.proposals(status)"))
    op.execute(text("CREATE INDEX idx_votes_proposal ON governance.votes(proposal_id)"))
    op.execute(text("CREATE INDEX idx_cost_tracking_tenant ON governance.cost_tracking(tenant_id)"))
    
    # Knowledge indexes (including vector indexes)
    op.execute(text("CREATE INDEX idx_documents_tenant ON knowledge.documents(tenant_id)"))
    op.execute(text("CREATE INDEX idx_chunks_document ON knowledge.chunks(document_id)"))
    op.execute(text("CREATE INDEX idx_chunks_tenant ON knowledge.chunks(tenant_id)"))
    op.execute(text("CREATE INDEX idx_chunks_fts ON knowledge.chunks USING gin(content_tsv)"))
    op.execute(text("""
        CREATE INDEX idx_chunks_embedding ON knowledge.chunks
            USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    """))
    op.execute(text("CREATE INDEX idx_entities_tenant ON knowledge.entities(tenant_id)"))
    op.execute(text("CREATE INDEX idx_entities_user ON knowledge.entities(user_id)"))
    op.execute(text("CREATE INDEX idx_entities_type ON knowledge.entities(entity_type)"))
    op.execute(text("CREATE INDEX idx_relations_from ON knowledge.relations(from_entity_id)"))
    op.execute(text("CREATE INDEX idx_relations_to ON knowledge.relations(to_entity_id)"))
    
    # Audit indexes
    op.execute(text("CREATE INDEX idx_audit_tenant ON audit.events(tenant_id)"))
    op.execute(text("CREATE INDEX idx_audit_created ON audit.events(created_at)"))
    op.execute(text("CREATE INDEX idx_audit_actor ON audit.events(actor_type, actor_id)"))
    op.execute(text("CREATE INDEX idx_audit_resource ON audit.events(resource_type, resource_id)"))
    
    # MCP indexes
    op.execute(text("CREATE INDEX idx_mcp_invocations_tenant ON mcp.invocations(tenant_id)"))
    op.execute(text("CREATE INDEX idx_mcp_invocations_server ON mcp.invocations(server_name)"))
    op.execute(text("CREATE INDEX idx_mcp_invocations_agent ON mcp.invocations(agent)"))
    op.execute(text("CREATE INDEX idx_mcp_invocations_status ON mcp.invocations(status)"))
    op.execute(text("CREATE INDEX idx_mcp_invocations_started ON mcp.invocations(started_at)"))
    op.execute(text("CREATE INDEX idx_mcp_invocations_trace ON mcp.invocations(trace_id)"))
    op.execute(text("CREATE INDEX idx_mcp_servers_category ON mcp.servers(category)"))
    op.execute(text("CREATE INDEX idx_mcp_health_server ON mcp.health_history(server_name)"))
    op.execute(text("CREATE INDEX idx_mcp_health_checked ON mcp.health_history(checked_at)"))
    
    # Workflow indexes
    op.execute(text("CREATE INDEX idx_workflows_tenant ON workflows.definitions(tenant_id)"))
    op.execute(text("CREATE INDEX idx_workflows_active ON workflows.definitions(is_active) WHERE is_active = TRUE"))
    op.execute(text("CREATE INDEX idx_workflow_runs_workflow ON workflows.runs(workflow_id)"))
    op.execute(text("CREATE INDEX idx_workflow_runs_tenant ON workflows.runs(tenant_id)"))
    op.execute(text("CREATE INDEX idx_workflow_runs_status ON workflows.runs(status)"))
    op.execute(text("CREATE INDEX idx_workflow_runs_started ON workflows.runs(started_at)"))
    op.execute(text("CREATE INDEX idx_workflow_steps_run ON workflows.step_executions(run_id)"))
    op.execute(text("CREATE INDEX idx_workflow_schedules_next ON workflows.schedules(next_run_at) WHERE is_active = TRUE"))
    
    # Routing indexes (including vector indexes)
    op.execute(text("""
        CREATE INDEX idx_intents_embedding ON routing.intents
            USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)
    """))
    op.execute(text("""
        CREATE INDEX idx_utterance_embedding ON routing.intent_utterance_embeddings
            USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)
    """))
    op.execute(text("""
        CREATE INDEX idx_decisions_embedding ON routing.decisions
            USING hnsw (input_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)
    """))
    op.execute(text("CREATE INDEX idx_intents_category ON routing.intents(category_id)"))
    op.execute(text("CREATE INDEX idx_intents_agent ON routing.intents(target_agent)"))
    op.execute(text("CREATE INDEX idx_intents_active ON routing.intents(is_active) WHERE is_active = TRUE"))
    op.execute(text("CREATE INDEX idx_utterances_intent ON routing.intent_utterance_embeddings(intent_id)"))
    op.execute(text("CREATE INDEX idx_decisions_tenant ON routing.decisions(tenant_id)"))
    op.execute(text("CREATE INDEX idx_decisions_created ON routing.decisions(created_at)"))
    op.execute(text("CREATE INDEX idx_decisions_agent ON routing.decisions(selected_agent)"))
    op.execute(text("CREATE INDEX idx_decisions_intent ON routing.decisions(matched_intent_id)"))
    op.execute(text("CREATE INDEX idx_performance_date ON routing.performance_metrics(metric_date)"))
    op.execute(text("CREATE INDEX idx_keyword_rules_active ON routing.keyword_rules(is_active) WHERE is_active = TRUE"))
    op.execute(text("CREATE INDEX idx_context_overrides_active ON routing.context_overrides(is_active) WHERE is_active = TRUE"))
    
    # Workflow checkpoint indexes
    op.execute(text("CREATE INDEX idx_checkpoints_thread ON workflow_checkpoints(thread_id, created_at DESC)"))
    op.execute(text("CREATE INDEX idx_checkpoints_parent ON workflow_checkpoints(parent_id)"))
    op.execute(text("CREATE INDEX idx_checkpoints_created ON workflow_checkpoints(created_at DESC)"))
    op.execute(text("CREATE INDEX idx_executions_session ON workflow_executions(session_id)"))
    op.execute(text("CREATE INDEX idx_executions_thread ON workflow_executions(thread_id)"))
    op.execute(text("CREATE INDEX idx_executions_tenant ON workflow_executions(tenant_id)"))
    op.execute(text("CREATE INDEX idx_executions_user ON workflow_executions(user_id)"))
    op.execute(text("CREATE INDEX idx_executions_agent ON workflow_executions(agent_id)"))
    op.execute(text("CREATE INDEX idx_executions_phase ON workflow_executions(phase)"))
    op.execute(text("CREATE INDEX idx_executions_started ON workflow_executions(started_at DESC)"))
    op.execute(text("CREATE INDEX idx_executions_intent ON workflow_executions(intent_id)"))
    op.execute(text("CREATE INDEX idx_steps_execution ON workflow_steps(execution_id)"))
    op.execute(text("CREATE INDEX idx_steps_status ON workflow_steps(status)"))
    op.execute(text("CREATE INDEX idx_steps_tool ON workflow_steps(tool_path)"))
    op.execute(text("CREATE INDEX idx_hitl_execution ON hitl_requests(execution_id)"))
    op.execute(text("CREATE INDEX idx_hitl_session ON hitl_requests(session_id)"))
    op.execute(text("CREATE INDEX idx_hitl_status ON hitl_requests(status)"))
    op.execute(text("CREATE INDEX idx_hitl_created ON hitl_requests(created_at DESC)"))
    op.execute(text("CREATE INDEX idx_proposals_status ON governance_proposals(status)"))
    op.execute(text("CREATE INDEX idx_proposals_requestor ON governance_proposals(requestor_id)"))
    op.execute(text("CREATE INDEX idx_proposals_tenant ON governance_proposals(tenant_id)"))
    op.execute(text("CREATE INDEX idx_proposals_created ON governance_proposals(created_at DESC)"))
    op.execute(text("CREATE INDEX idx_proposals_execution ON governance_proposals(execution_id)"))
    op.execute(text("CREATE INDEX idx_metrics_agent ON agent_metrics(agent_id)"))
    op.execute(text("CREATE INDEX idx_metrics_date ON agent_metrics(metric_date DESC)"))
    op.execute(text("CREATE INDEX idx_tool_stats_path ON tool_usage_stats(tool_path)"))
    op.execute(text("CREATE INDEX idx_tool_stats_date ON tool_usage_stats(usage_date DESC)"))
    op.execute(text("CREATE INDEX idx_templates_domain ON workflow_templates(domain)"))
    op.execute(text("CREATE INDEX idx_templates_agent ON workflow_templates(agent_id)"))
    op.execute(text("CREATE INDEX idx_templates_active ON workflow_templates(is_active)"))
    
    # =============================================================================
    # ROW LEVEL SECURITY (RLS) POLICIES
    # =============================================================================
    
    # Enable RLS
    op.execute(text("ALTER TABLE core.users ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE core.conversations ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE core.messages ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE governance.proposals ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE governance.votes ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE governance.cost_tracking ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE knowledge.documents ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE knowledge.chunks ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE knowledge.entities ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE knowledge.relations ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE mcp.invocations ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE workflows.definitions ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE workflows.runs ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE workflows.step_executions ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE workflows.schedules ENABLE ROW LEVEL SECURITY"))
    op.execute(text("ALTER TABLE audit.events ENABLE ROW LEVEL SECURITY"))
    
    # Create RLS policies
    op.execute(text("""
        CREATE POLICY tenant_isolation_users ON core.users
            USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    """))
    
    op.execute(text("""
        CREATE POLICY tenant_isolation_conversations ON core.conversations
            USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    """))
    
    op.execute(text("""
        CREATE POLICY tenant_isolation_messages ON core.messages
            USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    """))
    
    op.execute(text("""
        CREATE POLICY tenant_isolation_proposals ON governance.proposals
            USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    """))
    
    op.execute(text("""
        CREATE POLICY tenant_isolation_documents ON knowledge.documents
            USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    """))
    
    op.execute(text("""
        CREATE POLICY tenant_isolation_chunks ON knowledge.chunks
            USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    """))
    
    op.execute(text("""
        CREATE POLICY tenant_isolation_entities ON knowledge.entities
            USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    """))
    
    op.execute(text("""
        CREATE POLICY tenant_isolation_mcp_invocations ON mcp.invocations
            USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    """))
    
    op.execute(text("""
        CREATE POLICY tenant_isolation_workflow_definitions ON workflows.definitions
            USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    """))
    
    op.execute(text("""
        CREATE POLICY tenant_isolation_workflow_runs ON workflows.runs
            USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    """))
    
    op.execute(text("""
        CREATE POLICY tenant_isolation_workflow_schedules ON workflows.schedules
            USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    """))
    
    # Audit RLS policies (from 003)
    # Note: audit.events uses actor_id (not user_id) to track who performed the action
    op.execute(text("""
        CREATE POLICY audit_events_user_policy ON audit.events
            FOR SELECT
            USING (
                (actor_id = current_setting('app.current_user_id', true))
                OR
                (
                    current_setting('app.current_user_roles', true) LIKE '%admin%'
                    AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
                )
            )
    """))
    
    op.execute(text("""
        CREATE POLICY audit_events_insert_policy ON audit.events
            FOR INSERT
            WITH CHECK (
                current_setting('app.service_account', true) = 'true'
            )
    """))
    
    # =============================================================================
    # FUNCTIONS (from 010 and 011)
    # =============================================================================
    
    # Routing functions (from 010)
    op.execute(text("""
        CREATE OR REPLACE FUNCTION routing.find_similar_intents(
            query_embedding vector(768),
            limit_count INTEGER DEFAULT 5,
            min_similarity DECIMAL DEFAULT 0.5
        )
        RETURNS TABLE (
            intent_id VARCHAR(100),
            intent_name VARCHAR(200),
            target_agent VARCHAR(50),
            similarity DECIMAL,
            confidence_threshold DECIMAL
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT
                i.id,
                i.name,
                i.target_agent,
                1 - (i.embedding <=> query_embedding) as similarity,
                i.confidence_threshold
            FROM routing.intents i
            WHERE i.is_active = TRUE
            AND 1 - (i.embedding <=> query_embedding) >= min_similarity
            ORDER BY i.embedding <=> query_embedding
            LIMIT limit_count;
        END;
        $$ LANGUAGE plpgsql
    """))
    
    op.execute(text("""
        CREATE OR REPLACE FUNCTION routing.find_similar_utterances(
            query_embedding vector(768),
            limit_count INTEGER DEFAULT 10,
            min_similarity DECIMAL DEFAULT 0.6
        )
        RETURNS TABLE (
            intent_id VARCHAR(100),
            utterance TEXT,
            similarity DECIMAL
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT
                u.intent_id,
                u.utterance,
                1 - (u.embedding <=> query_embedding) as similarity
            FROM routing.intent_utterance_embeddings u
            JOIN routing.intents i ON u.intent_id = i.id
            WHERE i.is_active = TRUE
            AND 1 - (u.embedding <=> query_embedding) >= min_similarity
            ORDER BY u.embedding <=> query_embedding
            LIMIT limit_count;
        END;
        $$ LANGUAGE plpgsql
    """))
    
    op.execute(text("""
        CREATE OR REPLACE FUNCTION routing.log_decision(
            p_tenant_id UUID,
            p_conversation_id UUID,
            p_message_id UUID,
            p_input_text TEXT,
            p_input_embedding vector(768),
            p_matched_intent_id VARCHAR(100),
            p_semantic_confidence DECIMAL,
            p_keyword_match BOOLEAN,
            p_context_override BOOLEAN,
            p_selected_agent VARCHAR(50),
            p_alternative_agents JSONB,
            p_routing_latency_ms INTEGER,
            p_routing_method VARCHAR(20)
        )
        RETURNS UUID AS $$
        DECLARE
            decision_id UUID;
        BEGIN
            INSERT INTO routing.decisions (
                tenant_id, conversation_id, message_id, input_text, input_embedding,
                matched_intent_id, semantic_confidence, keyword_match, context_override,
                selected_agent, alternative_agents, routing_latency_ms, routing_method
            ) VALUES (
                p_tenant_id, p_conversation_id, p_message_id, p_input_text, p_input_embedding,
                p_matched_intent_id, p_semantic_confidence, p_keyword_match, p_context_override,
                p_selected_agent, p_alternative_agents, p_routing_latency_ms, p_routing_method
            )
            RETURNING id INTO decision_id;
            RETURN decision_id;
        END;
        $$ LANGUAGE plpgsql
    """))
    
    op.execute(text("""
        CREATE OR REPLACE FUNCTION routing.update_daily_metrics()
        RETURNS void AS $$
        BEGIN
            INSERT INTO routing.performance_metrics (metric_date, intent_id, agent_id, total_routes, avg_confidence, avg_latency_ms, positive_feedback, negative_feedback)
            SELECT
                DATE(created_at) as metric_date,
                matched_intent_id,
                selected_agent,
                COUNT(*) as total_routes,
                AVG(semantic_confidence) as avg_confidence,
                AVG(routing_latency_ms) as avg_latency_ms,
                SUM(CASE WHEN feedback_score >= 4 THEN 1 ELSE 0 END) as positive_feedback,
                SUM(CASE WHEN feedback_score <= 2 THEN 1 ELSE 0 END) as negative_feedback
            FROM routing.decisions
            WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
            GROUP BY DATE(created_at), matched_intent_id, selected_agent
            ON CONFLICT (metric_date, intent_id, agent_id)
            DO UPDATE SET
                total_routes = EXCLUDED.total_routes,
                avg_confidence = EXCLUDED.avg_confidence,
                avg_latency_ms = EXCLUDED.avg_latency_ms,
                positive_feedback = EXCLUDED.positive_feedback,
                negative_feedback = EXCLUDED.negative_feedback;
        END;
        $$ LANGUAGE plpgsql
    """))
    
    # Workflow functions (from 011)
    op.execute(text("""
        CREATE OR REPLACE FUNCTION record_workflow_start(
            p_session_id VARCHAR(100),
            p_thread_id VARCHAR(100),
            p_agent_id VARCHAR(50),
            p_agent_name VARCHAR(100),
            p_task TEXT,
            p_tenant_id VARCHAR(50) DEFAULT NULL,
            p_user_id VARCHAR(100) DEFAULT NULL
        ) RETURNS UUID AS $$
        DECLARE
            v_id UUID;
        BEGIN
            INSERT INTO workflow_executions (
                session_id, thread_id, agent_id, agent_name,
                task_description, tenant_id, user_id, phase
            ) VALUES (
                p_session_id, p_thread_id, p_agent_id, p_agent_name,
                p_task, p_tenant_id, p_user_id, 'planning'
            )
            RETURNING id INTO v_id;
            RETURN v_id;
        END;
        $$ LANGUAGE plpgsql
    """))
    
    op.execute(text("""
        CREATE OR REPLACE FUNCTION record_workflow_complete(
            p_session_id VARCHAR(100),
            p_phase VARCHAR(50),
            p_final_result JSONB,
            p_final_response TEXT,
            p_actual_cost DECIMAL(10, 4) DEFAULT 0,
            p_token_usage JSONB DEFAULT '{}'
        ) RETURNS VOID AS $$
        BEGIN
            UPDATE workflow_executions
            SET
                phase = p_phase,
                final_result = p_final_result,
                final_response = p_final_response,
                actual_cost = p_actual_cost,
                token_usage = p_token_usage,
                completed_at = NOW(),
                duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
            WHERE session_id = p_session_id;
        END;
        $$ LANGUAGE plpgsql
    """))
    
    op.execute(text("""
        CREATE OR REPLACE FUNCTION get_latest_checkpoint(
            p_thread_id VARCHAR(100)
        ) RETURNS TABLE (
            id UUID,
            checkpoint_data JSONB,
            parent_id UUID,
            created_at TIMESTAMPTZ
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT c.id, c.checkpoint_data, c.parent_id, c.created_at
            FROM workflow_checkpoints c
            WHERE c.thread_id = p_thread_id
            ORDER BY c.created_at DESC
            LIMIT 1;
        END;
        $$ LANGUAGE plpgsql
    """))
    
    op.execute(text("""
        CREATE OR REPLACE FUNCTION update_agent_metrics(
            p_agent_id VARCHAR(50),
            p_success BOOLEAN,
            p_latency_ms DECIMAL(10, 2),
            p_cost DECIMAL(10, 4) DEFAULT 0,
            p_tokens INTEGER DEFAULT 0
        ) RETURNS VOID AS $$
        DECLARE
            v_date DATE := CURRENT_DATE;
        BEGIN
            INSERT INTO agent_metrics (agent_id, metric_date)
            VALUES (p_agent_id, v_date)
            ON CONFLICT (agent_id, metric_date) DO NOTHING;
            
            UPDATE agent_metrics
            SET
                executions_total = executions_total + 1,
                executions_success = executions_success + CASE WHEN p_success THEN 1 ELSE 0 END,
                executions_failed = executions_failed + CASE WHEN p_success THEN 0 ELSE 1 END,
                avg_latency_ms = (avg_latency_ms * executions_total + p_latency_ms) / (executions_total + 1),
                min_latency_ms = LEAST(COALESCE(NULLIF(min_latency_ms, 0), p_latency_ms), p_latency_ms),
                max_latency_ms = GREATEST(max_latency_ms, p_latency_ms),
                total_cost = total_cost + p_cost,
                total_tokens = total_tokens + p_tokens,
                updated_at = NOW()
            WHERE agent_id = p_agent_id AND metric_date = v_date;
        END;
        $$ LANGUAGE plpgsql
    """))
    
    op.execute(text("""
        CREATE OR REPLACE FUNCTION cleanup_old_checkpoints(
            p_retention_days INTEGER DEFAULT 7
        ) RETURNS INTEGER AS $$
        DECLARE
            v_deleted INTEGER;
        BEGIN
            DELETE FROM workflow_checkpoints
            WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL
            AND id NOT IN (
                SELECT DISTINCT ON (thread_id) id
                FROM workflow_checkpoints
                ORDER BY thread_id, created_at DESC
            );
            GET DIAGNOSTICS v_deleted = ROW_COUNT;
            RETURN v_deleted;
        END;
        $$ LANGUAGE plpgsql
    """))
    
    # Audit cleanup function (from 003)
    op.execute(text("""
        CREATE OR REPLACE FUNCTION audit.cleanup_old_events()
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
            DELETE FROM audit.events
            WHERE created_at < NOW() - INTERVAL '1 year';
            RAISE NOTICE 'Cleaned up old audit events';
        END;
        $$
    """))
    
    # =============================================================================
    # VIEWS (from 011)
    # =============================================================================
    
    op.execute(text("""
        CREATE OR REPLACE VIEW v_active_workflows AS
        SELECT
            e.id,
            e.session_id,
            e.agent_id,
            e.agent_name,
            e.task_description,
            e.phase,
            e.current_step,
            e.total_steps,
            e.tenant_id,
            e.user_id,
            e.started_at,
            EXTRACT(EPOCH FROM (NOW() - e.started_at)) * 1000 AS running_ms,
            (
                SELECT COUNT(*)
                FROM hitl_requests h
                WHERE h.execution_id = e.id AND h.status = 'pending'
            ) AS pending_hitl_requests
        FROM workflow_executions e
        WHERE e.phase NOT IN ('completed', 'failed')
        ORDER BY e.started_at DESC
    """))
    
    op.execute(text("""
        CREATE OR REPLACE VIEW v_agent_performance AS
        SELECT
            agent_id,
            SUM(executions_total) AS total_executions,
            SUM(executions_success) AS total_success,
            SUM(executions_failed) AS total_failed,
            ROUND(SUM(executions_success)::DECIMAL / NULLIF(SUM(executions_total), 0) * 100, 2) AS success_rate,
            ROUND(AVG(avg_latency_ms), 2) AS avg_latency_ms,
            ROUND(AVG(p95_latency_ms), 2) AS avg_p95_latency_ms,
            SUM(total_cost) AS total_cost,
            SUM(total_tokens) AS total_tokens,
            SUM(governance_requests) AS total_governance_requests,
            SUM(hitl_requests_total) AS total_hitl_requests,
            MAX(updated_at) AS last_updated
        FROM agent_metrics
        WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY agent_id
        ORDER BY total_executions DESC
    """))
    
    op.execute(text("""
        CREATE OR REPLACE VIEW v_tool_popularity AS
        SELECT
            tool_path,
            SUM(calls_total) AS total_calls,
            SUM(calls_success) AS success_calls,
            ROUND(SUM(calls_success)::DECIMAL / NULLIF(SUM(calls_total), 0) * 100, 2) AS success_rate,
            ROUND(AVG(avg_latency_ms), 2) AS avg_latency_ms,
            SUM(circuit_trips) AS total_circuit_trips,
            MAX(last_error_at) AS last_error_at
        FROM tool_usage_stats
        WHERE usage_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY tool_path
        ORDER BY total_calls DESC
    """))
    
    # =============================================================================
    # SEED DATA (from 001, 002, 010)
    # =============================================================================
    
    # Schema migrations table
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS public.schema_migrations (
            version VARCHAR(50) PRIMARY KEY,
            applied_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    
    # Agent registry seed data (from 001)
    op.execute(text("""
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
         '["mcp-langfuse"]'::jsonb)
        ON CONFLICT (id) DO NOTHING
    """))
    
    # MCP servers seed data (from 002) - truncated for brevity, includes key servers
    op.execute(text("""
        INSERT INTO mcp.servers (name, display_name, category, description, transport_type, tools) VALUES
        ('postgres-mcp', 'PostgreSQL', 'database', 'PostgreSQL database operations', 'stdio', 
         '["query", "execute", "describe_table", "list_tables"]'::jsonb),
        ('slack-mcp', 'Slack', 'productivity', 'Slack messaging integration', 'stdio',
         '["send_message", "list_channels", "get_messages"]'::jsonb),
        ('github-mcp', 'GitHub', 'productivity', 'GitHub repository operations', 'stdio',
         '["create_issue", "create_pr", "search_code", "get_file"]'::jsonb),
        ('memory-server', 'Memory Server', 'ai', 'Knowledge graph and persistent memory', 'stdio',
         '["create_entities", "delete_entities", "create_relations", "delete_relations", "add_observations", "delete_observations", "read_graph", "search_nodes", "open_nodes"]'::jsonb)
        ON CONFLICT (name) DO NOTHING
    """))
    
    # Intent categories seed data (from 010) - truncated for brevity
    op.execute(text("""
        INSERT INTO routing.intent_categories (id, name, description, priority_weight) VALUES
        ('communication', 'Communication', 'Email, messaging, notifications', 1.0),
        ('calendar', 'Calendar & Scheduling', 'Time and event management', 1.0),
        ('knowledge', 'Knowledge & Search', 'Information retrieval and search', 1.0),
        ('devops', 'Development & DevOps', 'Code, deployments, infrastructure', 1.0),
        ('analytics', 'Analytics & Data', 'Data analysis and insights', 1.0),
        ('security', 'Security', 'Security and access control', 1.2),
        ('system', 'System', 'System operations', 0.8)
        ON CONFLICT (id) DO NOTHING
    """))
    
    # Record migrations
    op.execute(text("INSERT INTO public.schema_migrations (version) VALUES ('001_initial_schema') ON CONFLICT DO NOTHING"))
    op.execute(text("INSERT INTO public.schema_migrations (version) VALUES ('002_mcp_workflows') ON CONFLICT DO NOTHING"))
    op.execute(text("INSERT INTO public.schema_migrations (version) VALUES ('003_audit_logging') ON CONFLICT DO NOTHING"))
    op.execute(text("INSERT INTO public.schema_migrations (version) VALUES ('010_intent_embeddings') ON CONFLICT DO NOTHING"))
    op.execute(text("INSERT INTO public.schema_migrations (version) VALUES ('011_workflow_checkpoints') ON CONFLICT DO NOTHING"))


def downgrade() -> None:
    """Rollback all migrations"""
    # Drop views
    op.execute(text("DROP VIEW IF EXISTS v_tool_popularity"))
    op.execute(text("DROP VIEW IF EXISTS v_agent_performance"))
    op.execute(text("DROP VIEW IF EXISTS v_active_workflows"))
    
    # Drop functions
    op.execute(text("DROP FUNCTION IF EXISTS cleanup_old_checkpoints(INTEGER)"))
    op.execute(text("DROP FUNCTION IF EXISTS update_agent_metrics(VARCHAR, BOOLEAN, DECIMAL, DECIMAL, INTEGER)"))
    op.execute(text("DROP FUNCTION IF EXISTS get_latest_checkpoint(VARCHAR)"))
    op.execute(text("DROP FUNCTION IF EXISTS record_workflow_complete(VARCHAR, VARCHAR, JSONB, TEXT, DECIMAL, JSONB)"))
    op.execute(text("DROP FUNCTION IF EXISTS record_workflow_start(VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR)"))
    op.execute(text("DROP FUNCTION IF EXISTS audit.cleanup_old_events()"))
    op.execute(text("DROP FUNCTION IF EXISTS routing.update_daily_metrics()"))
    op.execute(text("DROP FUNCTION IF EXISTS routing.log_decision(UUID, UUID, UUID, TEXT, vector, VARCHAR, DECIMAL, BOOLEAN, BOOLEAN, VARCHAR, JSONB, INTEGER, VARCHAR)"))
    op.execute(text("DROP FUNCTION IF EXISTS routing.find_similar_utterances(vector, INTEGER, DECIMAL)"))
    op.execute(text("DROP FUNCTION IF EXISTS routing.find_similar_intents(vector, INTEGER, DECIMAL)"))
    
    # Drop tables (in reverse order due to foreign keys)
    op.execute(text("DROP TABLE IF EXISTS public.schema_migrations"))
    op.execute(text("DROP TABLE IF EXISTS workflow_templates"))
    op.execute(text("DROP TABLE IF EXISTS tool_usage_stats"))
    op.execute(text("DROP TABLE IF EXISTS agent_metrics"))
    op.execute(text("DROP TABLE IF EXISTS governance_proposals"))
    op.execute(text("DROP TABLE IF EXISTS hitl_requests"))
    op.execute(text("DROP TABLE IF EXISTS workflow_steps"))
    op.execute(text("DROP TABLE IF EXISTS workflow_executions"))
    op.execute(text("DROP TABLE IF EXISTS workflow_checkpoints"))
    op.execute(text("DROP TABLE IF EXISTS routing.experiment_assignments"))
    op.execute(text("DROP TABLE IF EXISTS routing.experiments"))
    op.execute(text("DROP TABLE IF EXISTS routing.performance_metrics"))
    op.execute(text("DROP TABLE IF EXISTS routing.decisions"))
    op.execute(text("DROP TABLE IF EXISTS routing.context_overrides"))
    op.execute(text("DROP TABLE IF EXISTS routing.keyword_rules"))
    op.execute(text("DROP TABLE IF EXISTS routing.intent_utterance_embeddings"))
    op.execute(text("DROP TABLE IF EXISTS routing.intents"))
    op.execute(text("DROP TABLE IF EXISTS routing.intent_categories"))
    op.execute(text("DROP TABLE IF EXISTS workflows.schedules"))
    op.execute(text("DROP TABLE IF EXISTS workflows.step_executions"))
    op.execute(text("DROP TABLE IF EXISTS workflows.runs"))
    op.execute(text("DROP TABLE IF EXISTS workflows.definitions"))
    op.execute(text("DROP TABLE IF EXISTS mcp.health_history"))
    op.execute(text("DROP TABLE IF EXISTS mcp.invocations"))
    op.execute(text("DROP TABLE IF EXISTS mcp.servers"))
    op.execute(text("DROP TABLE IF EXISTS audit.events"))
    op.execute(text("DROP FUNCTION IF EXISTS audit.prevent_modification()"))
    op.execute(text("DROP TABLE IF EXISTS knowledge.relations"))
    op.execute(text("DROP TABLE IF EXISTS knowledge.entities"))
    op.execute(text("DROP TABLE IF EXISTS knowledge.chunks"))
    op.execute(text("DROP TABLE IF EXISTS knowledge.documents"))
    op.execute(text("DROP TABLE IF EXISTS governance.cost_tracking"))
    op.execute(text("DROP TABLE IF EXISTS governance.votes"))
    op.execute(text("DROP TABLE IF EXISTS governance.proposals"))
    op.execute(text("DROP TABLE IF EXISTS agents.metrics"))
    op.execute(text("DROP TABLE IF EXISTS agents.state"))
    op.execute(text("DROP TABLE IF EXISTS agents.registry"))
    op.execute(text("DROP TABLE IF EXISTS core.messages"))
    op.execute(text("DROP TABLE IF EXISTS core.conversations"))
    op.execute(text("DROP TABLE IF EXISTS core.users"))
    op.execute(text("DROP TABLE IF EXISTS core.tenants"))
    
    # Drop schemas
    op.execute(text("DROP SCHEMA IF EXISTS routing CASCADE"))
    op.execute(text("DROP SCHEMA IF EXISTS workflows CASCADE"))
    op.execute(text("DROP SCHEMA IF EXISTS mcp CASCADE"))
    op.execute(text("DROP SCHEMA IF EXISTS audit CASCADE"))
    op.execute(text("DROP SCHEMA IF EXISTS metrics CASCADE"))
    op.execute(text("DROP SCHEMA IF EXISTS knowledge CASCADE"))
    op.execute(text("DROP SCHEMA IF EXISTS governance CASCADE"))
    op.execute(text("DROP SCHEMA IF EXISTS agents CASCADE"))
    op.execute(text("DROP SCHEMA IF EXISTS core CASCADE"))
    
    # Note: Extensions are not dropped as they may be used by other databases
