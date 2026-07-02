import { NextRequest, NextResponse } from 'next/server';
import { getUserFromApiKey } from '@/lib/api-keys';
import { pgQuery } from '@/lib/postgres';
import { encryptField } from '@/lib/field-encryption';
import { rateLimit, getClientIP } from '@/lib/rate-limit';

const MAX_ACCOUNTS_PER_USER = Number(process.env.MAX_ACCOUNTS_PER_USER || 100);
const MAX_ACCOUNTS_PER_DOMAIN_PER_USER = Number(process.env.MAX_ACCOUNTS_PER_DOMAIN_PER_USER || 25);

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);
    const rl = rateLimit(`account-create-api:${ip}`, 20, 15 * 60 * 1000);
    if (rl.limited) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 0) / 1000)) } });
    }

    const apiUser = await getUserFromApiKey(req);
    if (!apiUser) return NextResponse.json({ error: 'Unauthorized (API key required)' }, { status: 401 });

    if (!apiUser.permissions.includes('create_accounts')) {
      return NextResponse.json({ error: 'This API key does not have create_accounts permission' }, { status: 403 });
    }

    const { rows: ownerRows } = await pgQuery<{ email_verified: boolean | null; is_admin: boolean | null }>(
      'SELECT email_verified, is_admin FROM users WHERE id = $1',
      [apiUser.id]
    );
    const owner = ownerRows[0];
    if (!owner) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!owner.is_admin && !owner.email_verified) {
      return NextResponse.json({ error: 'Please verify your email to perform this action.' }, { status: 403 });
    }

    const body = await req.json();
    const { emailAddress, domainId, smtpHost, smtpPort, smtpUser, smtpPass } = body;

    if (!emailAddress || !domainId) {
      return NextResponse.json({ error: 'emailAddress and domainId required' }, { status: 400 });
    }

    if (apiUser.scopedDomainIds.length > 0 && !apiUser.scopedDomainIds.includes(domainId)) {
      return NextResponse.json({ error: 'Domain not in API key scope' }, { status: 403 });
    }

    const { rows: domainRows } = await pgQuery(
      'SELECT id, domain_name FROM domains WHERE id = $1 AND verification_status = $2 AND user_id = $3',
      [domainId, 'verified', apiUser.id]
    );
    if (domainRows.length === 0) {
      return NextResponse.json({ error: 'Domain not found or not verified' }, { status: 404 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) {
      return NextResponse.json({ error: 'Invalid email address format' }, { status: 400 });
    }

    const emailDomain = emailAddress.toLowerCase().split('@')[1];
    if (emailDomain !== domainRows[0].domain_name.toLowerCase()) {
      return NextResponse.json({ error: 'Email address must match the selected domain' }, { status: 400 });
    }

    const existing = await pgQuery('SELECT 1 FROM email_accounts WHERE email_address = $1', [emailAddress.toLowerCase()]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Email account already exists' }, { status: 409 });
    }

    const { rows: userCountRows } = await pgQuery<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM email_accounts WHERE user_id = $1',
      [apiUser.id]
    );
    if (Number(userCountRows[0]?.count || 0) >= MAX_ACCOUNTS_PER_USER) {
      return NextResponse.json({ error: `Account limit reached (${MAX_ACCOUNTS_PER_USER} max per user)` }, { status: 400 });
    }

    const { rows: perDomainRows } = await pgQuery<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM email_accounts WHERE user_id = $1 AND domain_id = $2',
      [apiUser.id, domainId]
    );
    if (Number(perDomainRows[0]?.count || 0) >= MAX_ACCOUNTS_PER_DOMAIN_PER_USER) {
      return NextResponse.json({ error: `Domain account limit reached (${MAX_ACCOUNTS_PER_DOMAIN_PER_USER} max for this domain)` }, { status: 400 });
    }

    const hasSmtp = smtpHost && smtpPort && smtpUser && smtpPass;
    const insert = await pgQuery(
      `INSERT INTO email_accounts (email_address, storage_quota, domain_id, user_id, created_at,
        smtp_host, smtp_port, smtp_user, smtp_pass, use_built_in_smtp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, email_address AS "emailAddress", storage_quota AS "storageQuota", domain_id AS "domainId",
                 created_at AS "createdAt"`,
      [
        emailAddress.toLowerCase(),
        1024,
        domainId,
        apiUser.id,
        new Date(),
        hasSmtp ? smtpHost : null,
        hasSmtp ? Number(smtpPort) : null,
        hasSmtp ? smtpUser : null,
        hasSmtp ? encryptField(smtpPass) : null,
        !hasSmtp
      ]
    );

    return NextResponse.json(insert.rows[0]);
  } catch (err) {
    console.error('API create account error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
