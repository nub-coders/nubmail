#!/bin/sh
# Dovecot entrypoint script
# Substitutes POSTGRES_PASSWORD into config files that don't natively support env vars.
# This avoids hardcoding database credentials in config files committed to version control.
#
# Uses pure POSIX shell (no sed/awk) because the dovecot/dovecot base image is minimal
# and does not include those utilities. Writes back over the same file (rather than
# rename-into-place) so it works on bind-mounted single files.

set -e

POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-nubmail}"

# Replace "password = nubmail" / "password=nubmail" placeholder with the real password
# using shell parameter expansion.
substitute_password() {
  conf="$1"
  [ -f "$conf" ] || return 0

  new=""
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      *"password = nubmail"*)
        line="${line%password = nubmail*}password = ${POSTGRES_PASSWORD}${line#*password = nubmail}"
        ;;
      *"password=nubmail"*)
        line="${line%password=nubmail*}password=${POSTGRES_PASSWORD}${line#*password=nubmail}"
        ;;
    esac
    new="${new}${line}
"
  done < "$conf"

  # Overwrite in place; works on bind-mounted files where rename-into-place would fail.
  printf '%s' "$new" > "$conf"
}

substitute_password /etc/dovecot/conf.d/10-sql.conf
substitute_password /etc/dovecot/dovecot-sql.conf.ext

# Start Dovecot in foreground
exec dovecot -F
