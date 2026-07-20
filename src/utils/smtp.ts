import nodemailer from 'nodemailer';

type Attachment = {
  filename: string;
  content: string;
  contentType?: string;
  encoding?: string;
};

type SendInput = {
  from?: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Attachment[];
  smtpConfig?: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  dkim?: {
    domainName: string;
    keySelector: string;
    privateKey: string;
  };
};

function getTransport(
  config?: { host: string; port: number; user: string; pass: string },
  dkim?: { domainName: string; keySelector: string; privateKey: string }
) {
  if (!config?.host || !config?.port) {
    throw new Error('SMTP configuration missing. Provide smtpConfig with host and port');
  }
  const secure = Number(config.port) === 465;
  const internalHost = process.env.INTERNAL_SMTP_HOST || 'smtp-sender';
  const isInternal = config.host === internalHost;
  const allowSelfSigned = String(process.env.SMTP_ALLOW_SELF_SIGNED || '').toLowerCase() === 'true' || isInternal;
  const transportConfig: Record<string, unknown> = {
    host: config.host,
    port: Number(config.port),
    secure,
    tls: {
      rejectUnauthorized: !allowSelfSigned
    },
    requireTLS: isInternal ? false : undefined,
    ignoreTLS: isInternal ? true : undefined,
  };
  if (config.user && config.pass) {
    transportConfig.auth = { user: config.user, pass: config.pass };
  }
  if (dkim?.domainName && dkim?.keySelector && dkim?.privateKey) {
    transportConfig.dkim = {
      domainName: dkim.domainName,
      keySelector: dkim.keySelector,
      privateKey: dkim.privateKey,
    };
  }
  return nodemailer.createTransport(transportConfig);
}

export async function sendSmtpEmail({ from, to, subject, text, html, attachments, smtpConfig, dkim }: SendInput) {
  const transporter = getTransport(smtpConfig, dkim);
  if (!from) throw new Error('sendSmtpEmail: "from" address is required');
  const envelopeFrom = from;

  const mailAttachments = attachments?.map(a => ({
    filename: a.filename,
    content: a.content,
    contentType: a.contentType,
    encoding: (a.encoding || 'base64') as string,
  }));

  const info = await transporter.sendMail({
    from: envelopeFrom,
    to,
    subject,
    text,
    html,
    ...(mailAttachments?.length ? { attachments: mailAttachments } : {}),
  });

  return {
    messageId: info.messageId,
    accepted: (Array.isArray(info.accepted) ? info.accepted : []).map(a => typeof a === 'string' ? a : a.address),
    rejected: (Array.isArray(info.rejected) ? info.rejected : []).map(a => typeof a === 'string' ? a : a.address),
    response: info.response,
  };
}

export function getInternalSmtpConfig() {
  const host = process.env.INTERNAL_SMTP_HOST || 'smtp-sender';
  const port = Number(process.env.INTERNAL_SMTP_PORT || 587);
  return { host, port, user: '', pass: '' };
}
