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
  if (!config?.host || !config?.port) {
    throw new Error('SMTP configuration missing. Provide smtpConfig with host and port');
  }
  const secure = Number(config.port) === 465;
  const transportConfig: any = {
    host: config.host,
    port: Number(config.port),
    secure,
  };
  if (config.user && config.pass) {
    transportConfig.auth = { user: config.user, pass: config.pass };
  }
  return nodemailer.createTransport(transportConfig);
}

export async function sendSmtpEmail({ from, to, subject, text, html, smtpConfig }: SendInput) {
  const transporter = getTransport(smtpConfig);
  const envelopeFrom = from || smtpConfig?.user || process.env.SMTP_FROM || process.env.ADMIN_EMAIL || '';

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

export function getEnvSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  if (!host || !port) {
    throw new Error('Verification SMTP not configured: set SMTP_HOST and SMTP_PORT');
  }
  return { host, port, user, pass };
}


