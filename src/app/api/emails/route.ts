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

    let query: string;
    let params: any[];

    if (folder === 'sent') {
      query = 'SELECT id, sender, recipients, subject, body, sent_at AS "sentAt", read FROM email_messages WHERE sender = $1 ORDER BY sent_at DESC LIMIT 100';
      params = [user.email];
    } else {
      query = 'SELECT id, sender, recipients, subject, body, sent_at AS "sentAt", read FROM email_messages WHERE $1 = ANY(recipients) ORDER BY sent_at DESC LIMIT 100';
      params = [user.email];
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

    await pgQuery('UPDATE email_messages SET read = $1 WHERE id = $2', [read, emailId]);

    return NextResponse.json({ message: 'Email updated successfully' });
  } catch (err) {
    console.error('Email PATCH error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
