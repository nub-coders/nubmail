-- Make user_id nullable in email_messages to support unmatched incoming emails
ALTER TABLE email_messages
ALTER COLUMN user_id DROP NOT NULL;
