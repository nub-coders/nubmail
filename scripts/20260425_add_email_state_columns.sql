-- Add per-user email state columns to email_reads
ALTER TABLE email_reads ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT false;
ALTER TABLE email_reads ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
ALTER TABLE email_reads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE email_reads ADD COLUMN IF NOT EXISTS is_spam BOOLEAN DEFAULT false;

-- Drafts table
CREATE TABLE IF NOT EXISTS email_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_address TEXT NOT NULL DEFAULT '',
  to_address TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_drafts_user ON email_drafts(user_id, updated_at DESC);
