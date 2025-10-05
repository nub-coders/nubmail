import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { verify } from 'jsonwebtoken';
import { sendEmail } from '@/utils/replitmail';

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

    const db = await getDb();
    const users = db.collection('users');
    const user = await users.findOne({ _id: new (await import('mongodb')).ObjectId(payload.sub) });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await users.updateOne(
      { _id: user._id },
      { $set: { verificationCode: code, verificationCodeExpiry: expiresAt } }
    );

    try {
      await sendEmail({
        to: user.email,
        subject: 'NubMail - Email Verification Code',
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
