import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/postgres';
import { sendSmtpEmail } from '@/utils/smtp';

export async function POST(req: NextRequest) {
  // Use test@domain as recipient and sender
  const domain = process.env.DOMAIN;
  if (!domain) {
    return NextResponse.json({ error: 'DOMAIN environment variable is not configured' }, { status: 500 });
  }
  const to = `test@${domain}`;
  const from = to;
  try {
    await sendSmtpEmail({
      from,
      to,
      subject: 'NubMail DNS Test',
      text: 'This is a test email from NubMail DNS page.'
    });
    // Store a marker in the DB for polling
    await pgQuery(
      `INSERT INTO email_messages (sender, recipients, subject, body, sent_at, user_id, read) VALUES ($1, $2, $3, $4, NOW(), NULL, false)`,
      [from, [to], 'NubMail DNS Test', 'This is a test email from NubMail DNS page.']
    );
    return NextResponse.json({ success: true, domain });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to send test email.' }, { status: 500 });
  }
}
