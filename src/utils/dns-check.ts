import { promises as dns } from 'dns';

export type DnsRecordStatus = {
  check: string;
  ok: boolean;
  details?: string;
};

export type DnsCheckInput = {
  rootDomain: string; // apex like nub-coder.tech
  mailHostname: string; // host used by server, usually mail.<rootDomain>
  dkimSelector: string;
  serverPublicIp?: string;
};

export async function runDnsChecks({ rootDomain, mailHostname, dkimSelector, serverPublicIp }: DnsCheckInput): Promise<DnsRecordStatus[]> {
  const results: DnsRecordStatus[] = [];

  async function safe<T>(label: string, fn: () => Promise<T>, onOk?: (value: T) => string): Promise<void> {
    try {
      const value = await fn();
      const details = onOk ? onOk(value) : undefined;
      results.push({ check: label, ok: true, details });
    } catch (err: any) {
      results.push({ check: label, ok: false, details: err?.message || String(err) });
    }
  }

  // A record for mail hostname
  await safe(`A ${mailHostname}`, async () => {
    const addrs = await dns.resolve4(mailHostname);
    if (serverPublicIp && !addrs.includes(serverPublicIp)) {
      throw new Error(`Expected ${serverPublicIp} but got [${addrs.join(', ')}]`);
    }
    return addrs;
  }, (addrs) => Array.isArray(addrs) ? addrs.join(', ') : String(addrs));

  // PTR for server IP
  if (serverPublicIp) {
    await safe(`PTR ${serverPublicIp}`, async () => {
      const ptrs = await dns.reverse(serverPublicIp);
      if (!ptrs.includes(mailHostname)) {
        throw new Error(`PTRs [${ptrs.join(', ')}] do not include ${mailHostname}`);
      }
      return ptrs;
    }, (ptrs) => Array.isArray(ptrs) ? ptrs.join(', ') : String(ptrs));
  }

  // MX is optional for "sending only". We still show if it points to our host (informational)
  await safe(`MX ${rootDomain} (info)`, async () => {
    const mx = await dns.resolveMx(rootDomain);
    return mx.map((m) => `${m.exchange}:${m.priority}`).join(', ');
  }, (mxs) => String(mxs));

  // SPF on root domain
  await safe(`SPF ${rootDomain}`, async () => {
    const txt = await dns.resolveTxt(rootDomain);
    const records = txt.map((chunks) => chunks.join(''));
    const spf = records.find((r) => r.toLowerCase().startsWith('v=spf1'));
    if (!spf) throw new Error('No SPF record found');
    if (serverPublicIp && !/ip4:\s*\d+\.\d+\.\d+\.\d+/i.test(spf) && !/\ba\b/.test(spf) && !/\bmx\b/.test(spf)) {
      // Not strictly required, but warn if neither ip4 nor a/mx present
      return `Found: ${spf} (ensure it authorizes ${serverPublicIp})`;
    }
    return spf;
  }, (val) => String(val));

  // DKIM selector
  await safe(`DKIM ${dkimSelector}._domainkey.${rootDomain}`, async () => {
    const txt = await dns.resolveTxt(`${dkimSelector}._domainkey.${rootDomain}`);
    const joined = txt.map((chunks) => chunks.join(''));
    const dkim = joined.find((r) => r.toLowerCase().includes('v=dkim1'));
    if (!dkim) throw new Error('No DKIM TXT found');
    return dkim;
  }, (dkim) => String(dkim));

  // DMARC
  await safe(`DMARC _dmarc.${rootDomain}`, async () => {
    const txt = await dns.resolveTxt(`_dmarc.${rootDomain}`);
    const records = txt.map((chunks) => chunks.join(''));
    const dmarc = records.find((r) => r.toLowerCase().startsWith('v=dmarc1'));
    if (!dmarc) throw new Error('No DMARC record found');
    return dmarc;
  }, (dmarc) => String(dmarc));

  return results;
}

export function getDnsCheckConfigFromEnv(): DnsCheckInput {
  // Use env.DOMAIN as the canonical input; it may be a subdomain
  // If DOMAIN is a subdomain, rootDomain is derived from the last two labels
  const domainEnv = (process.env.DOMAIN || '').split(':')[0];
  const labels = domainEnv.split('.').filter(Boolean);
  const rootDomain = labels.length >= 2 ? labels.slice(-2).join('.') : domainEnv;
  const mailHostname = process.env.MAIL_HOSTNAME || process.env.POSTFIX_myhostname || (domainEnv || `mail.${rootDomain}`);
  const dkimSelector = process.env.DKIM_SELECTOR || 'mail';
  const serverPublicIp = process.env.SERVER_PUBLIC_IP;
  if (!rootDomain || !mailHostname) {
    throw new Error('ROOT_DOMAIN or MAIL_HOSTNAME is not configured');
  }
  return { rootDomain, mailHostname, dkimSelector, serverPublicIp };
}


