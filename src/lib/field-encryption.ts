/**
 * Symmetric encryption utilities for sensitive data at rest.
 * Used to encrypt external SMTP relay passwords stored in the database.
 *
 * Uses AES-256-GCM with random IVs. The encryption key is derived from
 * the JWT_SECRET environment variable via SHA-256 to guarantee 32 bytes.
 *
 * Ciphertext format: hex(iv):hex(authTag):hex(ciphertext)
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required for data encryption');
  }
  // Derive a 32-byte key from JWT_SECRET via SHA-256
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string.
 * @returns A string in the format "iv:authTag:ciphertext" (all hex-encoded)
 */
export function encryptField(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a ciphertext string produced by encryptField.
 * @param ciphertext - The "iv:authTag:encrypted" string
 * @returns The original plaintext
 */
export function decryptField(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted field format');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Check if a value looks like it was encrypted by encryptField.
 * Used to handle migration from plaintext to encrypted values.
 */
export function isEncryptedField(value: string): boolean {
  const parts = value.split(':');
  // Must have exactly 3 hex-encoded parts: IV (32 chars), authTag (32 chars), ciphertext
  return parts.length === 3 && /^[0-9a-f]{32}$/.test(parts[0]) && /^[0-9a-f]{32}$/.test(parts[1]);
}
