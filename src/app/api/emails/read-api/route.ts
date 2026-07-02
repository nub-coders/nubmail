import { NextRequest, NextResponse } from 'next/server';
import { getUserFromApiKey } from '@/lib/api-keys';
import { pgQuery } from '@/lib/postgres';
import { rateLimit, getClientIP } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);
    const rl = rateLimit(`email-read-api:${ip}`, 120, 15 * 60 * 1000);
    if (rl.limited) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } });
    }

    const apiUser = await getUserFromApiKey(req);
    if (!apiUser) return NextResponse.json({ error: 'Unauthorized (API key required)' }, { status: 401 });

    if (!apiUser.permissions.includes('read')) {
      return NextResponse.json({ error: 'This API key does not have read permission' }, { status: 403 });
    }

    const url = new URL(req.url);
    const folder = url.searchParams.get('folder') || 'inbox';
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100);
    const cursor = url.searchParams.get('cursor') || null;

    const { rows: users } = await pgQuery<{ email: string }>('SELECT email FROM users WHERE id = $1', [apiUser.id]);
    const user = users[0];
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    let accountQuery = 'SELECT ea.id, ea.email_address FROM email_accounts ea WHERE ea.user_id = $1';
    const accountParams: any[] = [apiUser.id];

    if (apiUser.scopedAccountIds.length > 0) {
      accountQuery += ' AND ea.id = ANY($2)';
      accountParams.push(apiUser.scopedAccountIds);
    }

    const { rows: userEmailAccounts } = await pgQuery<{ id: string; email_address: string }>(accountQuery, accountParams);
    const ownedEmails = userEmailAccounts.map(a => (a.email_address || '').toLowerCase());

    if (apiUser.scopedDomainIds.length > 0 && apiUser.scopedAccountIds.length === 0) {
      const { rows: domainRows } = await pgQuery<{ domain_name: string }>(
        'SELECT domain_name FROM domains WHERE id = ANY($1)',
        [apiUser.scopedDomainIds]
      );
      const scopedDomains = domainRows.map(d => d.domain_name.toLowerCase());
      const filtered = ownedEmails.filter(e => scopedDomains.some(d => e.endsWith('@' + d)));
      ownedEmails.length = 0;
      ownedEmails.push(...filtered);
    }

    if (ownedEmails.length === 0) {
      return NextResponse.json({ emails: [], nextCursor: null });
    }

    const baseColumns = `m.id, m.sender, m.recipients, m.subject, m.body, m.sent_at AS "sentAt",
      COALESCE(r.read, false) AS read,
      COALESCE(r.starred, false) AS starred,
      COALESCE(r.archived, false) AS archived,
      COALESCE(r.is_spam, false) AS "isSpam",
      r.deleted_at AS "deletedAt"`;

    const baseJoin = `FROM email_messages m
      LEFT JOIN email_reads r ON m.id = r.email_id AND r.user_id = $2`;

    let query: string;
    let params: any[];

    if (folder === 'sent') {
      query = `SELECT ${baseColumns} ${baseJoin}
        WHERE m.sender = ANY($1)
        AND NOT (m.recipients && $1)
        AND (r.deleted_at IS NULL)
        ${cursor ? 'AND m.sent_at < $3' : ''}
        ORDER BY m.sent_at DESC LIMIT ${limit + 1}`;
      params = cursor ? [ownedEmails, apiUser.id, cursor] : [ownedEmails, apiUser.id];
    } else if (folder === 'trash') {
      query = `SELECT ${baseColumns} ${baseJoin}
        WHERE (m.recipients && $1 OR m.sender = ANY($1))
        AND r.deleted_at IS NOT NULL
        ${cursor ? 'AND r.deleted_at < $3' : ''}
        ORDER BY r.deleted_at DESC LIMIT ${limit + 1}`;
      params = cursor ? [ownedEmails, apiUser.id, cursor] : [ownedEmails, apiUser.id];
    } else {
      query = `SELECT ${baseColumns} ${baseJoin}
        WHERE m.recipients && $1
        AND NOT (array_length(m.recipients, 1) = 1 AND m.recipients[1] = m.sender)
        AND (r.deleted_at IS NULL)
        AND COALESCE(r.archived, false) = false
        AND COALESCE(r.is_spam, false) = false
        ${cursor ? 'AND m.sent_at < $3' : ''}
        ORDER BY m.sent_at DESC LIMIT ${limit + 1}`;
      params = cursor ? [ownedEmails, apiUser.id, cursor] : [ownedEmails, apiUser.id];
    }

    const { rows: emails } = await pgQuery(query, params);
    const hasMore = emails.length > limit;
    if (hasMore) emails.pop();
    const nextCursor = hasMore && emails.length > 0
      ? emails[emails.length - 1].sentAt || emails[emails.length - 1].deletedAt
      : null;

    return NextResponse.json({ emails, nextCursor });
  } catch (err) {
    console.error('API read error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
