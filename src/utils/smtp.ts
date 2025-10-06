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

  if (!host || !port) {
    throw new Error('SMTP configuration missing. Provide smtpConfig or set SMTP_HOST, SMTP_PORT');
  }

  const transportConfig: any = {
    host,
    port,
    secure,
  };

  if (user && pass) {
    transportConfig.auth = { user, pass };
  }

  return nodemailer.createTransport(transportConfig);
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


