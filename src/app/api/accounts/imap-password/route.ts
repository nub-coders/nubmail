import { NextRequest, NextResponse } from 'next/server';
import { canPerformImportantAction, getUserFromToken } from '@/lib/admin';
import { pgQuery } from '@/lib/postgres';
import bcrypt from 'bcryptjs';

// POST /api/accounts/imap-password - Set IMAP/POP3 password for an email account
export async function POST(request: NextRequest) {
  try {
    const payload = await getUserFromToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canPerformImportantAction(payload)) {
      return NextResponse.json({ error: 'Please verify your email to perform this action.' }, { status: 403 });
    }

    const body = await request.json();
    const { accountId, password } = body;

    if (!accountId || !password) {
      return NextResponse.json(
        { error: 'Account ID and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Verify the email account belongs to the authenticated user
    const accountCheck = await pgQuery(
      'SELECT id FROM email_accounts WHERE id = $1 AND user_id = $2',
      [accountId, payload.sub]
    );

    if (accountCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Email account not found or access denied' },
        { status: 404 }
      );
    }

    // Hash the password using bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Update the email account with the new password hash
    await pgQuery(
      'UPDATE email_accounts SET password_hash = $1 WHERE id = $2',
      [passwordHash, accountId]
    );

    return NextResponse.json({
      success: true,
      message: 'IMAP/POP3 password set successfully'
    });
  } catch (error) {
    console.error('Error setting IMAP password:', error);
    return NextResponse.json(
      { error: 'Failed to set IMAP password' },
      { status: 500 }
    );
  }
}
