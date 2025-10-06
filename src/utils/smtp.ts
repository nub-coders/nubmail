// @ts-nocheck
import nodemailer from 'nodemailer';

type SendInput = {
  from?: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  smtpConfig?: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
};

function getTransport(config?: { host: string; port: number; user: string; pass: string }) {
  const host = config?.host || process.env.SMTP_HOST;
  const port = config?.port || Number(process.env.SMTP_PORT || 587);
  const user = config?.user || process.env.SMTP_USER;
  const pass = config?.pass || process.env.SMTP_PASS;
  const secure = port === 465;

  if (!host || !port || !user || !pass) {
    throw new Error('SMTP configuration missing. Provide smtpConfig or set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendSmtpEmail({ from, to, subject, text, html, smtpConfig }: SendInput) {
  const transporter = getTransport(smtpConfig);
  const envelopeFrom = from || smtpConfig?.user || process.env.SMTP_FROM || process.env.ADMIN_EMAIL || process.env.SMTP_USER || '';

  const info = await transporter.sendMail({
    from: envelopeFrom,
    to,
    subject,
    text,
    html,
  });

  return {
    messageId: info.messageId,
    accepted: Array.isArray(info.accepted) ? info.accepted : [],
    rejected: Array.isArray(info.rejected) ? info.rejected : [],
    response: info.response,
  };
}


