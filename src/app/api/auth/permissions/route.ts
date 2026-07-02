import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, canPerformImportantAction } from '@/lib/admin';
import { getUserFromApiKey, VALID_PERMISSIONS } from '@/lib/api-keys';
import { pgQuery } from '@/lib/postgres';

export async function GET(req: NextRequest) {
  try {
    const apiKeyUser = await getUserFromApiKey(req);
    if (apiKeyUser) {
      const scopedDomains = await getScopedDomains(apiKeyUser.scopedDomainIds);
      const scopedAccounts = await getScopedAccounts(apiKeyUser.scopedAccountIds);

      return NextResponse.json({
        authenticated: true,
        method: 'api_key',
        apiKeyId: apiKeyUser.apiKeyId,
        userId: apiKeyUser.id,
        permissions: apiKeyUser.permissions,
        allPermissions: [...VALID_PERMISSIONS],
        scope: {
          domains: apiKeyUser.scopedDomainIds.length === 0
            ? { restricted: false, message: 'All user domains' }
            : { restricted: true, domains: scopedDomains },
          accounts: apiKeyUser.scopedAccountIds.length === 0
            ? { restricted: false, message: 'All user accounts' }
            : { restricted: true, accounts: scopedAccounts },
        },
        can: {
          send: apiKeyUser.permissions.includes('send'),
          read: apiKeyUser.permissions.includes('read'),
          createAccounts: apiKeyUser.permissions.includes('create_accounts'),
        },
      });
    }

    const sessionUser = await getUserFromToken(req);
    if (sessionUser) {
      const canAct = canPerformImportantAction(sessionUser);

      const { rows: domainRows } = await pgQuery<{ id: string; domain_name: string; verification_status: string }>(
        'SELECT id, domain_name, verification_status FROM domains WHERE user_id = $1 ORDER BY created_at DESC',
        [sessionUser.sub]
      );
      const { rows: accountRows } = await pgQuery<{ id: string; email_address: string }>(
        'SELECT id, email_address FROM email_accounts WHERE user_id = $1 ORDER BY created_at DESC',
        [sessionUser.sub]
      );
      const { rows: teamRows } = await pgQuery<{ id: string; name: string; role: string }>(
        `SELECT t.id, t.name, COALESCE(tm.role, 'owner') AS role
         FROM teams t
         LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $1
         WHERE t.owner_id = $1 OR tm.user_id = $1`,
        [sessionUser.sub]
      );

      return NextResponse.json({
        authenticated: true,
        method: 'session',
        user: {
          id: sessionUser.sub,
          email: sessionUser.email,
          fullName: sessionUser.fullName,
          emailVerified: sessionUser.emailVerified,
          isAdmin: sessionUser.isAdmin,
        },
        can: {
          send: canAct,
          read: true,
          createAccounts: canAct,
          manageDomains: canAct,
          manageApiKeys: canAct,
          manageTeams: canAct,
          adminPanel: sessionUser.isAdmin,
        },
        resources: {
          domains: domainRows.map(d => ({
            id: d.id,
            domain: d.domain_name,
            status: d.verification_status,
          })),
          accounts: accountRows.map(a => ({
            id: a.id,
            email: a.email_address,
          })),
          teams: teamRows.map(t => ({
            id: t.id,
            name: t.name,
            role: t.role,
          })),
        },
      });
    }

    return NextResponse.json({
      authenticated: false,
      error: 'No valid session or API key provided',
      hint: 'Authenticate via session cookie, Bearer token, or x-api-key header',
    }, { status: 401 });
  } catch (err) {
    console.error('Permissions check error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKeyUser = await getUserFromApiKey(req);
    if (apiKeyUser) {
      const body = await req.json();
      const results = checkApiKeyActions(apiKeyUser, body.actions);
      return NextResponse.json({ method: 'api_key', results });
    }

    const sessionUser = await getUserFromToken(req);
    if (sessionUser) {
      const body = await req.json();
      const canAct = canPerformImportantAction(sessionUser);
      const results = checkSessionActions(sessionUser, canAct, body.actions);
      return NextResponse.json({ method: 'session', results });
    }

    return NextResponse.json({
      authenticated: false,
      error: 'No valid session or API key provided',
    }, { status: 401 });
  } catch (err) {
    console.error('Permission check error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function getScopedDomains(domainIds: string[]) {
  if (domainIds.length === 0) return [];
  const { rows } = await pgQuery<{ id: string; domain_name: string }>(
    'SELECT id, domain_name FROM domains WHERE id = ANY($1)',
    [domainIds]
  );
  return rows.map(d => ({ id: d.id, domain: d.domain_name }));
}

async function getScopedAccounts(accountIds: string[]) {
  if (accountIds.length === 0) return [];
  const { rows } = await pgQuery<{ id: string; email_address: string }>(
    'SELECT id, email_address FROM email_accounts WHERE id = ANY($1)',
    [accountIds]
  );
  return rows.map(a => ({ id: a.id, email: a.email_address }));
}

interface ActionCheck {
  action: string;
  allowed: boolean;
  reason?: string;
}

function checkApiKeyActions(
  user: { permissions: string[]; scopedDomainIds: string[]; scopedAccountIds: string[] },
  actions: string[] | undefined,
): ActionCheck[] {
  const toCheck = Array.isArray(actions) ? actions : [...VALID_PERMISSIONS];
  return toCheck.map(action => {
    const allowed = user.permissions.includes(action);
    return {
      action,
      allowed,
      reason: allowed ? undefined : `API key lacks '${action}' permission`,
    };
  });
}

function checkSessionActions(
  user: { isAdmin: boolean; emailVerified: boolean },
  canAct: boolean,
  actions: string[] | undefined,
): ActionCheck[] {
  const SESSION_ACTIONS: Record<string, (u: typeof user, can: boolean) => { allowed: boolean; reason?: string }> = {
    send: (_, can) => can ? { allowed: true } : { allowed: false, reason: 'Email verification required' },
    read: () => ({ allowed: true }),
    create_accounts: (_, can) => can ? { allowed: true } : { allowed: false, reason: 'Email verification required' },
    manage_domains: (_, can) => can ? { allowed: true } : { allowed: false, reason: 'Email verification required' },
    manage_api_keys: (_, can) => can ? { allowed: true } : { allowed: false, reason: 'Email verification required' },
    manage_teams: (_, can) => can ? { allowed: true } : { allowed: false, reason: 'Email verification required' },
    admin: (u) => u.isAdmin ? { allowed: true } : { allowed: false, reason: 'Admin role required' },
  };

  const toCheck = Array.isArray(actions) ? actions : Object.keys(SESSION_ACTIONS);
  return toCheck.map(action => {
    const checker = SESSION_ACTIONS[action];
    if (!checker) {
      return { action, allowed: false, reason: 'Unknown action' };
    }
    const result = checker(user, canAct);
    return { action, ...result };
  });
}
