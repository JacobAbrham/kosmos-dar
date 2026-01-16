-- ============================================================================
-- Audit Logging Schema
-- ============================================================================
-- Creates audit schema and events table for compliance logging

-- Create audit schema
CREATE SCHEMA IF NOT EXISTS audit;

-- Audit events table
CREATE TABLE IF NOT EXISTS audit.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    user_id VARCHAR(255),
    tenant_id VARCHAR(255),
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    details TEXT, -- JSON string
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit.events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_id ON audit.events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit.events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit.events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit.events(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_severity ON audit.events(severity);

-- Composite index for user activity queries
CREATE INDEX IF NOT EXISTS idx_audit_events_user_activity ON audit.events(user_id, created_at DESC);

-- Composite index for tenant activity queries
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_activity ON audit.events(tenant_id, created_at DESC);

-- Partitioning by month (optional, for high-volume deployments)
-- Uncomment if you need partitioning:
-- CREATE TABLE audit.events_2026_01 PARTITION OF audit.events
--     FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Row-Level Security (RLS) policies
ALTER TABLE audit.events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own audit logs
CREATE POLICY audit_events_user_policy ON audit.events
    FOR SELECT
    USING (
        -- Users can see their own events
        (user_id = current_setting('app.current_user_id', true))
        OR
        -- Admins can see all events in their tenant
        (
            current_setting('app.current_user_roles', true) LIKE '%admin%'
            AND tenant_id = current_setting('app.current_tenant_id', true)
        )
    );

-- Policy: Only system can insert audit logs
CREATE POLICY audit_events_insert_policy ON audit.events
    FOR INSERT
    WITH CHECK (
        -- Only allow inserts from backend service account
        current_setting('app.service_account', true) = 'true'
    );

-- Grant permissions
GRANT SELECT ON audit.events TO kosmos_app;
GRANT INSERT ON audit.events TO kosmos_app;

-- Function to clean up old audit logs (retention policy)
CREATE OR REPLACE FUNCTION audit.cleanup_old_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delete events older than 1 year (adjust as needed)
    DELETE FROM audit.events
    WHERE created_at < NOW() - INTERVAL '1 year';
    
    RAISE NOTICE 'Cleaned up old audit events';
END;
$$;

-- Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-audit-logs', '0 2 * * 0', 'SELECT audit.cleanup_old_events()');

COMMENT ON SCHEMA audit IS 'Audit logging schema for compliance and security';
COMMENT ON TABLE audit.events IS 'Audit log events for authentication, API requests, security events, etc.';
COMMENT ON COLUMN audit.events.details IS 'JSON string with additional event details';
COMMENT ON COLUMN audit.events.severity IS 'Severity level: info, warning, error, critical';
