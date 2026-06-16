import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/admin';
import { pgQuery } from '@/lib/postgres';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { rows: users } = await pgQuery<{ email: string }>(
      'SELECT email FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = users[0];
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { rows: userEmailAccounts } = await pgQuery<{ email_address: string }>(
      'SELECT email_address FROM email_accounts WHERE user_id = $1',
      [payload.sub]
    );
    const ownedEmails = userEmailAccounts.map(a => (a.email_address || '').toLowerCase());
    ownedEmails.push((user.email || '').toLowerCase());

    const { rows } = await pgQuery(
      `SELECT m.id, m.sender, m.recipients, m.subject, m.body, m.sent_at AS "sentAt",
              COALESCE(r.read, false) AS read,
              COALESCE(r.starred, false) AS starred,
              COALESCE(r.archived, false) AS archived,
              COALESCE(r.is_spam, false) AS "isSpam",
              r.deleted_at AS "deletedAt"
       FROM email_messages m
       LEFT JOIN email_reads r ON m.id = r.email_id AND r.user_id = $2
       WHERE m.id = $1`,
      [id, payload.sub]
    );
    const email = rows[0] as
      | {
          id: string;
          sender: string;
          recipients: string[];
          subject: string;
          body: string;
          sentAt: string;
          read: boolean;
          starred: boolean;
          archived: boolean;
          isSpam: boolean;
          deletedAt: string | null;
        }
      | undefined;
    if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 });

    const sender = (email.sender || '').toLowerCase();
    const recipients = Array.isArray(email.recipients)
      ? email.recipients.map(r => (r || '').toLowerCase())
      : [];

    const isRecipient = recipients.some(r => ownedEmails.includes(r));
    const isSender = ownedEmails.includes(sender);
    if (!isRecipient && !isSender) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ email });
  } catch (err) {
    console.error('Email by id GET error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
