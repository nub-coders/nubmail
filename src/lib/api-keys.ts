import crypto from 'crypto';
import { pgQuery, pgTransaction } from '@/lib/postgres';
import { NextRequest } from 'next/server';

export const VALID_PERMISSIONS = ['send', 'read', 'create_accounts'] as const;
export type ApiKeyPermission = typeof VALID_PERMISSIONS[number];

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function getApiKeyEncryptionSecret(): string {
  const explicit = process.env.API_KEY_ENCRYPTION_SECRET;
  if (explicit && explicit.length >= 16) return explicit;
  throw new Error('API_KEY_ENCRYPTION_SECRET is not configured (must be set, distinct from JWT_SECRET, length >= 16)');
}

function getEncryptionKey(): Buffer {
  const secret = getApiKeyEncryptionSecret();
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      Buffer.from(secret, 'utf8'),
      Buffer.from('nubmail.api-key.v1', 'utf8'),
      Buffer.from('aes-256-gcm:api-key:v1', 'utf8'),
      32,
    ),
  );
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

interface CreateApiKeyOptions {
  userId: string;
  name: string;
  permissions: ApiKeyPermission[];
  domainIds?: string[];
  accountIds?: string[];
}

export async function createApiKey(opts: CreateApiKeyOptions): Promise<{ key: string; id: string }> {
  const { userId, name, permissions, domainIds, accountIds } = opts;
  const raw = `nm_live_${crypto.randomBytes(32).toString('hex')}`;
  const hash = sha256(raw);
  const encryptedKey = encryptApiKey(raw);

  const validPerms = permissions.filter(p => VALID_PERMISSIONS.includes(p));
  if (validPerms.length === 0) throw new Error('At least one valid permission required');

  const id = await pgTransaction(async (query) => {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO api_keys (user_id, name, key_hash, encrypted_key, permissions)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, name, hash, encryptedKey, validPerms]
    );
    const keyId = rows[0].id;

    if (domainIds && domainIds.length > 0) {
      for (const domainId of domainIds) {
        await query(
          'INSERT INTO api_key_domains (api_key_id, domain_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [keyId, domainId]
        );
      }
    }

    if (accountIds && accountIds.length > 0) {
      for (const accountId of accountIds) {
        await query(
          'INSERT INTO api_key_accounts (api_key_id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [keyId, accountId]
        );
      }
    }

    return keyId;
  });

  return { key: raw, id };
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
  return (rowCount ?? 0) > 0;
}

export async function listApiKeys(userId: string) {
  const { rows } = await pgQuery<{
    id: string;
    name: string;
    permissions: string[];
    created_at: string;
    last_used: string | null;
  }>(
    'SELECT id, name, permissions, created_at, last_used FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );

  const keyIds = rows.map(r => r.id);
  let domainMap: Record<string, string[]> = {};
  let accountMap: Record<string, string[]> = {};

  if (keyIds.length > 0) {
    const { rows: domainRows } = await pgQuery<{ api_key_id: string; domain_id: string }>(
      'SELECT api_key_id, domain_id FROM api_key_domains WHERE api_key_id = ANY($1)',
      [keyIds]
    );
    for (const r of domainRows) {
      if (!domainMap[r.api_key_id]) domainMap[r.api_key_id] = [];
      domainMap[r.api_key_id].push(r.domain_id);
    }

    const { rows: accountRows } = await pgQuery<{ api_key_id: string; account_id: string }>(
      'SELECT api_key_id, account_id FROM api_key_accounts WHERE api_key_id = ANY($1)',
      [keyIds]
    );
    for (const r of accountRows) {
      if (!accountMap[r.api_key_id]) accountMap[r.api_key_id] = [];
      accountMap[r.api_key_id].push(r.account_id);
    }
  }

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    permissions: r.permissions || ['send'],
    domainIds: domainMap[r.id] || [],
    accountIds: accountMap[r.id] || [],
    createdAt: r.created_at,
    lastUsed: r.last_used,
  }));
}

export interface ApiKeyUser {
  id: string;
  apiKeyId: string;
  permissions: string[];
  scopedDomainIds: string[];
  scopedAccountIds: string[];
}

export async function getUserFromApiKey(req: NextRequest): Promise<ApiKeyUser | null> {
  const header = req.headers.get('x-api-key') || req.headers.get('authorization');
  if (!header) return null;
  const key = header.startsWith('ApiKey ') ? header.slice(7).trim() : header.trim();
  if (!key || !key.startsWith('nm_live_')) return null;
  const hash = sha256(key);

  const { rows } = await pgQuery<{ id: string; user_id: string; permissions: string[] }>(
    'SELECT id, user_id, permissions FROM api_keys WHERE key_hash = $1',
    [hash]
  );
  const row = rows[0];
  if (!row) return null;

  pgQuery('UPDATE api_keys SET last_used = NOW() WHERE key_hash = $1', [hash]).catch(() => {});

  const { rows: domainRows } = await pgQuery<{ domain_id: string }>(
    'SELECT domain_id FROM api_key_domains WHERE api_key_id = $1',
    [row.id]
  );
  const { rows: accountRows } = await pgQuery<{ account_id: string }>(
    'SELECT account_id FROM api_key_accounts WHERE api_key_id = $1',
    [row.id]
  );

  return {
    id: row.user_id,
    apiKeyId: row.id,
    permissions: row.permissions || ['send'],
    scopedDomainIds: domainRows.map(r => r.domain_id),
    scopedAccountIds: accountRows.map(r => r.account_id),
  };
}
