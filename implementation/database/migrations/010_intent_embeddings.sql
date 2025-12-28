-- =============================================================================
-- KOSMOS V2.0 Database Schema - Migration 010
-- Semantic Router Intent Embeddings
-- =============================================================================

-- Create routing schema
CREATE SCHEMA IF NOT EXISTS routing;

-- =============================================================================
-- INTENT TAXONOMY - Hierarchical Intent Classification
-- =============================================================================

-- Intent categories (top-level grouping)
CREATE TABLE routing.intent_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_category_id VARCHAR(50) REFERENCES routing.intent_categories(id),
    priority_weight DECIMAL(3, 2) DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Intent definitions with embeddings
CREATE TABLE routing.intents (
    id VARCHAR(100) PRIMARY KEY,
    category_id VARCHAR(50) NOT NULL REFERENCES routing.intent_categories(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    example_utterances TEXT[] NOT NULL,
    embedding vector(768),  -- Sentence transformer dimensions
    target_agent VARCHAR(50) NOT NULL,
    secondary_agents VARCHAR(50)[] DEFAULT '{}',
    required_capabilities VARCHAR(100)[] DEFAULT '{}',
    confidence_threshold DECIMAL(3, 2) DEFAULT 0.75,
    priority INTEGER DEFAULT 5,
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Intent embeddings for all example utterances
CREATE TABLE routing.intent_utterance_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    intent_id VARCHAR(100) NOT NULL REFERENCES routing.intents(id) ON DELETE CASCADE,
    utterance TEXT NOT NULL,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ROUTING RULES - Fallback and Override Logic
-- =============================================================================

-- Keyword-based fallback rules (when semantic match low confidence)
CREATE TABLE routing.keyword_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern TEXT NOT NULL,  -- Regex pattern
    pattern_type VARCHAR(20) DEFAULT 'regex' CHECK (pattern_type IN ('regex', 'exact', 'contains')),
    target_agent VARCHAR(50) NOT NULL,
    priority INTEGER DEFAULT 5,
    confidence_boost DECIMAL(3, 2) DEFAULT 0.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Context-aware routing overrides
CREATE TABLE routing.context_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    context_condition JSONB NOT NULL,  -- e.g., {"previous_agent": "hermes", "topic": "email"}
    target_agent VARCHAR(50) NOT NULL,
    priority INTEGER DEFAULT 10,
    valid_duration_minutes INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ROUTING HISTORY - Analytics and Learning
-- =============================================================================

-- Routing decisions log
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
    alternative_agents JSONB DEFAULT '[]',  -- [{"agent": "x", "confidence": 0.6}]
    routing_latency_ms INTEGER,
    routing_method VARCHAR(20) CHECK (routing_method IN ('semantic', 'keyword', 'context', 'fallback')),
    feedback_score INTEGER CHECK (feedback_score >= 1 AND feedback_score <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Routing performance aggregates (materialized for dashboards)
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
);

-- =============================================================================
-- A/B TESTING - Routing Strategy Experiments
-- =============================================================================

CREATE TABLE routing.experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    strategy_a JSONB NOT NULL,  -- {"type": "semantic", "threshold": 0.75}
    strategy_b JSONB NOT NULL,
    traffic_split DECIMAL(3, 2) DEFAULT 0.5,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    winner VARCHAR(10),  -- 'a', 'b', or null
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE routing.experiment_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_id UUID NOT NULL REFERENCES routing.experiments(id),
    user_id UUID NOT NULL,
    assigned_strategy VARCHAR(10) NOT NULL CHECK (assigned_strategy IN ('a', 'b')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(experiment_id, user_id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Semantic search indexes (HNSW for better performance than IVFFlat)
CREATE INDEX idx_intents_embedding ON routing.intents
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_utterance_embedding ON routing.intent_utterance_embeddings
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_decisions_embedding ON routing.decisions
    USING hnsw (input_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Lookup indexes
CREATE INDEX idx_intents_category ON routing.intents(category_id);
CREATE INDEX idx_intents_agent ON routing.intents(target_agent);
CREATE INDEX idx_intents_active ON routing.intents(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_utterances_intent ON routing.intent_utterance_embeddings(intent_id);

CREATE INDEX idx_decisions_tenant ON routing.decisions(tenant_id);
CREATE INDEX idx_decisions_created ON routing.decisions(created_at);
CREATE INDEX idx_decisions_agent ON routing.decisions(selected_agent);
CREATE INDEX idx_decisions_intent ON routing.decisions(matched_intent_id);

CREATE INDEX idx_performance_date ON routing.performance_metrics(metric_date);

CREATE INDEX idx_keyword_rules_active ON routing.keyword_rules(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_context_overrides_active ON routing.context_overrides(is_active) WHERE is_active = TRUE;

-- =============================================================================
-- SEED DATA - Intent Taxonomy
-- =============================================================================

-- Insert intent categories
INSERT INTO routing.intent_categories (id, name, description, priority_weight) VALUES
-- Communication category
('communication', 'Communication', 'Email, messaging, notifications', 1.0),
('communication.email', 'Email Operations', 'Email-specific operations', 1.0),
('communication.messaging', 'Messaging', 'Chat and instant messaging', 1.0),
('communication.notifications', 'Notifications', 'Alerts and notifications', 0.9),

-- Calendar & Scheduling
('calendar', 'Calendar & Scheduling', 'Time and event management', 1.0),
('calendar.events', 'Event Management', 'Create, update, delete events', 1.0),
('calendar.availability', 'Availability', 'Check and manage availability', 0.9),

-- Knowledge & Search
('knowledge', 'Knowledge & Search', 'Information retrieval and search', 1.0),
('knowledge.search', 'Search', 'Find information', 1.0),
('knowledge.documents', 'Documents', 'Document operations', 1.0),
('knowledge.memory', 'Memory', 'Context and memory operations', 0.9),

-- Development & DevOps
('devops', 'Development & DevOps', 'Code, deployments, infrastructure', 1.0),
('devops.code', 'Code Operations', 'Code review, generation', 1.0),
('devops.deployment', 'Deployment', 'Deploy and release', 1.0),
('devops.infrastructure', 'Infrastructure', 'Infra management', 0.9),

-- Analytics & Data
('analytics', 'Analytics & Data', 'Data analysis and insights', 1.0),
('analytics.reports', 'Reports', 'Generate reports', 1.0),
('analytics.visualization', 'Visualization', 'Charts and graphs', 0.9),

-- Finance
('finance', 'Finance', 'Financial operations', 1.0),
('finance.payments', 'Payments', 'Payment processing', 1.0),
('finance.billing', 'Billing', 'Invoices and billing', 0.9),

-- Security
('security', 'Security', 'Security and access control', 1.2),  -- Higher weight for security
('security.access', 'Access Control', 'Permissions and access', 1.2),
('security.audit', 'Audit', 'Audit and compliance', 1.1),

-- System & Meta
('system', 'System', 'System operations', 0.8),
('system.help', 'Help', 'Help and guidance', 0.8),
('system.settings', 'Settings', 'Configuration and preferences', 0.8);

-- Update parent references
UPDATE routing.intent_categories SET parent_category_id = 'communication' WHERE id LIKE 'communication.%';
UPDATE routing.intent_categories SET parent_category_id = 'calendar' WHERE id LIKE 'calendar.%';
UPDATE routing.intent_categories SET parent_category_id = 'knowledge' WHERE id LIKE 'knowledge.%';
UPDATE routing.intent_categories SET parent_category_id = 'devops' WHERE id LIKE 'devops.%';
UPDATE routing.intent_categories SET parent_category_id = 'analytics' WHERE id LIKE 'analytics.%';
UPDATE routing.intent_categories SET parent_category_id = 'finance' WHERE id LIKE 'finance.%';
UPDATE routing.intent_categories SET parent_category_id = 'security' WHERE id LIKE 'security.%';
UPDATE routing.intent_categories SET parent_category_id = 'system' WHERE id LIKE 'system.%';

-- =============================================================================
-- SEED DATA - Intent Definitions (50+ intents)
-- =============================================================================

INSERT INTO routing.intents (id, category_id, name, description, example_utterances, target_agent, secondary_agents, confidence_threshold, priority) VALUES

-- Email intents (Hermes)
('email.send', 'communication.email', 'Send Email', 'Send a new email message',
 ARRAY['send an email to', 'compose email', 'write an email', 'email them about', 'send a message to', 'draft an email', 'mail this to'],
 'hermes', '{}', 0.75, 5),

('email.read', 'communication.email', 'Read Email', 'Check and read emails',
 ARRAY['check my email', 'read my inbox', 'show me emails from', 'any new emails', 'what emails do I have', 'check inbox', 'read messages'],
 'hermes', '{}', 0.75, 5),

('email.reply', 'communication.email', 'Reply to Email', 'Reply to an email',
 ARRAY['reply to this email', 'respond to', 'answer this email', 'write back to', 'send a reply'],
 'hermes', '{}', 0.75, 5),

('email.search', 'communication.email', 'Search Email', 'Search through emails',
 ARRAY['find emails about', 'search my emails for', 'look for email from', 'find that email', 'search inbox for'],
 'hermes', ARRAY['athena'], 0.7, 5),

-- Messaging intents (Hermes)
('messaging.slack', 'communication.messaging', 'Slack Message', 'Send Slack messages',
 ARRAY['send slack message', 'message on slack', 'post in slack', 'slack them', 'send to slack channel', 'post in #channel'],
 'hermes', '{}', 0.75, 5),

('messaging.teams', 'communication.messaging', 'Teams Message', 'Send Microsoft Teams messages',
 ARRAY['send teams message', 'message on teams', 'post in teams', 'teams chat', 'send to teams channel'],
 'hermes', '{}', 0.75, 5),

('messaging.whatsapp', 'communication.messaging', 'WhatsApp Message', 'Send WhatsApp messages',
 ARRAY['send whatsapp', 'whatsapp message', 'message on whatsapp', 'text them on whatsapp'],
 'hermes', '{}', 0.75, 5),

-- Notification intents (Iris)
('notify.alert', 'communication.notifications', 'Send Alert', 'Send an alert or notification',
 ARRAY['alert me when', 'notify me about', 'send notification', 'create alert for', 'let me know when'],
 'iris', '{}', 0.7, 6),

('notify.reminder', 'communication.notifications', 'Set Reminder', 'Set a reminder',
 ARRAY['remind me to', 'set a reminder', 'don''t let me forget', 'reminder for', 'remind me about'],
 'chronos', ARRAY['iris'], 0.75, 5),

-- Calendar intents (Chronos)
('calendar.create', 'calendar.events', 'Create Event', 'Create calendar event',
 ARRAY['schedule a meeting', 'create event', 'add to calendar', 'book a meeting', 'set up a call', 'schedule time for', 'plan a meeting'],
 'chronos', '{}', 0.8, 5),

('calendar.view', 'calendar.events', 'View Calendar', 'View calendar events',
 ARRAY['show my calendar', 'what''s on my calendar', 'my schedule for', 'what meetings do I have', 'check my calendar', 'show my schedule'],
 'chronos', '{}', 0.75, 5),

('calendar.reschedule', 'calendar.events', 'Reschedule Event', 'Reschedule a calendar event',
 ARRAY['reschedule the meeting', 'move the meeting', 'change meeting time', 'postpone the event', 'push back the meeting'],
 'chronos', '{}', 0.75, 5),

('calendar.cancel', 'calendar.events', 'Cancel Event', 'Cancel a calendar event',
 ARRAY['cancel the meeting', 'delete the event', 'remove from calendar', 'cancel my appointment'],
 'chronos', '{}', 0.8, 6),

('calendar.availability', 'calendar.availability', 'Check Availability', 'Check availability',
 ARRAY['when am I free', 'check my availability', 'find a free slot', 'when can we meet', 'am I available on', 'find time for'],
 'chronos', '{}', 0.75, 5),

-- Knowledge/Search intents (Athena)
('search.general', 'knowledge.search', 'General Search', 'Search for information',
 ARRAY['search for', 'find information about', 'look up', 'what is', 'tell me about', 'explain', 'find out about'],
 'athena', '{}', 0.65, 4),

('search.documents', 'knowledge.documents', 'Search Documents', 'Search documents',
 ARRAY['find document', 'search files for', 'look in documents', 'find the file about', 'search my docs'],
 'athena', '{}', 0.75, 5),

('documents.summarize', 'knowledge.documents', 'Summarize Document', 'Summarize a document',
 ARRAY['summarize this', 'give me a summary', 'what''s the gist of', 'summarize the document', 'TLDR', 'brief summary of'],
 'athena', '{}', 0.75, 5),

('memory.remember', 'knowledge.memory', 'Remember Information', 'Store in memory',
 ARRAY['remember that', 'save this', 'note that', 'keep in mind', 'store this information', 'don''t forget that'],
 'memorix', '{}', 0.75, 5),

('memory.recall', 'knowledge.memory', 'Recall Information', 'Retrieve from memory',
 ARRAY['what do you remember about', 'recall', 'what did I tell you about', 'remember when I said', 'what do you know about'],
 'memorix', '{}', 0.7, 5),

-- DevOps intents (Hephaestus)
('code.review', 'devops.code', 'Code Review', 'Review code',
 ARRAY['review this code', 'code review for', 'check this PR', 'look at this pull request', 'review the changes'],
 'hephaestus', '{}', 0.75, 5),

('code.generate', 'devops.code', 'Generate Code', 'Generate code',
 ARRAY['write code for', 'generate code', 'create a function for', 'implement', 'code this', 'write a script to'],
 'hephaestus', '{}', 0.7, 5),

('code.explain', 'devops.code', 'Explain Code', 'Explain code',
 ARRAY['explain this code', 'what does this code do', 'how does this work', 'walk me through this'],
 'hephaestus', ARRAY['athena'], 0.7, 5),

('deploy.trigger', 'devops.deployment', 'Trigger Deployment', 'Deploy application',
 ARRAY['deploy to', 'push to production', 'release to', 'deploy the app', 'trigger deployment', 'ship it'],
 'hephaestus', '{}', 0.8, 6),

('deploy.status', 'devops.deployment', 'Deployment Status', 'Check deployment status',
 ARRAY['deployment status', 'is the deployment done', 'check deploy status', 'how''s the deployment going'],
 'hephaestus', '{}', 0.75, 5),

('deploy.rollback', 'devops.deployment', 'Rollback Deployment', 'Rollback a deployment',
 ARRAY['rollback the deployment', 'revert to previous version', 'undo deployment', 'rollback to'],
 'hephaestus', '{}', 0.85, 7),

('infra.status', 'devops.infrastructure', 'Infrastructure Status', 'Check infra status',
 ARRAY['server status', 'infrastructure health', 'check system status', 'how are the servers', 'is everything running'],
 'hephaestus', '{}', 0.7, 5),

('infra.provision', 'devops.infrastructure', 'Provision Infrastructure', 'Provision resources',
 ARRAY['spin up a server', 'create new instance', 'provision resources', 'terraform apply', 'create infrastructure'],
 'hephaestus', '{}', 0.8, 6),

-- Analytics intents (Athena / Nur Prometheus)
('analytics.report', 'analytics.reports', 'Generate Report', 'Generate analytics report',
 ARRAY['generate a report', 'create report for', 'give me analytics', 'show me the numbers', 'report on', 'analyze the data'],
 'nur_prometheus', ARRAY['athena'], 0.75, 5),

('analytics.metrics', 'analytics.reports', 'Get Metrics', 'Get specific metrics',
 ARRAY['what are our metrics', 'show me KPIs', 'revenue numbers', 'user statistics', 'performance metrics'],
 'nur_prometheus', '{}', 0.7, 5),

('analytics.chart', 'analytics.visualization', 'Create Chart', 'Create visualization',
 ARRAY['create a chart', 'visualize this data', 'make a graph', 'show as a chart', 'plot this'],
 'nur_prometheus', '{}', 0.75, 5),

('analytics.forecast', 'analytics.reports', 'Forecast', 'Generate forecast',
 ARRAY['forecast for', 'predict', 'what will be', 'projection for', 'estimate future'],
 'morpheus', ARRAY['nur_prometheus'], 0.7, 5),

-- Finance intents (Nur Prometheus)
('finance.payment', 'finance.payments', 'Process Payment', 'Process a payment',
 ARRAY['process payment', 'charge the customer', 'create payment for', 'bill them', 'send invoice'],
 'nur_prometheus', '{}', 0.8, 6),

('finance.refund', 'finance.payments', 'Process Refund', 'Process a refund',
 ARRAY['process refund', 'refund the payment', 'give them a refund', 'reverse the charge'],
 'nur_prometheus', '{}', 0.85, 7),

('finance.balance', 'finance.billing', 'Check Balance', 'Check account balance',
 ARRAY['check balance', 'account balance', 'how much do we have', 'current balance'],
 'nur_prometheus', '{}', 0.75, 5),

('finance.expense', 'finance.billing', 'Track Expense', 'Track an expense',
 ARRAY['log expense', 'record expense', 'track this expense', 'add expense for'],
 'nur_prometheus', '{}', 0.75, 5),

-- Security intents (AEGIS)
('security.scan', 'security.access', 'Security Scan', 'Run security scan',
 ARRAY['run security scan', 'check for vulnerabilities', 'security audit', 'scan for threats'],
 'aegis', '{}', 0.8, 7),

('security.permissions', 'security.access', 'Manage Permissions', 'Manage access permissions',
 ARRAY['grant access to', 'revoke access', 'change permissions', 'who has access to', 'add user to'],
 'aegis', '{}', 0.8, 6),

('security.audit', 'security.audit', 'Audit Logs', 'Review audit logs',
 ARRAY['show audit logs', 'who did what', 'activity log', 'access history', 'audit trail'],
 'aegis', '{}', 0.75, 5),

('security.incident', 'security.access', 'Report Incident', 'Report security incident',
 ARRAY['security incident', 'report breach', 'suspicious activity', 'someone hacked', 'unauthorized access'],
 'aegis', '{}', 0.9, 8),

-- System intents (Zeus)
('system.help', 'system.help', 'Get Help', 'Request help',
 ARRAY['help me with', 'how do I', 'what can you do', 'show me how to', 'I need help with'],
 'zeus', '{}', 0.6, 3),

('system.settings', 'system.settings', 'Manage Settings', 'Manage settings',
 ARRAY['change my settings', 'update preferences', 'configure', 'settings for', 'adjust my'],
 'hestia', '{}', 0.7, 5),

('system.status', 'system.settings', 'System Status', 'Check system status',
 ARRAY['system status', 'health check', 'is everything working', 'status check'],
 'hephaestus', '{}', 0.7, 5),

-- Task intents (Zeus orchestration)
('task.create', 'system.settings', 'Create Task', 'Create a task',
 ARRAY['create a task', 'add todo', 'new task for', 'add to my tasks', 'create ticket for'],
 'zeus', ARRAY['hephaestus'], 0.7, 5),

('task.list', 'system.settings', 'List Tasks', 'List tasks',
 ARRAY['show my tasks', 'what''s on my todo', 'list my tasks', 'what do I need to do', 'pending tasks'],
 'zeus', '{}', 0.7, 5),

('task.complete', 'system.settings', 'Complete Task', 'Mark task complete',
 ARRAY['mark as done', 'complete this task', 'finished with', 'done with'],
 'zeus', '{}', 0.75, 5),

-- Wellness intents (Hestia)
('wellness.break', 'system.settings', 'Take Break', 'Break suggestions',
 ARRAY['I need a break', 'suggest a break', 'time for a break', 'break reminder'],
 'hestia', '{}', 0.7, 4),

('wellness.ergonomic', 'system.settings', 'Ergonomic Settings', 'Ergonomic recommendations',
 ARRAY['ergonomic settings', 'posture reminder', 'desk setup', 'eye strain'],
 'hestia', '{}', 0.75, 4),

-- Multi-agent intents
('complex.workflow', 'system.settings', 'Complex Workflow', 'Multi-step workflow',
 ARRAY['I need to do several things', 'help me with this workflow', 'multiple steps needed', 'complex task'],
 'zeus', ARRAY['hermes', 'chronos', 'hephaestus'], 0.6, 5);

-- =============================================================================
-- KEYWORD FALLBACK RULES
-- =============================================================================

INSERT INTO routing.keyword_rules (pattern, pattern_type, target_agent, priority, confidence_boost) VALUES
-- Urgent keywords
('(urgent|asap|emergency|critical)', 'regex', 'iris', 10, 0.15),

-- Email patterns
('(email|mail|inbox|smtp|imap)', 'regex', 'hermes', 5, 0.10),
('@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', 'regex', 'hermes', 5, 0.10),  -- Email address pattern

-- Calendar patterns
('(calendar|meeting|schedule|appointment|availability)', 'regex', 'chronos', 5, 0.10),
('(tomorrow|next week|monday|tuesday|wednesday|thursday|friday)', 'regex', 'chronos', 3, 0.05),

-- Code patterns
('(code|function|class|deploy|git|github|PR|pull request|commit)', 'regex', 'hephaestus', 5, 0.10),
('```', 'contains', 'hephaestus', 3, 0.05),  -- Code blocks

-- Security patterns
('(security|permission|access|audit|vulnerability|threat)', 'regex', 'aegis', 6, 0.12),
('(password|credential|secret|token)', 'regex', 'aegis', 7, 0.15),

-- Finance patterns
('(payment|refund|invoice|billing|charge|subscription)', 'regex', 'nur_prometheus', 5, 0.10),
('\$[0-9]+', 'regex', 'nur_prometheus', 3, 0.05),  -- Money amounts

-- Analytics patterns
('(report|analytics|metrics|dashboard|chart|graph)', 'regex', 'nur_prometheus', 5, 0.10),
('(KPI|ROI|conversion|revenue)', 'regex', 'nur_prometheus', 5, 0.10);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to find similar intents by embedding
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
$$ LANGUAGE plpgsql;

-- Function to find similar utterances
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
$$ LANGUAGE plpgsql;

-- Function to log routing decision
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
$$ LANGUAGE plpgsql;

-- Function to update performance metrics (call periodically)
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
$$ LANGUAGE plpgsql;

-- Record migration
INSERT INTO public.schema_migrations (version) VALUES ('010_intent_embeddings');
