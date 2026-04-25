-- Add email_verified column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;