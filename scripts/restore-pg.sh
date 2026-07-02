#!/usr/bin/env bash
# restore-pg.sh — Restore a nubmail PostgreSQL backup from B2
#
# Pipeline:  rclone copy → openssl decrypt → gunzip → psql
#
# Usage:
#   bash scripts/restore-pg.sh                              # restore latest backup
#   bash scripts/restore-pg.sh nubmail-pg-20260702_033208   # restore specific backup
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$PROJECT_DIR/.env"
    set +a
  else
    echo "ERROR: BACKUP_ENCRYPTION_KEY not set and no .env found" >&2
    exit 1
  fi
fi

# ── Config ────────────────────────────────────────────────────────────────────
CONTAINER="nubmail-postgres-1"
DB_USER="nubmail"
DB_NAME="nubmail"
B2_PATH="b2:${B2_BUCKET:-nubs-backups-b2}/nubmail/daily"

# ── Helpers ───────────────────────────────────────────────────────────────────
cleanup() {
  rm -f "$ENCRYPTED_FILE" "$DUMP_FILE"
}

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

# ── Resolve backup file ──────────────────────────────────────────────────────
if [ -n "${1:-}" ]; then
  BACKUP_NAME="$1"
  # Allow passing with or without the .sql.gz.enc suffix
  BACKUP_NAME="${BACKUP_NAME%.sql.gz.enc}"
  REMOTE_FILE="${B2_PATH}/${BACKUP_NAME}.sql.gz.enc"
else
  echo "Finding latest backup in ${B2_PATH}/ ..."
  LATEST=$(rclone lsf "$B2_PATH/" --files-only 2>/dev/null | sort | tail -1)
  if [ -z "$LATEST" ]; then
    fail "No backups found in ${B2_PATH}/"
  fi
  REMOTE_FILE="${B2_PATH}/${LATEST}"
  BACKUP_NAME="${LATEST%.sql.gz.enc}"
  echo "Latest backup: ${LATEST}"
fi

ENCRYPTED_FILE="/tmp/${BACKUP_NAME}.sql.gz.enc"
DUMP_FILE="/tmp/${BACKUP_NAME}.sql.gz"
trap cleanup EXIT

# ── Preflight ─────────────────────────────────────────────────────────────────
if ! docker inspect "$CONTAINER" --format='{{.State.Running}}' 2>/dev/null | grep -q true; then
  fail "Container $CONTAINER is not running"
fi

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  fail "BACKUP_ENCRYPTION_KEY is not set"
fi

# ── Confirm ───────────────────────────────────────────────────────────────────
echo ""
echo "  Backup:    ${REMOTE_FILE}"
echo "  Target:    ${CONTAINER} → ${DB_NAME}"
echo ""
echo "  WARNING: This will DROP and recreate all tables in ${DB_NAME}."
echo ""
read -r -p "  Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# ── Step 1: Download ─────────────────────────────────────────────────────────
echo ""
echo "  [1/4] Downloading from B2..."
if ! rclone copy "$REMOTE_FILE" /tmp/ --retries 3 -q; then
  fail "Download failed"
fi

ENC_SIZE=$(stat -c%s "$ENCRYPTED_FILE" 2>/dev/null || stat -f%z "$ENCRYPTED_FILE")
echo "        Downloaded: $(numfmt --to=iec "$ENC_SIZE" 2>/dev/null || echo "${ENC_SIZE} bytes")"

# ── Step 2: Decrypt ──────────────────────────────────────────────────────────
echo "  [2/4] Decrypting..."
if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -pass env:BACKUP_ENCRYPTION_KEY \
  -in "$ENCRYPTED_FILE" -out "$DUMP_FILE"; then
  fail "Decryption failed — wrong key or corrupt file"
fi

rm -f "$ENCRYPTED_FILE"

if ! gzip -t "$DUMP_FILE"; then
  fail "gzip integrity check failed — decrypted file is corrupt"
fi
echo "        Integrity: OK"

# ── Step 3: Drop existing tables ─────────────────────────────────────────────
echo "  [3/4] Dropping existing tables..."
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
  DO \$\$
  DECLARE r RECORD;
  BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
      EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
  END \$\$;
" > /dev/null 2>&1

# ── Step 4: Restore ─────────────────────────────────────────────────────────
echo "  [4/4] Restoring database..."
if ! gunzip -c "$DUMP_FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q > /dev/null 2>&1; then
  fail "psql restore failed"
fi

# ── Verify ────────────────────────────────────────────────────────────────────
TABLE_COUNT=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")
echo ""
echo "  Restore complete: ${TABLE_COUNT} tables in ${DB_NAME}"
echo "  Source: ${BACKUP_NAME}"
