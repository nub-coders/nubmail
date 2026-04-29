import webpush from 'web-push';
import { pgQuery } from '@/lib/postgres';

type PushRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

let configured = false;
let configChecked = false;

function ensureWebPushConfigured(): boolean {
  if (configChecked) return configured;
  configChecked = true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@localhost';

  if (!publicKey || !privateKey) {
    configured = false;
    return configured;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return configured;
}

function truncate(input: string, max = 96): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1)}...`;
}

export async function sendNewMessagePush(params: {
  userId: string;
  sender: string;
  subject: string;
  emailId: string;
  recipient: string;
}) {
  if (!ensureWebPushConfigured()) return;

  const { userId, sender, subject, emailId, recipient } = params;
  const { rows } = await pgQuery<PushRow>(
    `SELECT endpoint, p256dh, auth
       FROM push_subscriptions
      WHERE user_id = $1`,
    [userId]
  );

  if (rows.length === 0) return;

  const payload = JSON.stringify({
    title: 'New email received',
    body: `${truncate(sender, 48)}${subject ? `: ${truncate(subject, 88)}` : ''}`,
    tag: `email-${emailId}`,
    url: `/dashboard/inbox/${emailId}`,
    data: {
      emailId,
      recipient,
      sender,
    },
  });

  const staleEndpoints: string[] = [];

  await Promise.all(
    rows.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
          { TTL: 60 }
        );
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) {
          staleEndpoints.push(sub.endpoint);
          return;
        }
        console.warn('push send failed', { userId, endpoint: sub.endpoint, code });
      }
    })
  );

  if (staleEndpoints.length > 0) {
    await pgQuery(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = ANY($2::text[])',
      [userId, staleEndpoints]
    );
  }
}
