-- Track which user has read which email
CREATE TABLE IF NOT EXISTS email_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP
);

-- Ensure a user can only have one read state per email
CREATE UNIQUE INDEX IF NOT EXISTS email_reads_email_user_idx ON email_reads(email_id, user_id);
