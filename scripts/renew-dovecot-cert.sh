#!/bin/bash
# Syncs wildcard cert from acme-companion to dovecot's local SSL dir
# and restarts dovecot if the cert has changed.

SRC_DIR="/root/nginx-proxy/nginx/certs/wildcard_nubcoder.com"
DST_DIR="/root/nubmail/dovecot/ssl"

# Exit if source cert doesn't exist
if [ ! -f "$SRC_DIR/fullchain.pem" ]; then
  echo "$(date): Source cert not found, skipping." >> /var/log/dovecot-cert-sync.log
  exit 0
fi

# Only copy if cert has changed
if ! diff -q "$SRC_DIR/fullchain.pem" "$DST_DIR/tls.crt" > /dev/null 2>&1; then
  cp "$SRC_DIR/fullchain.pem" "$DST_DIR/tls.crt"
  cp "$SRC_DIR/key.pem" "$DST_DIR/tls.key"
  chmod 644 "$DST_DIR/tls.crt" "$DST_DIR/tls.key"
  cd /root/nubmail && docker compose restart dovecot
  echo "$(date): Cert updated and dovecot restarted." >> /var/log/dovecot-cert-sync.log
else
  echo "$(date): Cert unchanged, no action needed." >> /var/log/dovecot-cert-sync.log
fi
