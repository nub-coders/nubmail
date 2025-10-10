import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/admin';
import { pgQuery } from '@/lib/postgres';

export async function GET(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const folder = url.searchParams.get('folder') || 'inbox';

    const { rows: users } = await pgQuery<{ email: string }>('SELECT email FROM users WHERE id = $1', [payload.sub]);
    const user = users[0];
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Get all email accounts owned by this user
    const { rows: userEmailAccounts } = await pgQuery<{ email_address: string }>(
      'SELECT email_address FROM email_accounts WHERE user_id = $1',
      [payload.sub]
    );
    const ownedEmails = userEmailAccounts.map(account => account.email_address);
    ownedEmails.push(user.email); // Include user's main email

    let query: string;
    let params: any[];

    if (folder === 'sent') {
      if (ownedEmails.length === 0) {
        query = `SELECT m.id, m.sender, m.recipients, m.subject, m.body, m.sent_at AS "sentAt",
                  COALESCE(r.read, false) AS read
                  FROM email_messages m
                  LEFT JOIN email_reads r ON m.id = r.email_id AND r.user_id = $2
                  WHERE m.sender = $1
                  ORDER BY m.sent_at DESC LIMIT 100`;
        params = [user.email, payload.sub];
      } else {
        query = `SELECT m.id, m.sender, m.recipients, m.subject, m.body, m.sent_at AS "sentAt",
                  COALESCE(r.read, false) AS read
                  FROM email_messages m
                  LEFT JOIN email_reads r ON m.id = r.email_id AND r.user_id = $2
                  WHERE m.sender = ANY($1)
                  AND NOT (m.recipients && $1)
                  ORDER BY m.sent_at DESC LIMIT 100`;
        params = [ownedEmails, payload.sub];
      }
    } else {
      if (ownedEmails.length === 0) {
        query = `SELECT m.id, m.sender, m.recipients, m.subject, m.body, m.sent_at AS "sentAt",
                  COALESCE(r.read, false) AS read
                  FROM email_messages m
                  LEFT JOIN email_reads r ON m.id = r.email_id AND r.user_id = $2
                  WHERE $1 = ANY(m.recipients)
                  ORDER BY m.sent_at DESC LIMIT 100`;
        params = [user.email, payload.sub];
      } else {
        query = `SELECT m.id, m.sender, m.recipients, m.subject, m.body, m.sent_at AS "sentAt",
                  COALESCE(r.read, false) AS read
                  FROM email_messages m
                  LEFT JOIN email_reads r ON m.id = r.email_id AND r.user_id = $2
                  WHERE m.recipients && $1
                  AND NOT (m.sender = ANY($1))
                  ORDER BY m.sent_at DESC LIMIT 100`;
        params = [ownedEmails, payload.sub];
      }
    }

    const { rows: emails } = await pgQuery(query, params);
    return NextResponse.json({ emails });
  } catch (err) {
    console.error('Emails GET error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { emailId, read } = body;

    if (!emailId || typeof read !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { rows: users } = await pgQuery<{ email: string }>('SELECT email FROM users WHERE id = $1', [payload.sub]);
    const user = users[0];
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { rows: emails } = await pgQuery<{ sender: string; recipients: string[] }>(
      'SELECT sender, recipients FROM email_messages WHERE id = $1',
      [emailId]
    );
    const email = emails[0];

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    const isRecipient = email.recipients && email.recipients.includes(user.email);
    const isSender = email.sender === user.email;

    if (!isRecipient && !isSender) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Upsert per-user read state
    await pgQuery(`INSERT INTO email_reads (email_id, user_id, read, read_at)
      VALUES ($1, $2, $3, CASE WHEN $3 THEN NOW() ELSE NULL END)
      ON CONFLICT (email_id, user_id)
      DO UPDATE SET read = $3, read_at = CASE WHEN $3 THEN NOW() ELSE NULL END`,
      [emailId, payload.sub, read]);

    return NextResponse.json({ message: 'Email updated successfully' });
  } catch (err) {
    console.error('Email PATCH error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
