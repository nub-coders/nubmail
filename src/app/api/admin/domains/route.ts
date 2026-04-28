import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/postgres';
import { getAdminFromToken } from '@/lib/admin';

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminFromToken(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { rows } = await pgQuery(
      `SELECT d.id, d.domain_name AS "domainName", d.verification_status AS "verificationStatus", 
              d.created_at AS "createdAt", d.user_id AS "userId", u.email AS "userEmail"
       FROM domains d
       LEFT JOIN users u ON d.user_id = u.id
       ORDER BY d.created_at DESC`
    );

    return NextResponse.json({ domains: rows });
  } catch (err) {
    console.error('Admin domains GET error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await getAdminFromToken(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const url = new URL(req.url);
    const domainId = url.searchParams.get('domainId');
    
    if (!domainId) {
      return NextResponse.json({ error: 'domainId required' }, { status: 400 });
    }

    const { rowCount } = await pgQuery('DELETE FROM domains WHERE id = $1', [domainId]);
    
    if (rowCount === 0) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Domain deleted successfully' });
  } catch (err) {
    console.error('Admin domains DELETE error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

