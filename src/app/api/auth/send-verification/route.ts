import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/postgres';
import { sign, verify } from 'jsonwebtoken';
import { sendSmtpEmail } from '@/utils/smtp';
import { getTokenFromRequest } from '@/lib/auth-token';

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
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

    const { rows } = await pgQuery<{ id: string; email: string; email_verified: boolean | null }>(
      'SELECT id, email, email_verified FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = rows[0];
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (user.email_verified) {
      return NextResponse.json({ message: 'Email is already verified' });
    }

    const verifyToken = sign(
      { sub: String(user.id), type: 'verify' },
      secret,
      { expiresIn: '30m' }
    );

    const protocol = process.env.PROTOCOL || 'https';
    const host = process.env.HOST || process.env.VIRTUAL_HOST || 'localhost:5000';
    const verificationUrl = new URL(`/api/auth/verify?token=${verifyToken}`, `${protocol}://${host}`);


    try {
      const domain = process.env.DOMAIN || 'nubcoder.com';
      await sendSmtpEmail({
        from: `verify@${domain}`,
        to: user.email,
        subject: 'NubMail - Verify your email',
        smtpConfig: {
          host: process.env.INTERNAL_SMTP_HOST || 'smtp-sender',
          port: Number(process.env.INTERNAL_SMTP_PORT || 587),
          user: '',
          pass: '',
        },
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #A0C4FF;">Email Verification</h2>
            <p>Click the button below to verify your email address:</p>
            <div style="margin: 24px 0; text-align: center;">
              <a href="${verificationUrl.toString()}" style="display: inline-block; background-color: #A0C4FF; color: #0f172a; text-decoration: none; font-weight: 700; padding: 12px 20px; border-radius: 8px;">Verify Email</a>
            </div>
            <p>This link will expire in 30 minutes.</p>
            <p style="word-break: break-all; color: #666; font-size: 12px;">If the button does not work, copy and paste this link into your browser:<br/>${verificationUrl.toString()}</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
          </div>
        `,
        text: `Verify your NubMail email by opening this link:\n\n${verificationUrl.toString()}\n\nThis link will expire in 30 minutes.\n\nIf you didn't request this email, please ignore it.`
      });

      return NextResponse.json({ message: 'Verification link sent to your email' });
    } catch (emailError) {
      console.error('Email sending error', emailError);
      return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 });
    }
  } catch (err) {
    console.error('Send verification error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
