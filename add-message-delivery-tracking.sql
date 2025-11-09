-- ================================================================
-- MESSAGE DELIVERY TRACKING & RETRY SYSTEM
-- Run this in Supabase SQL Editor
-- ================================================================

-- Add retry configuration columns to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS auto_retry_enabled BOOLEAN DEFAULT false;

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS retry_type TEXT DEFAULT 'manual' 
CHECK (retry_type IN ('manual', 'auto', 'cron'));

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS max_retry_attempts INTEGER DEFAULT 3;

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

COMMENT ON COLUMN messages.auto_retry_enabled IS 'Whether automatic retry is enabled for failed deliveries';
COMMENT ON COLUMN messages.retry_type IS 'Type of retry: manual (user initiates), auto (immediate retry), cron (scheduled retry)';
COMMENT ON COLUMN messages.max_retry_attempts IS 'Maximum number of retry attempts for failed deliveries';
COMMENT ON COLUMN messages.retry_count IS 'Current number of retry attempts made';

-- Create message_deliveries table to track individual delivery attempts
CREATE TABLE IF NOT EXISTS message_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES message_batches(id) ON DELETE SET NULL,
    recipient_id TEXT NOT NULL,
    recipient_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
    attempt_number INTEGER DEFAULT 1,
    facebook_message_id TEXT,
    error_code TEXT,
    error_message TEXT,
    error_type TEXT, -- 'access_token', 'rate_limit', 'invalid_recipient', 'network', 'other'
    sent_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT message_deliveries_unique_attempt UNIQUE(message_id, recipient_id, attempt_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_deliveries_message_id ON message_deliveries(message_id);
CREATE INDEX IF NOT EXISTS idx_message_deliveries_status ON message_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_message_deliveries_recipient ON message_deliveries(recipient_id);
CREATE INDEX IF NOT EXISTS idx_message_deliveries_error_type ON message_deliveries(error_type);
CREATE INDEX IF NOT EXISTS idx_message_deliveries_batch_id ON message_deliveries(batch_id);

-- Composite index for finding failed deliveries to retry
CREATE INDEX IF NOT EXISTS idx_message_deliveries_retry ON message_deliveries(message_id, status, attempt_number) 
WHERE status = 'failed';

COMMENT ON TABLE message_deliveries IS 'Tracks individual message delivery attempts to each recipient';
COMMENT ON COLUMN message_deliveries.attempt_number IS 'Delivery attempt number (1 = first attempt, 2+ = retries)';
COMMENT ON COLUMN message_deliveries.error_type IS 'Type of error: access_token, rate_limit, invalid_recipient, network, other';

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_message_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER message_deliveries_updated_at
    BEFORE UPDATE ON message_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION update_message_deliveries_updated_at();

-- Create a view for easy querying of failed deliveries grouped by error type
CREATE OR REPLACE VIEW failed_deliveries_summary AS
SELECT 
    m.id as message_id,
    m.title as message_title,
    m.status as message_status,
    md.error_type,
    COUNT(*) as failed_count,
    array_agg(md.recipient_id) as failed_recipient_ids,
    MAX(md.failed_at) as last_failure_time
FROM messages m
JOIN message_deliveries md ON md.message_id = m.id
WHERE md.status = 'failed'
GROUP BY m.id, m.title, m.status, md.error_type;

COMMENT ON VIEW failed_deliveries_summary IS 'Summary of failed deliveries grouped by message and error type';

-- Create function to get retryable recipients for a message
CREATE OR REPLACE FUNCTION get_retryable_recipients(p_message_id UUID, p_max_attempts INTEGER DEFAULT 3)
RETURNS TABLE (
    recipient_id TEXT,
    recipient_name TEXT,
    last_error_message TEXT,
    last_error_type TEXT,
    attempt_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        md.recipient_id,
        md.recipient_name,
        md.error_message as last_error_message,
        md.error_type as last_error_type,
        COUNT(*) as attempt_count
    FROM message_deliveries md
    WHERE md.message_id = p_message_id
      AND md.status = 'failed'
    GROUP BY md.recipient_id, md.recipient_name, md.error_message, md.error_type
    HAVING COUNT(*) < p_max_attempts
    ORDER BY MAX(md.failed_at) DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_retryable_recipients IS 'Returns recipients that failed but have not exceeded max retry attempts';

-- Create function to clean up old delivery records (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_deliveries(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM message_deliveries
    WHERE status IN ('sent', 'cancelled')
      AND created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_deliveries IS 'Cleanup old successful/cancelled delivery records older than specified days';

-- Verify setup
SELECT 'Message delivery tracking and retry system created successfully!' as status;
SELECT 'Tables: message_deliveries' as created_tables;
SELECT 'Views: failed_deliveries_summary' as created_views;
SELECT 'Functions: get_retryable_recipients, cleanup_old_deliveries' as created_functions;

