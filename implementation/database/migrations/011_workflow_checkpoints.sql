-- ============================================================================
-- KOSMOS V2.0 Workflow Checkpoints Migration
--
-- Persistent state storage for LangGraph workflows:
-- - Checkpoint storage for resumable workflows
-- - Human-in-the-loop request tracking
-- - Workflow execution history
-- - Agent performance metrics
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Workflow Checkpoints (LangGraph State Persistence)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id VARCHAR(100) NOT NULL,
    checkpoint_data JSONB NOT NULL,
    parent_id UUID REFERENCES workflow_checkpoints(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes
    CONSTRAINT fk_parent CHECK (parent_id IS NULL OR parent_id != id)
);

CREATE INDEX idx_checkpoints_thread ON workflow_checkpoints(thread_id, created_at DESC);
CREATE INDEX idx_checkpoints_parent ON workflow_checkpoints(parent_id);
CREATE INDEX idx_checkpoints_created ON workflow_checkpoints(created_at DESC);

-- ============================================================================
-- Workflow Executions (Execution History)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) UNIQUE NOT NULL,
    thread_id VARCHAR(100) NOT NULL,

    -- Context
    tenant_id VARCHAR(50),
    user_id VARCHAR(100),
    trace_id VARCHAR(100),

    -- Agent info
    agent_id VARCHAR(50) NOT NULL,
    agent_name VARCHAR(100) NOT NULL,

    -- Task details
    task_description TEXT,
    intent_id VARCHAR(100),
    intent_confidence DECIMAL(3, 2),
    routing_method VARCHAR(50),

    -- Execution state
    phase VARCHAR(50) DEFAULT 'planning',
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER DEFAULT 0,

    -- Results
    final_result JSONB,
    final_response TEXT,
    error TEXT,

    -- Cost tracking
    estimated_cost DECIMAL(10, 4) DEFAULT 0,
    actual_cost DECIMAL(10, 4) DEFAULT 0,
    token_usage JSONB DEFAULT '{}',

    -- Governance
    requires_governance BOOLEAN DEFAULT FALSE,
    governance_proposal_id VARCHAR(100),
    governance_approved BOOLEAN,
    governance_reason TEXT,

    -- HITL
    human_inputs_count INTEGER DEFAULT 0,
    human_inputs_log JSONB DEFAULT '[]',

    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms DECIMAL(12, 2),

    -- Metadata
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_executions_session ON workflow_executions(session_id);
CREATE INDEX idx_executions_thread ON workflow_executions(thread_id);
CREATE INDEX idx_executions_tenant ON workflow_executions(tenant_id);
CREATE INDEX idx_executions_user ON workflow_executions(user_id);
CREATE INDEX idx_executions_agent ON workflow_executions(agent_id);
CREATE INDEX idx_executions_phase ON workflow_executions(phase);
CREATE INDEX idx_executions_started ON workflow_executions(started_at DESC);
CREATE INDEX idx_executions_intent ON workflow_executions(intent_id);

-- ============================================================================
-- Workflow Steps (Execution Steps Detail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,

    -- Step info
    step_id VARCHAR(100) NOT NULL,
    step_name VARCHAR(200) NOT NULL,
    step_description TEXT,

    -- Tool info
    tool_path VARCHAR(200),
    tool_server VARCHAR(100),
    tool_params JSONB DEFAULT '{}',

    -- Execution
    status VARCHAR(50) DEFAULT 'pending',
    result JSONB,
    error TEXT,

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms DECIMAL(10, 2),

    -- Retry info
    retry_count INTEGER DEFAULT 0,

    CONSTRAINT uq_execution_step UNIQUE (execution_id, step_index)
);

CREATE INDEX idx_steps_execution ON workflow_steps(execution_id);
CREATE INDEX idx_steps_status ON workflow_steps(status);
CREATE INDEX idx_steps_tool ON workflow_steps(tool_path);

