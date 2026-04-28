CREATE UNIQUE INDEX IF NOT EXISTS domains_verified_domain_name_unique_idx
  ON domains ((lower(domain_name)))
  WHERE verification_status = 'verified';
