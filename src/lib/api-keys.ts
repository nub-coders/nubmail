import crypto from 'crypto';
import { pgQuery } from '@/lib/postgres';
import { NextRequest } from 'next/server';

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function getApiKeyEncryptionSecret(): string {
  return process.env.API_KEY_ENCRYPTION_SECRET || process.env.JWT_SECRET || '';
}

function getEncryptionKey(): Buffer {
  const secret = getApiKeyEncryptionSecret();
  if (!secret) {
    throw new Error('API key encryption secret is not configured');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptApiKey(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
}

function decryptApiKey(payload: string): string {
  const [ivB64, authTagB64, encryptedB64] = payload.split('.');
  if (!ivB64 || !authTagB64 || !encryptedB64) {
    throw new Error('Invalid encrypted API key payload');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export async function createApiKey(userId: string, name: string): Promise<{ key: string; id: string }> {
  const raw = `nm_live_${crypto.randomBytes(32).toString('hex')}`;
  const hash = sha256(raw);
  const encryptedKey = encryptApiKey(raw);
  await pgQuery(`
    ALTER TABLE api_keys
      ADD COLUMN IF NOT EXISTS encrypted_key TEXT;
  `);
  const { rows } = await pgQuery<{ id: string }>(
    `INSERT INTO api_keys (user_id, name, key_hash, encrypted_key)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userId, name, hash, encryptedKey]
  );
  return { key: raw, id: rows[0].id };
}

export async function revealApiKey(userId: string, id: string): Promise<string | null> {
  const { rows } = await pgQuery<{ encrypted_key: string | null }>(
    'SELECT encrypted_key FROM api_keys WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  const row = rows[0];
  if (!row?.encrypted_key) return null;
  return decryptApiKey(row.encrypted_key);
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
