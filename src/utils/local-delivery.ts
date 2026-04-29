import { pgQuery } from '@/lib/postgres';
import { sendNewMessagePush } from '@/lib/push-notifications';

type DeliverLocalInput = {
  recipients: string[];
  sender: string;
  subject: string;
  body: string;
};

type DeliverLocalResult = {
  localRecipients: string[];
  externalRecipients: string[];
};

export async function deliverLocal({
  recipients,
  sender,
  subject,
  body,
}: DeliverLocalInput): Promise<DeliverLocalResult> {
  if (recipients.length === 0) {
    return { localRecipients: [], externalRecipients: [] };
  }

  const normalized = recipients.map((r) => r.toLowerCase());

  const { rows } = await pgQuery<{ email_address: string; user_id: string }>(
    `SELECT ea.email_address, ea.user_id
       FROM email_accounts ea
       JOIN domains d ON d.id = ea.domain_id
      WHERE lower(ea.email_address) = ANY($1)
        AND d.verification_status = 'verified'`,
    [normalized]
  );

  const localMap = new Map(rows.map((r) => [r.email_address.toLowerCase(), r.user_id]));
  const localRecipients: string[] = [];
  const externalRecipients: string[] = [];

  for (const rcpt of normalized) {
    if (localMap.has(rcpt)) {
      localRecipients.push(rcpt);
    } else {
      externalRecipients.push(rcpt);
    }
  }

  const now = new Date();
  for (const rcpt of localRecipients) {
    const uid = localMap.get(rcpt)!;
    const result = await pgQuery<{ id: string }>(
      `INSERT INTO email_messages (sender, recipients, subject, body, sent_at, user_id, read)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING id`,
      [sender.toLowerCase(), [rcpt], subject, body, now, uid]
    );

    const emailId = result.rows[0]?.id;
    if (emailId) {
      await sendNewMessagePush({
        userId: uid,
        sender,
        subject,
        emailId,
        recipient: rcpt,
      });
    }
  }

  return { localRecipients, externalRecipients };
}
