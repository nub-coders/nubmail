import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/postgres';

export async function GET(req: NextRequest) {
  const domain = process.env.DOMAIN;
  if (!domain) {
    return NextResponse.json({ error: 'DOMAIN environment variable is not configured' }, { status: 500 });
  }
  const to = `test@${domain}`;
  // Check if the test email was received
  const { rows } = await pgQuery(
    `SELECT * FROM email_messages WHERE recipients @> ARRAY[$1] AND subject = 'NubMail DNS Test' ORDER BY sent_at DESC LIMIT 1`,
    [to]
  );
  if (rows.length > 0) {
    return NextResponse.json({ delivered: true });
  }
  return NextResponse.json({ delivered: false });
}
