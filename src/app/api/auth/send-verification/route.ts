import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/postgres';
import { sendSmtpEmail } from '@/utils/smtp';
import { getTokenFromRequest } from '@/lib/auth-token';
import { signVerifyToken, verifyJwt } from '@/lib/jwt-server';

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) return NextResponse.json({ error: 'No token provided' }, { status: 401 });

    const payload = verifyJwt(token);
    if (!payload?.sub) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { rows } = await pgQuery<{ id: string; email: string; email_verified: boolean | null }>(
      'SELECT id, email, email_verified FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = rows[0];
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (user.email_verified) {
      return NextResponse.json({ message: 'Email is already verified' });
    }

    const verifyToken = signVerifyToken(String(user.id));
    if (!verifyToken) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const protocol = process.env.PROTOCOL || 'https';
    const host = process.env.HOST || process.env.VIRTUAL_HOST || 'localhost:5000';
    const verificationUrl = new URL(`/api/auth/verify?token=${verifyToken}`, `${protocol}://${host}`);


    try {
      const domain = process.env.DOMAIN || 'example.com';
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
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify your email</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
              .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
              .header { background: linear-gradient(135deg, #a0c4ff 0%, #5b8aff 100%); padding: 40px 20px; text-align: center; color: #ffffff; }
              .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
              .content { padding: 40px 20px; }
              .content h2 { color: #0f172a; font-size: 18px; margin-top: 0; margin-bottom: 15px; }
              .content p { color: #4b5563; font-size: 14px; line-height: 1.6; margin: 15px 0; }
              .cta-section { margin: 30px 0; text-align: center; }
              .cta-button { display: inline-block; background: linear-gradient(135deg, #a0c4ff 0%, #5b8aff 100%); color: #0f172a; text-decoration: none; font-weight: 600; padding: 14px 32px; border-radius: 8px; font-size: 15px; }
              .cta-button:hover { opacity: 0.9; }
              .fallback-link { margin: 20px 0; padding: 20px; background-color: #f5f5f5; border-left: 4px solid #a0c4ff; border-radius: 4px; }
              .fallback-link p { margin: 0 0 10px 0; color: #4b5563; font-size: 12px; }
              .fallback-link a { color: #5b8aff; word-break: break-all; }
              .footer { padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
              .footer p { margin: 5px 0; }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="header">
                <h1>NubMail</h1>
              </div>
              <div class="content">
                <h2>Verify your email address</h2>
                <p>Thanks for signing up! Please verify your email address by clicking the button below to activate your account.</p>
                <div class="cta-section">
                  <a href="${verificationUrl.toString()}" class="cta-button">Verify Email</a>
                </div>
                <p style="color: #9ca3af; font-size: 13px;">This link will expire in 30 minutes.</p>
                <div class="fallback-link">
                  <p><strong>Link not working?</strong></p>
                  <p>Copy and paste this link into your browser:</p>
                  <a href="${verificationUrl.toString()}">${verificationUrl.toString()}</a>
                </div>
                <p style="color: #9ca3af; font-size: 12px;">If you didn't request this email, you can safely ignore it.</p>
              </div>
              <div class="footer">
                <p>&copy; 2024 NubMail. All rights reserved.</p>
                <p>Professional Email Service</p>
              </div>
            </div>
          </body>
          </html>
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
