import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/admin';
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/api-keys';

export async function GET(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    const body = await req.json();
    const name = (body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    const { key, id } = await createApiKey(payload.sub, name);
    return NextResponse.json({ id, key, name }); // Return plaintext once
  } catch (err) {
    console.error('API keys POST error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