-- ============================================================================
-- Human-in-the-Loop Requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS hitl_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,
    session_id VARCHAR(100) NOT NULL,

    -- Request details
    request_type VARCHAR(50) NOT NULL,
    prompt TEXT NOT NULL,
    options JSONB,
    context JSONB DEFAULT '{}',

    -- Configuration
    timeout_seconds INTEGER DEFAULT 300,
    required BOOLEAN DEFAULT TRUE,
    default_value TEXT,

    -- Response
    response_value TEXT,
    response_skipped BOOLEAN DEFAULT FALSE,
    responded_at TIMESTAMPTZ,
    responder_id VARCHAR(100),

    -- Status
    status VARCHAR(50) DEFAULT 'pending',
    expired_at TIMESTAMPTZ,

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Metadata
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_hitl_execution ON hitl_requests(execution_id);
CREATE INDEX idx_hitl_session ON hitl_requests(session_id);
CREATE INDEX idx_hitl_status ON hitl_requests(status);
CREATE INDEX idx_hitl_created ON hitl_requests(created_at DESC);

-- ============================================================================
-- Governance Proposals (Enhanced)
-- ============================================================================

CREATE TABLE IF NOT EXISTS governance_proposals (
    id VARCHAR(100) PRIMARY KEY,

    -- Proposal info
    proposal_type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    payload JSONB NOT NULL,

    -- Context
    requestor_id VARCHAR(100) NOT NULL,
    requestor_agent VARCHAR(50),
    tenant_id VARCHAR(50),
    execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,

    -- Status
    status VARCHAR(50) DEFAULT 'pending',

    -- Cost
    estimated_cost DECIMAL(10, 4) DEFAULT 0,

    -- Security
    security_reviewed BOOLEAN DEFAULT FALSE,
    security_veto BOOLEAN DEFAULT FALSE,
    security_reason TEXT,
    security_risks JSONB DEFAULT '[]',
    security_reviewed_at TIMESTAMPTZ,

    -- Voting
    votes JSONB DEFAULT '[]',
    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    abstentions INTEGER DEFAULT 0,
    quorum_met BOOLEAN DEFAULT FALSE,

    -- Decision
    approved BOOLEAN,
    decision_reason TEXT,

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    voting_started_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_proposals_status ON governance_proposals(status);
CREATE INDEX idx_proposals_requestor ON governance_proposals(requestor_id);
CREATE INDEX idx_proposals_tenant ON governance_proposals(tenant_id);
CREATE INDEX idx_proposals_created ON governance_proposals(created_at DESC);
CREATE INDEX idx_proposals_execution ON governance_proposals(execution_id);

-- ============================================================================
-- Agent Metrics (Performance Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(50) NOT NULL,
    metric_date DATE NOT NULL,

    -- Execution counts
    executions_total INTEGER DEFAULT 0,
    executions_success INTEGER DEFAULT 0,
    executions_failed INTEGER DEFAULT 0,

    -- Latency
    avg_latency_ms DECIMAL(10, 2) DEFAULT 0,
    min_latency_ms DECIMAL(10, 2) DEFAULT 0,
    max_latency_ms DECIMAL(10, 2) DEFAULT 0,
    p50_latency_ms DECIMAL(10, 2) DEFAULT 0,
    p95_latency_ms DECIMAL(10, 2) DEFAULT 0,
    p99_latency_ms DECIMAL(10, 2) DEFAULT 0,

    -- Tool usage
    tool_calls_total INTEGER DEFAULT 0,
    tool_calls_success INTEGER DEFAULT 0,
    tool_calls_failed INTEGER DEFAULT 0,
    top_tools JSONB DEFAULT '[]',

    -- HITL
    hitl_requests_total INTEGER DEFAULT 0,
    hitl_requests_completed INTEGER DEFAULT 0,
    hitl_avg_response_time_ms DECIMAL(10, 2) DEFAULT 0,

    -- Governance
    governance_requests INTEGER DEFAULT 0,
    governance_approved INTEGER DEFAULT 0,
    governance_denied INTEGER DEFAULT 0,

    -- Cost
    total_cost DECIMAL(12, 4) DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,

    -- Intent routing
    intent_matches JSONB DEFAULT '{}',
    routing_methods JSONB DEFAULT '{}',
    avg_intent_confidence DECIMAL(3, 2) DEFAULT 0,

    -- Timestamps
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_agent_date UNIQUE (agent_id, metric_date)
);

CREATE INDEX idx_metrics_agent ON agent_metrics(agent_id);
CREATE INDEX idx_metrics_date ON agent_metrics(metric_date DESC);

-- ============================================================================
-- Tool Usage Stats (Per-Tool Analytics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tool_usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_path VARCHAR(200) NOT NULL,
    usage_date DATE NOT NULL,

    -- Counts
    calls_total INTEGER DEFAULT 0,
    calls_success INTEGER DEFAULT 0,
    calls_failed INTEGER DEFAULT 0,

    -- Latency
    avg_latency_ms DECIMAL(10, 2) DEFAULT 0,
    min_latency_ms DECIMAL(10, 2) DEFAULT 0,
    max_latency_ms DECIMAL(10, 2) DEFAULT 0,

    -- By agent
    calls_by_agent JSONB DEFAULT '{}',

    -- Errors
    error_counts JSONB DEFAULT '{}',
    last_error TEXT,
    last_error_at TIMESTAMPTZ,

    -- Circuit breaker
    circuit_trips INTEGER DEFAULT 0,

    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_tool_date UNIQUE (tool_path, usage_date)
);

CREATE INDEX idx_tool_stats_path ON tool_usage_stats(tool_path);
CREATE INDEX idx_tool_stats_date ON tool_usage_stats(usage_date DESC);

-- ============================================================================
-- Workflow Templates (Reusable Workflow Patterns)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_templates (
    id VARCHAR(100) PRIMARY KEY,

    -- Template info
    name VARCHAR(200) NOT NULL,
    description TEXT,
    domain VARCHAR(50),
    agent_id VARCHAR(50),

    -- Definition
    graph_definition JSONB NOT NULL,
    default_config JSONB DEFAULT '{}',

    -- Versioning
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_domain ON workflow_templates(domain);
CREATE INDEX idx_templates_agent ON workflow_templates(agent_id);
CREATE INDEX idx_templates_active ON workflow_templates(is_active);

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to record workflow start
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
$$ LANGUAGE plpgsql;

-- Function to record workflow completion
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
$$ LANGUAGE plpgsql;

-- Function to get checkpoint by thread
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
$$ LANGUAGE plpgsql;

-- Function to update agent metrics
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
$$ LANGUAGE plpgsql;

-- Function to clean old checkpoints
CREATE OR REPLACE FUNCTION cleanup_old_checkpoints(
    p_retention_days INTEGER DEFAULT 7
) RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM workflow_checkpoints
    WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL
    AND id NOT IN (
        -- Keep latest checkpoint per thread
        SELECT DISTINCT ON (thread_id) id
        FROM workflow_checkpoints
        ORDER BY thread_id, created_at DESC
    );

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Views
-- ============================================================================

-- Active workflows view
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
ORDER BY e.started_at DESC;

-- Agent performance summary view
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
ORDER BY total_executions DESC;

-- Tool popularity view
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
ORDER BY total_calls DESC;

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_checkpoints TO kosmos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_executions TO kosmos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_steps TO kosmos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON hitl_requests TO kosmos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON governance_proposals TO kosmos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_metrics TO kosmos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON tool_usage_stats TO kosmos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_templates TO kosmos_app;

GRANT SELECT ON v_active_workflows TO kosmos_app;
GRANT SELECT ON v_agent_performance TO kosmos_app;
GRANT SELECT ON v_tool_popularity TO kosmos_app;

GRANT EXECUTE ON FUNCTION record_workflow_start TO kosmos_app;
GRANT EXECUTE ON FUNCTION record_workflow_complete TO kosmos_app;
GRANT EXECUTE ON FUNCTION get_latest_checkpoint TO kosmos_app;
GRANT EXECUTE ON FUNCTION update_agent_metrics TO kosmos_app;
GRANT EXECUTE ON FUNCTION cleanup_old_checkpoints TO kosmos_app;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE workflow_checkpoints IS 'LangGraph state checkpoints for resumable workflows';
COMMENT ON TABLE workflow_executions IS 'Workflow execution history and tracking';
COMMENT ON TABLE workflow_steps IS 'Individual step execution details within workflows';
COMMENT ON TABLE hitl_requests IS 'Human-in-the-loop input requests and responses';
COMMENT ON TABLE governance_proposals IS 'Pentarchy governance proposals and voting';
COMMENT ON TABLE agent_metrics IS 'Daily aggregated agent performance metrics';
COMMENT ON TABLE tool_usage_stats IS 'Daily tool usage statistics';
COMMENT ON TABLE workflow_templates IS 'Reusable workflow template definitions';
