-- Add password_hash column to email_accounts for IMAP/POP3 support
ALTER TABLE email_accounts
ADD COLUMN IF NOT EXISTS password_hash TEXT;
