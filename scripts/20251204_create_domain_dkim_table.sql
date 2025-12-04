-- Create domain_dkim table for DKIM key management
CREATE TABLE IF NOT EXISTS domain_dkim (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_name TEXT NOT NULL UNIQUE,
  selector TEXT NOT NULL,
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_domain_dkim_domain_name ON domain_dkim(domain_name);
