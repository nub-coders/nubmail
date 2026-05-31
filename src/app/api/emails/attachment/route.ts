import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { simpleParser } from 'mailparser';

const MAILDIR_CANDIDATES = [process.env.MAILDIR_BASE || '/app/maildata', path.join(process.cwd(), 'maildata')];

async function findMaildirFileByEmailId(emailId: string): Promise<string | null> {
  for (const base of MAILDIR_CANDIDATES) {
    try {
      const entries = await fs.readdir(base, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const maildirNew = path.join(base, e.name, 'Maildir', 'new');
        const maildirCur = path.join(base, e.name, 'Maildir', 'cur');
        for (const dir of [maildirNew, maildirCur]) {
          try {
            const files = await fs.readdir(dir);
            for (const f of files) {
              if (f.startsWith(`${emailId}-`)) {
                return path.join(dir, f);
              }
            }
          } catch (err) {
            // ignore missing dirs
          }
        }
      }
    } catch (err) {
      // ignore base not present
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const emailId = url.searchParams.get('emailId') || url.searchParams.get('id');
    let cid = url.searchParams.get('cid');
    if (!emailId || !cid) {
      return new Response('Missing emailId or cid', { status: 400 });
    }
    // strip angle brackets if present
    cid = cid.replace(/^<|>$/g, '');

    const filePath = await findMaildirFileByEmailId(emailId);
    if (!filePath) return new Response('Mail file not found', { status: 404 });

    const raw = await fs.readFile(filePath);
    const parsed = await simpleParser(raw);
    if (!parsed.attachments || parsed.attachments.length === 0) {
      return new Response('Attachment not found', { status: 404 });
    }

    const target = parsed.attachments.find(a => {
      const aCid = (a.cid || '').toString().replace(/^<|>$/g, '');
      return aCid === cid || a.contentId === cid;
    });

    if (!target) return new Response('Attachment not found', { status: 404 });

    const contentType = target.contentType || 'application/octet-stream';
    const buffer = Buffer.isBuffer(target.content) ? target.content : Buffer.from(String(target.content));

    return new Response(buffer, { status: 200, headers: { 'Content-Type': contentType } });
  } catch (err) {
    console.error('Attachment GET error', err);
    return new Response('Internal error', { status: 500 });
  }
}
