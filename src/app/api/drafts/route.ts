import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/admin';
import { pgQuery } from '@/lib/postgres';

export async function GET(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { rows } = await pgQuery(
      `SELECT id, from_address AS "fromAddress", to_address AS "toAddress",
        subject, body, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM email_drafts WHERE user_id = $1
      ORDER BY updated_at DESC LIMIT 100`,
      [payload.sub]
    );

    return NextResponse.json({ drafts: rows });
  } catch (err) {
    console.error('Drafts GET error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { fromAddress, toAddress, subject, body } = await req.json();

    const { rows } = await pgQuery(
      `INSERT INTO email_drafts (user_id, from_address, to_address, subject, body)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, from_address AS "fromAddress", to_address AS "toAddress",
        subject, body, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [payload.sub, fromAddress || '', toAddress || '', subject || '', body || '']
    );

    return NextResponse.json({ draft: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('Drafts POST error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, fromAddress, toAddress, subject, body } = await req.json();
    if (!id) return NextResponse.json({ error: 'Draft id is required' }, { status: 400 });

    const { rows } = await pgQuery(
      `UPDATE email_drafts
      SET from_address = $3, to_address = $4, subject = $5, body = $6, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id, from_address AS "fromAddress", to_address AS "toAddress",
        subject, body, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, payload.sub, fromAddress || '', toAddress || '', subject || '', body || '']
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({ draft: rows[0] });
  } catch (err) {
    console.error('Drafts PATCH error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Draft id is required' }, { status: 400 });

    const { rowCount } = await pgQuery(
      'DELETE FROM email_drafts WHERE id = $1 AND user_id = $2',
      [id, payload.sub]
    );

    if (rowCount === 0) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Draft deleted' });
  } catch (err) {
    console.error('Drafts DELETE error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
