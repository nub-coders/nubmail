const nodemailer = require('nodemailer');

const recipients = [
'hello@betimeful.com', 'hello@automatedemailwarmup.com', 'daniel@useunhook.com', 'daniyaltechto@gmail.com', 'daniyal@maxify.co'
];

const from = 'contact@nubcoder.com';
const subject = 'Email Deliverability Test — NubCoder';
const textBody = `Hi there,

This is a deliverability test email sent from contact@nubcoder.com via NubMail.

Purpose: Verifying that emails from our domain are being delivered correctly to your inbox (not spam).

If you received this email in your inbox, our deliverability is working as expected!

Best regards,
NubCoder Team
contact@nubcoder.com`;

const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="border-bottom: 3px solid #6366f1; padding-bottom: 15px; margin-bottom: 20px;">
    <h2 style="color: #6366f1; margin: 0;">📧 Email Deliverability Test</h2>
    <p style="color: #666; margin: 5px 0 0 0;">From: contact@nubcoder.com</p>
  </div>
  <p>Hi there,</p>
  <p>This is a <strong>deliverability test email</strong> sent from <code>contact@nubcoder.com</code> via NubMail.</p>
  <p><strong>Purpose:</strong> Verifying that emails from our domain are being delivered correctly to your inbox (not spam).</p>
  <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
    ✅ If you received this email in your <strong>inbox</strong>, our deliverability is working as expected!
  </div>
  <p style="color: #666; font-size: 14px; margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee;">
    Best regards,<br>
    <strong>NubCoder Team</strong><br>
    contact@nubcoder.com
  </p>
  <p style="color: #999; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
</body>
</html>`;

async function sendTestEmails() {
  // Connect to the local SMTP sender container
  const transporter = nodemailer.createTransport({
    host: 'localhost',
    port: 587,
    secure: false,
    tls: {
      rejectUnauthorized: false,
    },
    // No auth needed for the internal Postfix relay
  });

  console.log('Verifying SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified!\n');
  } catch (err) {
    console.error('❌ SMTP connection failed:', err.message);
    process.exit(1);
  }

  const results = [];

  for (const to of recipients) {
    try {
      console.log(`📤 Sending to ${to}...`);
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text: textBody,
        html: htmlBody,
      });
      console.log(`   ✅ Sent! MessageID: ${info.messageId}`);
      console.log(`   Response: ${info.response}`);
      console.log(`   Accepted: ${JSON.stringify(info.accepted)}`);
      if (info.rejected && info.rejected.length > 0) {
        console.log(`   ⚠️ Rejected: ${JSON.stringify(info.rejected)}`);
      }
      results.push({ to, status: 'sent', messageId: info.messageId, response: info.response });
    } catch (err) {
      console.log(`   ❌ Failed: ${err.message}`);
      results.push({ to, status: 'failed', error: err.message });
    }
    console.log('');
  }

  console.log('\n========== SUMMARY ==========');
  console.log(`Total: ${results.length}`);
  console.log(`Sent: ${results.filter(r => r.status === 'sent').length}`);
  console.log(`Failed: ${results.filter(r => r.status === 'failed').length}`);
  console.log('');
  for (const r of results) {
    console.log(`  ${r.status === 'sent' ? '✅' : '❌'} ${r.to} — ${r.status}${r.error ? ` (${r.error})` : ''}`);
  }
}

sendTestEmails().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
