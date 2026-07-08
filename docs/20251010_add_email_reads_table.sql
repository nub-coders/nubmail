-- Track per-user read/unread state for emails
CREATE TABLE IF NOT EXISTS email_reads (
    id SERIAL PRIMARY KEY,
    email_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX IF NOT EXISTS email_reads_email_user_idx ON email_reads(email_id, user_id);
