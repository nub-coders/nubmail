import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/admin';
import { pgQuery } from '@/lib/postgres';

type SubscriptionInput = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

export async function POST(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as SubscriptionInput;
    const endpoint = body?.endpoint?.trim();
    const p256dh = body?.keys?.p256dh?.trim();
    const auth = body?.keys?.auth?.trim();

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Invalid push subscription payload' }, { status: 400 });
    }

    await pgQuery(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint)
       DO UPDATE SET user_id = EXCLUDED.user_id,
                     p256dh = EXCLUDED.p256dh,
                     auth = EXCLUDED.auth,
                     updated_at = NOW()`,
      [payload.sub, endpoint, p256dh, auth]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Push subscription POST error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as SubscriptionInput;
    const endpoint = body?.endpoint?.trim();

    if (!endpoint) {
      await pgQuery('DELETE FROM push_subscriptions WHERE user_id = $1', [payload.sub]);
      return NextResponse.json({ ok: true });
    }

    await pgQuery('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [payload.sub, endpoint]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Push subscription DELETE error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
