import { NextRequest, NextResponse } from 'next/server';
import { canPerformImportantAction, getUserFromToken } from '@/lib/admin';
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

    const { rows: userEmailAccounts } = await pgQuery<{ email_address: string }>(
      'SELECT email_address FROM email_accounts WHERE user_id = $1',
      [payload.sub]
    );
    const ownedEmails = userEmailAccounts.map(account => (account.email_address || '').toLowerCase());
    ownedEmails.push((user.email || '').toLowerCase());

    let query: string;
    let params: any[];

    const baseColumns = `m.id, m.sender, m.recipients, m.subject, m.body, m.sent_at AS "sentAt",
      COALESCE(r.read, false) AS read,
      COALESCE(r.starred, false) AS starred,
      COALESCE(r.archived, false) AS archived,
      COALESCE(r.is_spam, false) AS "isSpam",
      r.deleted_at AS "deletedAt"`;

    const baseJoin = `FROM email_messages m
      LEFT JOIN email_reads r ON m.id = r.email_id AND r.user_id = $2`;

    if (folder === 'sent') {
      if (ownedEmails.length === 0) {
        query = `SELECT ${baseColumns} ${baseJoin}
          WHERE m.sender = $1
          AND (r.deleted_at IS NULL)
          ORDER BY m.sent_at DESC LIMIT 100`;
        params = [user.email, payload.sub];
      } else {
        query = `SELECT ${baseColumns} ${baseJoin}
          WHERE m.sender = ANY($1)
          AND NOT (m.recipients && $1)
          AND (r.deleted_at IS NULL)
          ORDER BY m.sent_at DESC LIMIT 100`;
        params = [ownedEmails, payload.sub];
      }
    } else if (folder === 'trash') {
      if (ownedEmails.length === 0) {
        query = `SELECT ${baseColumns} ${baseJoin}
          WHERE ($1 = ANY(m.recipients) OR m.sender = $1)
          AND r.deleted_at IS NOT NULL
          ORDER BY r.deleted_at DESC LIMIT 100`;
        params = [user.email, payload.sub];
      } else {
        query = `SELECT ${baseColumns} ${baseJoin}
          WHERE (m.recipients && $1 OR m.sender = ANY($1))
          AND r.deleted_at IS NOT NULL
          ORDER BY r.deleted_at DESC LIMIT 100`;
        params = [ownedEmails, payload.sub];
      }
    } else if (folder === 'spam') {
      if (ownedEmails.length === 0) {
        query = `SELECT ${baseColumns} ${baseJoin}
          WHERE $1 = ANY(m.recipients)
          AND COALESCE(r.is_spam, false) = true
          AND r.deleted_at IS NULL
          ORDER BY m.sent_at DESC LIMIT 100`;
        params = [user.email, payload.sub];
      } else {
        query = `SELECT ${baseColumns} ${baseJoin}
          WHERE m.recipients && $1
          AND COALESCE(r.is_spam, false) = true
          AND r.deleted_at IS NULL
          ORDER BY m.sent_at DESC LIMIT 100`;
        params = [ownedEmails, payload.sub];
      }
    } else if (folder === 'archive') {
      if (ownedEmails.length === 0) {
        query = `SELECT ${baseColumns} ${baseJoin}
          WHERE ($1 = ANY(m.recipients) OR m.sender = $1)
          AND COALESCE(r.archived, false) = true
          AND r.deleted_at IS NULL
          ORDER BY m.sent_at DESC LIMIT 100`;
        params = [user.email, payload.sub];
      } else {
        query = `SELECT ${baseColumns} ${baseJoin}
          WHERE (m.recipients && $1 OR m.sender = ANY($1))
          AND COALESCE(r.archived, false) = true
          AND r.deleted_at IS NULL
          ORDER BY m.sent_at DESC LIMIT 100`;
        params = [ownedEmails, payload.sub];
      }
    } else {
      // inbox (default)
      if (ownedEmails.length === 0) {
        query = `SELECT ${baseColumns} ${baseJoin}
          WHERE $1 = ANY(m.recipients)
          AND (r.deleted_at IS NULL)
          AND COALESCE(r.archived, false) = false
          AND COALESCE(r.is_spam, false) = false
          ORDER BY m.sent_at DESC LIMIT 100`;
        params = [user.email, payload.sub];
      } else {
        query = `SELECT ${baseColumns} ${baseJoin}
          WHERE m.recipients && $1
          AND NOT (array_length(m.recipients, 1) = 1 AND m.recipients[1] = m.sender)
          AND (r.deleted_at IS NULL)
          AND COALESCE(r.archived, false) = false
          AND COALESCE(r.is_spam, false) = false
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
    if (!canPerformImportantAction(payload)) {
      return NextResponse.json({ error: 'Please verify your email to perform this action.' }, { status: 403 });
    }

    const body = await req.json();
    const { emailId, read, starred, archived, deleted, spam } = body;

    if (!emailId) {
      return NextResponse.json({ error: 'emailId is required' }, { status: 400 });
    }

    const hasUpdate = typeof read === 'boolean' || typeof starred === 'boolean' ||
      typeof archived === 'boolean' || typeof deleted === 'boolean' || typeof spam === 'boolean';
    if (!hasUpdate) {
      return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 });
    }

    const { rows: users } = await pgQuery<{ email: string }>('SELECT email FROM users WHERE id = $1', [payload.sub]);
    const user = users[0];
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { rows: userEmailAccounts } = await pgQuery<{ email_address: string }>(
      'SELECT email_address FROM email_accounts WHERE user_id = $1',
      [payload.sub]
    );
    const allEmails = userEmailAccounts.map(a => (a.email_address || '').toLowerCase());
    allEmails.push((user.email || '').toLowerCase());

    const { rows: emails } = await pgQuery<{ sender: string; recipients: string[] }>(
      'SELECT sender, recipients FROM email_messages WHERE id = $1',
      [emailId]
    );
    const email = emails[0];
    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    const msgSender = (email.sender || '').toLowerCase();
    const msgRecipients = Array.isArray(email.recipients) ? email.recipients.map(r => (r || '').toLowerCase()) : [];

    const isRecipient = msgRecipients && allEmails.some(e => msgRecipients.includes(e));
    const isSender = allEmails.includes(msgSender);
    if (!isRecipient && !isSender) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const setClauses: string[] = [];
    const insertCols = ['email_id', 'user_id'];
    const insertVals = ['$1', '$2'];
    const conflictSets: string[] = [];
    let paramIdx = 3;
    const queryParams: any[] = [emailId, payload.sub];

    if (typeof read === 'boolean') {
      insertCols.push('read', 'read_at');
      insertVals.push(`$${paramIdx}`, `CASE WHEN $${paramIdx} THEN NOW() ELSE NULL END`);
      conflictSets.push(`read = $${paramIdx}`, `read_at = CASE WHEN $${paramIdx} THEN NOW() ELSE NULL END`);
      queryParams.push(read);
      paramIdx++;
    }
    if (typeof starred === 'boolean') {
      insertCols.push('starred');
      insertVals.push(`$${paramIdx}`);
      conflictSets.push(`starred = $${paramIdx}`);
      queryParams.push(starred);
      paramIdx++;
    }
    if (typeof archived === 'boolean') {
      insertCols.push('archived');
      insertVals.push(`$${paramIdx}`);
      conflictSets.push(`archived = $${paramIdx}`);
      queryParams.push(archived);
      paramIdx++;
    }
    if (typeof deleted === 'boolean') {
      insertCols.push('deleted_at');
      insertVals.push(deleted ? 'NOW()' : 'NULL');
      conflictSets.push(`deleted_at = ${deleted ? 'NOW()' : 'NULL'}`);
    }
    if (typeof spam === 'boolean') {
      insertCols.push('is_spam');
      insertVals.push(`$${paramIdx}`);
      conflictSets.push(`is_spam = $${paramIdx}`);
      queryParams.push(spam);
      paramIdx++;
    }

    const upsertQuery = `INSERT INTO email_reads (${insertCols.join(', ')})
      VALUES (${insertVals.join(', ')})
      ON CONFLICT (email_id, user_id)
      DO UPDATE SET ${conflictSets.join(', ')}`;

    await pgQuery(upsertQuery, queryParams);

    return NextResponse.json({ message: 'Email updated successfully' });
  } catch (err) {
    console.error('Email PATCH error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canPerformImportantAction(payload)) {
      return NextResponse.json({ error: 'Please verify your email to perform this action.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const emailId = url.searchParams.get('emailId');
    if (!emailId) {
      return NextResponse.json({ error: 'emailId is required' }, { status: 400 });
    }

    const { rows: users } = await pgQuery<{ email: string }>('SELECT email FROM users WHERE id = $1', [payload.sub]);
    const user = users[0];
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { rows: userEmailAccounts } = await pgQuery<{ email_address: string }>(
      'SELECT email_address FROM email_accounts WHERE user_id = $1',
      [payload.sub]
    );
    const allEmails = userEmailAccounts.map(a => (a.email_address || '').toLowerCase());
    allEmails.push((user.email || '').toLowerCase());

    const { rows: emails } = await pgQuery<{ sender: string; recipients: string[]; user_id: string | null }>(
      'SELECT sender, recipients, user_id FROM email_messages WHERE id = $1',
      [emailId]
    );
    const email = emails[0];
    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    const msgSender = (email.sender || '').toLowerCase();
    const msgRecipients = Array.isArray(email.recipients) ? email.recipients.map(r => (r || '').toLowerCase()) : [];

    const isRecipient = msgRecipients && allEmails.some(e => msgRecipients.includes(e));
    const isSender = allEmails.includes(msgSender);
    if (!isRecipient && !isSender) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Soft-delete: mark per-user row only. Never globally remove email_messages —
    // other recipients/senders share the row.
    await pgQuery(
      `INSERT INTO email_reads (email_id, user_id, deleted_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (email_id, user_id) DO UPDATE SET deleted_at = NOW()`,
      [emailId, payload.sub]
    );

    // If this user is the only stakeholder (sole owner via user_id and not in
    // recipients/sender for any other account), purge the message row.
    const isOnlyOwner =
      String(email.user_id || '') === String(payload.sub) &&
      msgRecipients.every((r) => allEmails.includes(r)) &&
      (!msgSender || allEmails.includes(msgSender));

    if (isOnlyOwner) {
      const { rows: otherReads } = await pgQuery<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM email_reads WHERE email_id = $1 AND user_id <> $2 AND deleted_at IS NULL',
        [emailId, payload.sub]
      );
      if (Number(otherReads[0]?.count || 0) === 0) {
        await pgQuery('DELETE FROM email_reads WHERE email_id = $1', [emailId]);
        await pgQuery('DELETE FROM email_messages WHERE id = $1 AND user_id = $2', [emailId, payload.sub]);
      }
    }

    return NextResponse.json({ message: 'Email moved to trash' });
  } catch (err) {
    console.error('Email DELETE error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
