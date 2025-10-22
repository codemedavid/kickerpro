-- Message Batches Table
-- Splits large message sends into manageable batches of 100 recipients each

CREATE TABLE IF NOT EXISTS message_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    batch_number INTEGER NOT NULL,
    total_batches INTEGER NOT NULL,
    recipients TEXT[] NOT NULL, -- Array of recipient PSIDs (max 100)
    recipient_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, batch_number)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_message_batches_message_id ON message_batches(message_id);
CREATE INDEX IF NOT EXISTS idx_message_batches_status ON message_batches(status);

-- Comment
COMMENT ON TABLE message_batches IS 'Stores message sending batches (max 100 recipients each) for better performance and tracking';
COMMENT ON COLUMN message_batches.batch_number IS 'Batch number (1, 2, 3, etc.)';
COMMENT ON COLUMN message_batches.total_batches IS 'Total number of batches for this message';
COMMENT ON COLUMN message_batches.recipients IS 'Array of Facebook PSIDs (max 100)';

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_message_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER message_batches_updated_at
    BEFORE UPDATE ON message_batches
    FOR EACH ROW
    EXECUTE FUNCTION update_message_batches_updated_at();

-- Verify
SELECT 'Message batches table created successfully!' as status;

