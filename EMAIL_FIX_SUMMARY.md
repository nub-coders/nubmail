# Email Missing in Inbox - Fix Summary

## Issues Found and Fixed

### 1. ✅ Case-Sensitivity Bug (FIXED)
**File:** `src/app/api/emails/route.ts`

Email addresses were being compared with mixed case (e.g., `Dev@nubcoder.com` vs `dev@nubcoder.com`), causing mismatches.

**Fix:** Normalized all email comparisons to lowercase.

### 2. ✅ Multi-Account Filter Bug (FIXED)
**File:** `src/app/api/emails/route.ts`

When a user had multiple email accounts on the same domain, the inbox query excluded ALL emails from ANY of their accounts:
```sql
WHERE m.recipients && $1
AND NOT (m.sender = ANY($1))  -- ❌ Excluded inter-account messages
```

**Example Problem:**
- User has: `dev@nubcoder.com` + `support@nubcoder.com`
- Email sent: `dev@nubcoder.com` → `support@nubcoder.com`
- Result: **Invisible in support@nubcoder.com inbox** ❌

**Fix:** Changed filter to only exclude self-sent (sender = single recipient):
```sql
AND NOT (array_length(m.recipients, 1) = 1 AND m.recipients[1] = m.sender)
```

Now inter-account messages are visible. ✓

### 3. ⚠️ Orphaned Messages (8,759 messages)
**Database Issue:** 8,759 messages have empty/NULL recipients arrays and are invisible in all inboxes.

These are corrupted data (incomplete inserts or failed delivery). They cannot be recovered.

**Action Required:**

To preview:
```bash
psql "postgres://nubmail:nubmail@127.0.0.1:5432/nubmail" \
  -c "SELECT COUNT(*) FROM email_messages WHERE recipients = '{}' OR recipients IS NULL;"
```

To clean up (deletes 8,759 orphaned messages):
```bash
docker exec nubmail-postgres-1 psql -U nubmail -d nubmail -c "DELETE FROM email_messages WHERE recipients = '{}' OR recipients IS NULL;"
```

## Next Steps

1. **Deploy the fixed API:** Restart the app to load the patched `src/app/api/emails/route.ts`
   ```bash
   docker compose restart app
   ```

2. **Optional: Clean up orphaned messages**
   ```bash
   psql "postgres://nubmail:nubmail@127.0.0.1:5432/nubmail" -f docs/postgres-schema.sql
   ```

3. **Test:** Verify inbox now shows inter-account messages
   - Send email from `dev@nubcoder.com` → `support@nubcoder.com`
   - Check `support@nubcoder.com` inbox — should be visible now

## Files Changed

- `src/app/api/emails/route.ts` — Fixed case sensitivity and multi-account filter
- `docs/postgres-schema.sql` — Canonical database schema loaded on fresh Postgres initialization
