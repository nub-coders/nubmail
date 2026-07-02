-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_code TEXT,
  verification_code_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Domains
CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_name TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  verification_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  verified_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_domains_user_created ON domains(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_domains_verification_status ON domains(verification_status);
CREATE UNIQUE INDEX IF NOT EXISTS domains_verified_domain_name_unique_idx
  ON domains ((lower(domain_name)))
  WHERE verification_status = 'verified';

-- Email accounts
CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  email_address TEXT UNIQUE NOT NULL,
  storage_quota INT NOT NULL DEFAULT 1024,
  use_built_in_smtp BOOLEAN NOT NULL DEFAULT TRUE,
  smtp_host TEXT,
  smtp_port INT,
  smtp_user TEXT,
  smtp_pass TEXT,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_created ON email_accounts(user_id, created_at DESC);

-- Email messages
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  recipients TEXT[] NOT NULL,
  subject TEXT,
  body TEXT,
  read BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_messages_user_sent ON email_messages(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_recipients ON email_messages USING GIN(recipients);
CREATE INDEX IF NOT EXISTS idx_email_messages_sender ON email_messages(sender);

-- Web push subscriptions for message notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Track per-user read/unread state and email actions for emails
CREATE TABLE IF NOT EXISTS email_reads (
  id SERIAL PRIMARY KEY,
  email_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  starred BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  is_spam BOOLEAN DEFAULT FALSE
);
CREATE UNIQUE INDEX IF NOT EXISTS email_reads_email_user_idx ON email_reads(email_id, user_id);

-- Email drafts
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



-- DKIM keys for domains
CREATE TABLE IF NOT EXISTS domain_dkim (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_name TEXT NOT NULL UNIQUE,
  selector TEXT NOT NULL,
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_domain_dkim_domain_name ON domain_dkim(domain_name);

-- API keys table to support programmatic email sending
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  encrypted_key TEXT,
  permissions TEXT[] NOT NULL DEFAULT '{send}',
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_last_used ON api_keys(last_used DESC);

-- Scoped domain access for API keys (empty = all user domains)
CREATE TABLE IF NOT EXISTS api_key_domains (
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  PRIMARY KEY (api_key_id, domain_id)
);
CREATE INDEX IF NOT EXISTS idx_api_key_domains_key ON api_key_domains(api_key_id);

-- Scoped email account access for API keys (empty = all user accounts)
CREATE TABLE IF NOT EXISTS api_key_accounts (
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (api_key_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_api_key_accounts_key ON api_key_accounts(api_key_id);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id);

-- Team members
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- Sessions for authentication
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip_address TEXT,
  is_active BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
