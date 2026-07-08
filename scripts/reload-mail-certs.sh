#!/bin/bash
# Reload mail services when the per-host LE cert is renewed by acme-companion.
#
# The cert is bind-mounted directly into nubmail-dovecot and nubmail-smtp-sender
# (see docker-compose.yml), so no copy step is needed — but Dovecot and Postfix
# only re-read their cert/key files on reload/restart. We track the cert mtime
# in a stamp file and reload both services when it changes.

set -eu

CERTS_DIR="${NGINX_CERTS_DIR:-/root/nginx-proxy/nginx/certs}"
HOST="${HOST:-mails.nubcoders.com}"
CERT="${CERTS_DIR}/${HOST}/fullchain.pem"
STAMP="/var/lib/nubmail-cert.stamp"
COMPOSE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "$CERT" ]; then
    echo "Error: cert not found at $CERT" >&2
    exit 1
fi

cert_mtime=$(stat -c %Y "$CERT")
stamp_mtime=0
[ -f "$STAMP" ] && stamp_mtime=$(cat "$STAMP" 2>/dev/null || echo 0)

if [ "$cert_mtime" -le "$stamp_mtime" ]; then
    echo "Cert unchanged (mtime $cert_mtime); nothing to do."
    exit 0
fi

echo "New cert detected (mtime $cert_mtime > $stamp_mtime). Reloading mail services..."
cd "$COMPOSE_DIR"

# Postfix supports a hot reload that re-reads tls cert/key without dropping connections.
docker compose exec -T smtp-sender postfix reload || \
    docker compose restart smtp-sender

# Dovecot also supports `doveadm reload`, but the dovecot/dovecot image runs the
# master in foreground (see dovecot/entrypoint.sh) — restart is the simple, reliable path.
docker compose restart dovecot

echo "$cert_mtime" > "$STAMP"
echo "Mail services reloaded."
