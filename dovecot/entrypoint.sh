#!/bin/sh
# Dovecot entrypoint script
# Substitutes POSTGRES_PASSWORD into config files that don't natively support env vars.
# This avoids hardcoding database credentials in config files committed to version control.

set -e

POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-nubmail}"

# Substitute the placeholder password in SQL configs
for conf in /etc/dovecot/conf.d/10-sql.conf /etc/dovecot/dovecot-sql.conf.ext; do
  if [ -f "$conf" ]; then
    sed -i "s/password = nubmail/password = ${POSTGRES_PASSWORD}/g" "$conf"
  fi
done

# Start Dovecot in foreground
exec dovecot -F
