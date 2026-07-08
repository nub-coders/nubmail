import { NextRequest, NextResponse } from 'next/server';
import { canPerformImportantAction, getUserFromToken, getAdminFromToken, isServerDnsVerified } from '@/lib/admin';
import { pgQuery } from '@/lib/postgres';
import { encryptField } from '@/lib/field-encryption';

const MAX_ACCOUNTS_PER_USER = Number(process.env.MAX_ACCOUNTS_PER_USER || 100);
const MAX_ACCOUNTS_PER_DOMAIN_PER_USER = Number(process.env.MAX_ACCOUNTS_PER_DOMAIN_PER_USER || 25);
const CREATE_WINDOW_MS = Number(process.env.ACCOUNT_CREATE_WINDOW_MS || 15 * 60 * 1000);
const CREATE_LIMIT_PER_WINDOW = Number(process.env.ACCOUNT_CREATE_LIMIT_PER_WINDOW || 20);

const accountCreateWindow = new Map<string, { count: number; resetAt: number }>();

function checkCreateRateLimit(userId: string): boolean {
  const now = Date.now();
  const existing = accountCreateWindow.get(userId);
  if (!existing || now >= existing.resetAt) {
    accountCreateWindow.set(userId, { count: 1, resetAt: now + CREATE_WINDOW_MS });
    return true;
  }
  if (existing.count >= CREATE_LIMIT_PER_WINDOW) {
    return false;
  }
  existing.count += 1;
  accountCreateWindow.set(userId, existing);
  return true;
}

function getPrimaryDomain(): string | null {
  const domain = process.env.DOMAIN?.trim() || process.env.VIRTUAL_HOST?.trim() || null;
  return domain ? domain.toLowerCase().trim() : null;
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { rows } = await pgQuery(
      `SELECT id, email_address AS "emailAddress", storage_quota AS "storageQuota", domain_id AS "domainId",
              smtp_host AS "smtpHost", smtp_port AS "smtpPort", smtp_user AS "smtpUser", created_at AS "createdAt",
              CASE WHEN password_hash IS NOT NULL AND password_hash != '' THEN true ELSE false END AS "hasImapPassword"
       FROM email_accounts WHERE user_id = $1 ORDER BY created_at DESC`,
      [payload.sub]
    );
    return NextResponse.json({ accounts: rows });
  } catch (err) {
    console.error('Accounts GET error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canPerformImportantAction(payload)) {
      return NextResponse.json({ error: 'Please verify your email to perform this action.' }, { status: 403 });
    }

    if (!checkCreateRateLimit(payload.sub)) {
      return NextResponse.json({
        error: 'Too many account creation requests. Please try again later.'
      }, { status: 429 });
    }

    const body = await req.json();
    const { emailAddress, domainId, smtpHost, smtpPort, smtpUser, smtpPass, useServerDomain } = body;
    
    let actualDomainId = domainId;
    
    // If admin wants to use server domain, handle it specially
    if (useServerDomain) {
      const admin = await getAdminFromToken(req);
      if (!admin) {
        return NextResponse.json({ error: 'Only admins can use server domain' }, { status: 403 });
      }
      
      const dnsVerified = await isServerDnsVerified();
      if (!dnsVerified) {
        return NextResponse.json({ error: 'Server DNS must be verified first' }, { status: 400 });
      }
      
      const primaryDomain = getPrimaryDomain();
      if (!primaryDomain) {
        return NextResponse.json({ error: 'Server domain not configured' }, { status: 500 });
      }
      
      // Check if server domain already exists in domains table
      const { rows: existingDomain } = await pgQuery(
        'SELECT id FROM domains WHERE domain_name = $1',
        [primaryDomain]
      );
      
      if (existingDomain.length === 0) {
        // Create the server domain automatically
        const { rows: newDomain } = await pgQuery(
          `INSERT INTO domains (domain_name, user_id, verification_status, verification_token, created_at)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [primaryDomain, payload.sub, 'verified', 'server-domain-auto', new Date()]
        );
        actualDomainId = newDomain[0].id;
      } else {
        actualDomainId = existingDomain[0].id;
      }
    }
    
    if (!emailAddress || !actualDomainId) {
      return NextResponse.json({ error: 'emailAddress and domainId required' }, { status: 400 });
    }

    const { rows } = await pgQuery(
      'SELECT id, domain_name FROM domains WHERE id = $1 AND verification_status = $2 AND user_id = $3',
      [actualDomainId, 'verified', payload.sub]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Domain not found or not verified' }, { status: 404 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) {
      return NextResponse.json({ error: 'Invalid email address format' }, { status: 400 });
    }

    const emailDomain = emailAddress.toLowerCase().split('@')[1];
    if (emailDomain !== rows[0].domain_name.toLowerCase()) {
      return NextResponse.json({ error: 'Email address must match the selected domain' }, { status: 400 });
    }

    const existing = await pgQuery('SELECT 1 FROM email_accounts WHERE email_address = $1', [emailAddress.toLowerCase()]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Email account already exists' }, { status: 409 });
    }

    const { rows: userCountRows } = await pgQuery<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM email_accounts WHERE user_id = $1',
      [payload.sub]
    );
    const totalForUser = Number(userCountRows[0]?.count || 0);
    if (totalForUser >= MAX_ACCOUNTS_PER_USER) {
      return NextResponse.json({
        error: `Account limit reached (${MAX_ACCOUNTS_PER_USER} max per user)`
      }, { status: 400 });
    }

    const { rows: perDomainRows } = await pgQuery<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM email_accounts WHERE user_id = $1 AND domain_id = $2',
      [payload.sub, actualDomainId]
    );
    const totalForDomain = Number(perDomainRows[0]?.count || 0);
    if (totalForDomain >= MAX_ACCOUNTS_PER_DOMAIN_PER_USER) {
      return NextResponse.json({
        error: `Domain account limit reached (${MAX_ACCOUNTS_PER_DOMAIN_PER_USER} max for this domain)`
      }, { status: 400 });
    }

    const now = new Date();
    const emailLower = emailAddress.toLowerCase();
    const defaultQuota = 1024;

    const hasSmtp = smtpHost && smtpPort && smtpUser && smtpPass;

    const insert = await pgQuery(
      `INSERT INTO email_accounts (email_address, storage_quota, domain_id, user_id, created_at,
        smtp_host, smtp_port, smtp_user, smtp_pass, use_built_in_smtp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, email_address AS "emailAddress", storage_quota AS "storageQuota", domain_id AS "domainId",
                 smtp_host AS "smtpHost", smtp_port AS "smtpPort", smtp_user AS "smtpUser", use_built_in_smtp AS "useBuiltInSmtp", created_at AS "createdAt"`,
      [
        emailLower,
        defaultQuota,
        actualDomainId,
        payload.sub,
        now,
        hasSmtp ? smtpHost : null,
        hasSmtp ? Number(smtpPort) : null,
        hasSmtp ? smtpUser : null,
        hasSmtp ? encryptField(smtpPass) : null,
        !hasSmtp
      ]
    );
    return NextResponse.json(insert.rows[0]);
  } catch (err) {
    console.error('Accounts POST error', err);
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
    const accountId = url.searchParams.get('id');
    if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });

    const { rowCount } = await pgQuery('DELETE FROM email_accounts WHERE id = $1 AND user_id = $2', [accountId, payload.sub]);
    if (rowCount === 0) {
      return NextResponse.json({ error: 'Account not found or unauthorized' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Account DELETE error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
