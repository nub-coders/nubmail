-- Store an encrypted copy of API keys so users can reveal them again later.
ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS encrypted_key TEXT;