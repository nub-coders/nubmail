import { NextRequest, NextResponse } from 'next/server';
import { canPerformImportantAction, getUserFromToken } from '@/lib/admin';
import { pgQuery } from '@/lib/postgres';

export async function GET(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { rows } = await pgQuery(
      `SELECT t.id, t.name, t.owner_id AS "ownerId", t.created_at AS "createdAt",
              (SELECT COUNT(*)::int FROM team_members WHERE team_id = t.id) AS "memberCount"
       FROM teams t
       WHERE t.id IN (
         SELECT team_id FROM team_members WHERE user_id = $1
       )
       ORDER BY t.created_at DESC`,
      [payload.sub]
    );

    return NextResponse.json({ teams: rows });
  } catch (err) {
    console.error('Teams GET error', err);
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
    const { name } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'Team name is required' }, { status: 400 });

    const { rows: [team] } = await pgQuery(
      `INSERT INTO teams (name, owner_id) VALUES ($1, $2) RETURNING id, name, owner_id AS "ownerId", created_at AS "createdAt"`,
      [name.trim(), payload.sub]
    );

    await pgQuery(
      `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [team.id, payload.sub]
    );

    return NextResponse.json({ team: { ...team, memberCount: 1 } }, { status: 201 });
  } catch (err) {
    console.error('Teams POST error', err);
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

    const teamId = req.nextUrl.searchParams.get('id');
    if (!teamId) return NextResponse.json({ error: 'Team ID required' }, { status: 400 });

    const { rows: [team] } = await pgQuery(
      'SELECT owner_id FROM teams WHERE id = $1',
      [teamId]
    );
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    if (String(team.owner_id) !== payload.sub) {
      return NextResponse.json({ error: 'Only the team owner can delete the team' }, { status: 403 });
    }

    await pgQuery('DELETE FROM teams WHERE id = $1', [teamId]);

    return NextResponse.json({ message: 'Team deleted' });
  } catch (err) {
    console.error('Teams DELETE error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
