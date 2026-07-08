import { NextRequest, NextResponse } from 'next/server';
import { canPerformImportantAction, getUserFromToken } from '@/lib/admin';
import { pgQuery } from '@/lib/postgres';

export async function GET(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const teamId = req.nextUrl.searchParams.get('teamId');
    if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });

    const { rows: [membership] } = await pgQuery(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, payload.sub]
    );
    if (!membership) return NextResponse.json({ error: 'Not a member of this team' }, { status: 403 });

    const { rows } = await pgQuery(
      `SELECT tm.id, tm.user_id AS "userId", tm.role, tm.joined_at AS "joinedAt",
              u.email, u.full_name AS "fullName"
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY tm.joined_at`,
      [teamId]
    );

    return NextResponse.json({ members: rows });
  } catch (err) {
    console.error('Team members GET error', err);
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
    const { teamId, email, role } = body;
    if (!teamId || !email) return NextResponse.json({ error: 'teamId and email required' }, { status: 400 });

    const { rows: [membership] } = await pgQuery(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, payload.sub]
    );
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owners and admins can add members' }, { status: 403 });
    }

    const { rows: [targetUser] } = await pgQuery(
      'SELECT id FROM users WHERE LOWER(email) = $1',
      [email.toLowerCase()]
    );
    if (!targetUser) return NextResponse.json({ error: 'User not found with that email' }, { status: 404 });

    const { rows: [existing] } = await pgQuery(
      'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, targetUser.id]
    );
    if (existing) return NextResponse.json({ error: 'User is already a member' }, { status: 409 });

    const memberRole = role === 'admin' ? 'admin' : 'member';
    await pgQuery(
      'INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)',
      [teamId, targetUser.id, memberRole]
    );

    const { rows: [member] } = await pgQuery(
      `SELECT tm.id, tm.user_id AS "userId", tm.role, tm.joined_at AS "joinedAt",
              u.email, u.full_name AS "fullName"
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 AND tm.user_id = $2`,
      [teamId, targetUser.id]
    );

    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    console.error('Team members POST error', err);
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

    const teamId = req.nextUrl.searchParams.get('teamId');
    const userId = req.nextUrl.searchParams.get('userId');
    if (!teamId || !userId) return NextResponse.json({ error: 'teamId and userId required' }, { status: 400 });

    const { rows: [callerMembership] } = await pgQuery(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, payload.sub]
    );
    if (!callerMembership) return NextResponse.json({ error: 'Not a member of this team' }, { status: 403 });

    if (userId !== payload.sub && callerMembership.role !== 'owner' && callerMembership.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can remove members' }, { status: 403 });
    }

    const { rows: [target] } = await pgQuery(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    if (target.role === 'owner') return NextResponse.json({ error: 'Cannot remove the team owner' }, { status: 403 });

    await pgQuery(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    return NextResponse.json({ message: 'Member removed' });
  } catch (err) {
    console.error('Team members DELETE error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
