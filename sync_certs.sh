#!/bin/bash

NGINX_CERTS="/root/nginx-proxy/nginx/certs/nubcoder.com"
DOVECOT_CERTS="/root/nubmail/dovecot/ssl"

# Check if certs exist
if [ ! -f "$NGINX_CERTS/fullchain.pem" ] || [ ! -f "$NGINX_CERTS/key.pem" ]; then
    echo "Error: Certificates not found in $NGINX_CERTS"
    exit 1
fi

# Compare timestamps to see if nginx cert is newer
if [ "$NGINX_CERTS/fullchain.pem" -nt "$DOVECOT_CERTS/tls.crt" ]; then
    echo "New certificate detected. Updating Dovecot..."
    cp "$NGINX_CERTS/fullchain.pem" "$DOVECOT_CERTS/tls.crt"
    cp "$NGINX_CERTS/key.pem" "$DOVECOT_CERTS/tls.key"
    chmod 644 "$DOVECOT_CERTS/tls.key"
    
    cd /root/nubmail && docker compose restart dovecot
    echo "Dovecot certificates updated and service restarted."
else
    echo "Certificates are up to date."
fi
