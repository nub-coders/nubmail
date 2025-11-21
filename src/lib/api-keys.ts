import crypto from 'crypto';
import { pgQuery } from '@/lib/postgres';
import { NextRequest } from 'next/server';

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function createApiKey(userId: string, name: string): Promise<{ key: string; id: string }> {
  const raw = `nm_live_${crypto.randomBytes(32).toString('hex')}`;
  const hash = sha256(raw);
  const { rows } = await pgQuery<{ id: string }>(
    `INSERT INTO api_keys (user_id, name, key_hash)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, name, hash]
  );
  return { key: raw, id: rows[0].id };
}

export async function revokeApiKey(userId: string, id: string): Promise<boolean> {
  const { rowCount } = await pgQuery('DELETE FROM api_keys WHERE id = $1 AND user_id = $2', [id, userId]);
  return rowCount > 0;
}

export async function listApiKeys(userId: string) {
  const { rows } = await pgQuery<{ id: string; name: string; created_at: string; last_used: string | null }>(
    'SELECT id, name, created_at, last_used FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(r => ({ id: r.id, name: r.name, createdAt: r.created_at, lastUsed: r.last_used }));
}

export async function getUserFromApiKey(req: NextRequest): Promise<{ id: string } | null> {
  const header = req.headers.get('x-api-key') || req.headers.get('authorization');
  if (!header) return null;
  const key = header.startsWith('ApiKey ') ? header.slice(7).trim() : header.trim();
  if (!key || !key.startsWith('nm_live_')) return null;
  const hash = sha256(key);
  const { rows } = await pgQuery<{ user_id: string }>('SELECT user_id FROM api_keys WHERE key_hash = $1', [hash]);
  const row = rows[0];
  if (!row) return null;
  // update last_used asynchronously (no await needed)
  pgQuery('UPDATE api_keys SET last_used = NOW() WHERE key_hash = $1', [hash]).catch(() => {});
  return { id: row.user_id };
}
