import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/postgres';
import { sendSmtpEmail } from '@/utils/smtp';
import crypto from 'crypto';
import { rateLimit, getClientIP } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    // Rate limit password reset requests: 3 per IP per 30 minutes
    const ip = getClientIP(req.headers);
    const { limited, retryAfterMs } = rateLimit(`forgot-password:${ip}`, 3, 30 * 60 * 1000);
    if (limited) {
      return NextResponse.json(
        { error: 'Too many password reset requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((retryAfterMs || 1800000) / 1000)) } }
      );
    }

    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if user exists
    const { rows } = await pgQuery<{ id: string; email: string; full_name: string | null }>(
      'SELECT id, email, full_name FROM users WHERE LOWER(email) = $1',
      [email.toLowerCase()]
    );

    // Always return success to prevent email enumeration attacks
    if (rows.length === 0) {
      return NextResponse.json({ message: 'If an account exists with this email, you will receive a password reset link' });
    }

    const user = rows[0];

    // Generate a secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    // Store only a one-way hash of the reset token.
    await pgQuery(
      'UPDATE users SET verification_code = $1, verification_code_expiry = $2 WHERE id = $3',
      [resetTokenHash, expiresAt, user.id]
    );

    // Send password reset email
    const protocol = process.env.PROTOCOL || 'https';
    const host = process.env.VIRTUAL_HOST || process.env.HOST || 'localhost:3000';
    const resetUrl = `${protocol}://${host}/reset-password?token=${resetToken}`;

    try {
      const domain = process.env.DOMAIN || 'nubcoder.com';
      await sendSmtpEmail({
        from: `verify@${domain}`,
        to: user.email,
        subject: 'NubMail - Password Reset Request',
        smtpConfig: {
          host: process.env.INTERNAL_SMTP_HOST || 'smtp-sender',
          port: Number(process.env.INTERNAL_SMTP_PORT || 587),
          user: '',
          pass: '',
        },
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 40px;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #A0C4FF; margin: 0; font-size: 28px;">🔒 Password Reset</h1>
                </div>
                <div style="color: #333; line-height: 1.6;">
                  <p style="margin-bottom: 20px;">Hello${user.full_name ? ' ' + user.full_name : ''},</p>
                  <p style="margin-bottom: 20px;">We received a request to reset your password for your NubMail account.</p>
                  <p style="margin-bottom: 30px;">Click the button below to reset your password:</p>
                  <div style="text-align: center; margin: 40px 0;">
                    <a href="${resetUrl}" style="display: inline-block; background-color: #A0C4FF; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Reset Password</a>
                  </div>
                  <p style="margin-bottom: 20px; color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
                  <p style="margin-bottom: 30px; word-break: break-all; background-color: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 13px; color: #666;">${resetUrl}</p>
                  <p style="margin-bottom: 10px; color: #e74c3c; font-weight: 600;">This link will expire in 1 hour.</p>
                  <p style="margin-bottom: 20px; color: #666; font-size: 14px;">If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
                  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
                    <p>© NubMail. All rights reserved.</p>
                  </div>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Password Reset Request

Hello${user.full_name ? ' ' + user.full_name : ''},

We received a request to reset your password for your NubMail account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this password reset, please ignore this email or contact support if you have concerns.

© NubMail. All rights reserved.`
      });

      return NextResponse.json({ message: 'If an account exists with this email, you will receive a password reset link' });
    } catch (emailError) {
      console.error('Email sending error', emailError);
      // Still return success to prevent email enumeration
      return NextResponse.json({ message: 'If an account exists with this email, you will receive a password reset link' });
    }
  } catch (err) {
    console.error('Forgot password error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
