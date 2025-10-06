import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/admin';
import { pgQuery } from '@/lib/postgres';

export async function GET(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { rows } = await pgQuery(
      `SELECT id, email_address AS "emailAddress", storage_quota AS "storageQuota", domain_id AS "domainId",
              smtp_host AS "smtpHost", smtp_port AS "smtpPort", smtp_user AS "smtpUser", created_at AS "createdAt"
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

    const body = await req.json();
    const { emailAddress, domainId, smtpHost, smtpPort, smtpUser, smtpPass } = body;
    
    if (!emailAddress || !domainId) {
      return NextResponse.json({ error: 'emailAddress and domainId required' }, { status: 400 });
    }

    const { rows } = await pgQuery(
      'SELECT id, domain_name FROM domains WHERE id = $1 AND user_id = $2 AND verification_status = $3',
      [domainId, payload.sub, 'verified']
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Domain not found or not verified' }, { status: 404 });
    }

    const existing = await pgQuery('SELECT 1 FROM email_accounts WHERE email_address = $1', [emailAddress.toLowerCase()]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Email account already exists' }, { status: 409 });
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
        domainId,
        payload.sub,
        now,
        hasSmtp ? smtpHost : null,
        hasSmtp ? Number(smtpPort) : null,
        hasSmtp ? smtpUser : null,
        hasSmtp ? smtpPass : null,
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
