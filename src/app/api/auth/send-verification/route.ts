import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/postgres';
import { verify } from 'jsonwebtoken';
import { sendSmtpEmail, getEnvSmtpConfig } from '@/utils/smtp';

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '') || null;
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401 });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    let payload: any;
    try {
      payload = verify(token, secret) as any;
    } catch (e) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { rows } = await pgQuery<{ id: string; email: string }>('SELECT id, email FROM users WHERE id = $1', [payload.sub]);
    const user = rows[0];
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pgQuery('UPDATE users SET verification_code = $1, verification_code_expiry = $2 WHERE id = $3', [code, expiresAt, user.id]);

    try {
      await sendSmtpEmail({
        to: user.email,
        subject: 'NubMail - Email Verification Code',
        smtpConfig: getEnvSmtpConfig(),
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #A0C4FF;">Email Verification</h2>
            <p>Your verification code is:</p>
            <div style="background-color: #F0F8FF; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #A0C4FF; letter-spacing: 8px; font-size: 32px; margin: 0;">${code}</h1>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
          </div>
        `,
        text: `Your NubMail verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`
      });

      return NextResponse.json({ message: 'Verification code sent to your email' });
    } catch (emailError) {
      console.error('Email sending error', emailError);
      return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 });
    }
  } catch (err) {
    console.error('Send verification error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
