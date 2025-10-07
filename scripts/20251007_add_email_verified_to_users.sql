-- Add email_verified column to users table
ALTER TABLE users ADD COLUMN email_verified boolean DEFAULT false;