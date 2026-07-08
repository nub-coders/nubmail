#!/usr/bin/env bash
# backup-pg.sh — Nightly PostgreSQL backup to B2 (primary) and R2 (mirror)
#
# Pipeline:  pg_dump → gzip → openssl encrypt → rclone copy
#
# Usage:
#   bash scripts/backup-pg.sh
#   0 2 * * * /root/nubmail/scripts/backup-pg.sh >> /var/log/nubmail-backup.log 2>&1
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
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="/tmp/nubmail-pg-${TIMESTAMP}.sql.gz"
ENCRYPTED_FILE="${DUMP_FILE}.enc"
B2_PATH="nubmail/daily"
R2_PATH="nubmail/daily"
OBJECT_KEY="${B2_PATH}/nubmail-pg-${TIMESTAMP}.sql.gz.enc"
RETENTION_DAYS=30

# ── Helpers ───────────────────────────────────────────────────────────────────
cleanup() {
  rm -f "$DUMP_FILE" "$ENCRYPTED_FILE"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

# ── Preflight ─────────────────────────────────────────────────────────────────
echo "$(date -Iseconds) Starting nubmail PostgreSQL backup..."

if ! docker inspect "$CONTAINER" --format='{{.State.Running}}' 2>/dev/null | grep -q true; then
  fail "Container $CONTAINER is not running"
fi

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  fail "BACKUP_ENCRYPTION_KEY is not set"
fi

# ── Step 1: pg_dump ───────────────────────────────────────────────────────────
echo "  [1/5] Dumping database..."
if ! docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl | gzip > "$DUMP_FILE"; then
  fail "pg_dump failed"
fi

DUMP_SIZE=$(stat -c%s "$DUMP_FILE" 2>/dev/null || stat -f%z "$DUMP_FILE")
echo "        Dump size: $(numfmt --to=iec "$DUMP_SIZE" 2>/dev/null || echo "${DUMP_SIZE} bytes")"

if [ "$DUMP_SIZE" -lt 100 ]; then
  fail "Dump file suspiciously small (${DUMP_SIZE} bytes) — likely empty database or pg_dump error"
fi

if ! gzip -t "$DUMP_FILE"; then
  fail "gzip integrity check failed — dump is corrupt or truncated"
fi

SCHEMA_CHECK=$(gunzip -c "$DUMP_FILE" | { grep -c "CREATE TABLE public.users" || true; })
if [ "$SCHEMA_CHECK" -eq 0 ]; then
  fail "Dump does not contain expected schema (public.users) — refusing to ship a bad backup"
fi
echo "        Integrity: gzip OK, schema present"

# ── Step 2: Encrypt ───────────────────────────────────────────────────────────
echo "  [2/5] Encrypting..."
if ! openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
  -pass env:BACKUP_ENCRYPTION_KEY \
  -in "$DUMP_FILE" -out "$ENCRYPTED_FILE"; then
  fail "Encryption failed"
fi

rm -f "$DUMP_FILE"

ENC_SIZE=$(stat -c%s "$ENCRYPTED_FILE" 2>/dev/null || stat -f%z "$ENCRYPTED_FILE")
echo "        Encrypted size: $(numfmt --to=iec "$ENC_SIZE" 2>/dev/null || echo "${ENC_SIZE} bytes")"

# ── Step 3: Upload to B2 (primary) ───────────────────────────────────────────
echo "  [3/5] Uploading to Backblaze B2..."
if ! rclone copy "$ENCRYPTED_FILE" "b2:${B2_BUCKET:-nubs-backups-b2}/${B2_PATH}/" \
  --no-check-dest \
  --retries 3 \
  --low-level-retries 5 \
  -q; then
  fail "B2 upload failed"
fi
echo "        → b2:${B2_BUCKET:-nubs-backups-b2}/${OBJECT_KEY}"

# ── Step 4: Upload to R2 (mirror) ────────────────────────────────────────────
echo "  [4/5] Uploading to Cloudflare R2..."
if ! rclone copy "$ENCRYPTED_FILE" "r2:${R2_BUCKET:-nubs-backups}/${R2_PATH}/" \
  --no-check-dest \
  --retries 3 \
  --low-level-retries 5 \
  -q; then
  echo "  WARN: R2 upload failed (non-fatal, B2 upload succeeded)"
fi
echo "        → r2:${R2_BUCKET:-nubs-backups}/${OBJECT_KEY}"

# ── Step 5: Prune old backups ─────────────────────────────────────────────────
echo "  [5/5] Pruning backups older than ${RETENTION_DAYS} days..."
rclone delete "b2:${B2_BUCKET:-nubs-backups-b2}/${B2_PATH}/" --min-age "${RETENTION_DAYS}d" -q 2>/dev/null || true
rclone delete "r2:${R2_BUCKET:-nubs-backups}/${R2_PATH}/" --min-age "${RETENTION_DAYS}d" -q 2>/dev/null || true

# ── Done ──────────────────────────────────────────────────────────────────────
echo "$(date -Iseconds) Backup complete: ${OBJECT_KEY}"
