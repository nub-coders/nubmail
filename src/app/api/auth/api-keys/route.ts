import { NextRequest, NextResponse } from 'next/server';
import { canPerformImportantAction, getUserFromToken } from '@/lib/admin';
import { createApiKey, listApiKeys, revealApiKey, revokeApiKey, VALID_PERMISSIONS, ApiKeyPermission } from '@/lib/api-keys';
import { pgQuery } from '@/lib/postgres';

export async function GET(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (id) {
      const key = await revealApiKey(payload.sub, id);
      if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ key, id });
    }
    const keys = await listApiKeys(payload.sub);
    return NextResponse.json({ keys });
  } catch (err) {
    console.error('API keys GET error', err);
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
    const body = await req.json();
    const name = (body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const permissions: ApiKeyPermission[] = Array.isArray(body.permissions)
      ? body.permissions.filter((p: string) => VALID_PERMISSIONS.includes(p as ApiKeyPermission))
      : ['send'];
    if (permissions.length === 0) {
      return NextResponse.json({ error: 'At least one valid permission required' }, { status: 400 });
    }

    const domainIds: string[] = Array.isArray(body.domainIds) ? body.domainIds : [];
    const accountIds: string[] = Array.isArray(body.accountIds) ? body.accountIds : [];

    if (domainIds.length > 0) {
      const { rows } = await pgQuery<{ id: string }>(
        'SELECT id FROM domains WHERE id = ANY($1) AND user_id = $2',
        [domainIds, payload.sub]
      );
      if (rows.length !== domainIds.length) {
        return NextResponse.json({ error: 'One or more domains not found or not owned by you' }, { status: 400 });
      }
    }

    if (accountIds.length > 0) {
      const { rows } = await pgQuery<{ id: string }>(
        'SELECT id FROM email_accounts WHERE id = ANY($1) AND user_id = $2',
        [accountIds, payload.sub]
      );
      if (rows.length !== accountIds.length) {
        return NextResponse.json({ error: 'One or more accounts not found or not owned by you' }, { status: 400 });
      }
    }

    const { key, id } = await createApiKey({
      userId: payload.sub,
      name,
      permissions,
      domainIds: domainIds.length > 0 ? domainIds : undefined,
      accountIds: accountIds.length > 0 ? accountIds : undefined,
    });
    return NextResponse.json({ id, key, name, permissions, domainIds, accountIds });
  } catch (err) {
    console.error('API keys POST error', err);
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
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id param required' }, { status: 400 });
    const ok = await revokeApiKey(payload.sub, id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ id, revoked: true });
  } catch (err) {
    console.error('API keys DELETE error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
