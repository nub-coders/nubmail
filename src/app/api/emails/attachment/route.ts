import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { simpleParser } from 'mailparser';
import { getUserFromToken } from '@/lib/admin';
import { pgQuery } from '@/lib/postgres';

const MAILDIR_BASE = process.env.MAILDIR_BASE || '/app/maildata';

const SAFE_INLINE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
  'image/x-icon',
]);

function sanitizeFilename(name: string | undefined): string {
  if (!name) return 'attachment';
  return name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 200) || 'attachment';
}

async function findMaildirFileForRecipient(emailId: string, recipient: string): Promise<string | null> {
  const safeName = recipient.toLowerCase();
  if (safeName.includes('..') || safeName.includes('/') || safeName.includes('\\')) return null;
  const userDir = path.join(MAILDIR_BASE, safeName, 'Maildir');
  for (const sub of ['new', 'cur']) {
    const dir = path.join(userDir, sub);
    try {
      const files = await fs.readdir(dir);
      for (const f of files) {
        if (f.startsWith(`${emailId}-`)) {
          const resolved = path.resolve(dir, f);
          const expectedRoot = path.resolve(userDir);
          if (!resolved.startsWith(expectedRoot + path.sep)) return null;
          return resolved;
        }
      }
    } catch {
      // ignore missing
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromToken(req);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const url = new URL(req.url);
    const emailId = url.searchParams.get('emailId') || url.searchParams.get('id');
    let cid = url.searchParams.get('cid');
    if (!emailId || !cid) return new Response('Missing emailId or cid', { status: 400 });
    cid = cid.replace(/^<|>$/g, '');

    if (!/^[0-9a-fA-F-]{8,64}$/.test(emailId)) {
      return new Response('Invalid emailId', { status: 400 });
    }

    const { rows } = await pgQuery<{ recipients: string[]; sender: string; user_id: string | null }>(
      'SELECT recipients, sender, user_id FROM email_messages WHERE id = $1',
      [emailId]
    );
    const msg = rows[0];
    if (!msg) return new Response('Not found', { status: 404 });

    const ownedEmails = new Set<string>();
    if (user.email) ownedEmails.add(user.email.toLowerCase());
    const { rows: accounts } = await pgQuery<{ email_address: string }>(
      'SELECT email_address FROM email_accounts WHERE user_id = $1',
      [user.sub]
    );
    for (const a of accounts) {
      if (a.email_address) ownedEmails.add(a.email_address.toLowerCase());
    }

    const recipientLower = (msg.recipients || []).map((r) => (r || '').toLowerCase());
    const senderLower = (msg.sender || '').toLowerCase();
    const isOwnerByMessage = String(msg.user_id || '') === String(user.sub);
    const isRecipient = recipientLower.some((r) => ownedEmails.has(r));
    const isSender = ownedEmails.has(senderLower);
    if (!isOwnerByMessage && !isRecipient && !isSender) {
      return new Response('Forbidden', { status: 403 });
    }

    const recipientForFile = recipientLower.find((r) => ownedEmails.has(r))
      || (isSender ? senderLower : null)
      || recipientLower[0]
      || null;
    if (!recipientForFile) return new Response('Not found', { status: 404 });

    const filePath = await findMaildirFileForRecipient(emailId, recipientForFile);
    if (!filePath) return new Response('Not found', { status: 404 });

    const raw = await fs.readFile(filePath);
    const parsed = await simpleParser(raw);
    if (!parsed.attachments || parsed.attachments.length === 0) {
      return new Response('Attachment not found', { status: 404 });
    }

    const target = parsed.attachments.find((a) => {
      const aCid = (a.cid || '').toString().replace(/^<|>$/g, '');
      return aCid === cid || a.contentId === cid;
    });
    if (!target) return new Response('Attachment not found', { status: 404 });

    const rawType = (target.contentType || 'application/octet-stream').toLowerCase().split(';')[0].trim();
    const inline = SAFE_INLINE_TYPES.has(rawType);
    const contentType = inline ? rawType : 'application/octet-stream';
    const filename = sanitizeFilename(target.filename || `attachment-${cid}`);
    const buffer = Buffer.isBuffer(target.content) ? target.content : Buffer.from(String(target.content));

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, max-age=0, no-store',
    };

    return new Response(new Uint8Array(buffer), { status: 200, headers });
  } catch (err) {
    console.error('Attachment GET error', err);
    return new Response('Internal error', { status: 500 });
  }
}
