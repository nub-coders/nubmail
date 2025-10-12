import { NextRequest, NextResponse } from 'next/server';
import dns from 'dns/promises';

import { getAdminFromToken } from '@/lib/admin';
import { pgQuery } from '@/lib/postgres';

type RecordStatus = 'configured' | 'missing' | 'mismatch' | 'action_required';

type ServerDnsRecord = {
  key: string;
  type: 'A' | 'MX' | 'TXT' | 'CNAME';
  name: string;
  host: string;
  expectedValue: string;
  priority?: number;
  status: RecordStatus;
  observedValues: string[];
  message: string;
  optional?: boolean;
  canAutoGenerate?: boolean;
  selector?: string;
};

const DNS_TIMEOUT_MS = 10000;

function normalizeDomain(input: string): string {
  return input.toLowerCase().trim().replace(/\.$/, '');
}

function ensureTrailingDot(str: string): string {
  return str.endsWith('.') ? str : `${str}.`;
}

function equalsHostname(a: string, b: string): boolean {
  return normalizeDomain(a).replace(/\.$/, '') === normalizeDomain(b).replace(/\.$/, '');
}

function getPrimaryDomain(): string | null {
  const domain = process.env.DOMAIN?.trim() || process.env.VIRTUAL_HOST?.trim() || null;
  return domain ? normalizeDomain(domain) : null;
}

function getMailHost(primaryDomain: string): string {
  const hostCandidate = process.env.HOST?.trim();
  if (hostCandidate) {
    return normalizeDomain(hostCandidate);
  }

  const virtualHost = process.env.VIRTUAL_HOST?.trim();
  if (virtualHost) {
    return normalizeDomain(virtualHost);
  }

  const baseDomain = process.env.DOMAIN?.trim() || primaryDomain;
  if (baseDomain) {
    const normalizedBase = normalizeDomain(baseDomain);
    if (!normalizedBase) {
      return 'mails.nub-coder.tech';
    }

    if (normalizedBase.startsWith('mail.') || normalizedBase.startsWith('mails.')) {
      return normalizedBase;
    }

    return normalizeDomain(`mails.${normalizedBase}`);
  }

  return 'mails.nub-coder.tech';
}

async function safeResolveTxt(host: string): Promise<{ values: string[]; error?: string }> {
  try {
    const result = await Promise.race([
      dns.resolveTxt(host),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS lookup timeout')), DNS_TIMEOUT_MS)),
    ]);
    const flattened = result.map((entry) => (Array.isArray(entry) ? entry.join('') : String(entry)));
    return { values: flattened };
  } catch (err: any) {
    if (err?.code === 'ENODATA' || err?.code === 'ENOTFOUND' || err?.code === 'ESERVFAIL') {
      return { values: [] };
    }
    return { values: [], error: err?.message || 'DNS lookup failed' };
  }
}

async function safeResolveMx(host: string): Promise<{ values: { exchange: string; priority: number }[]; error?: string }> {
  try {
    const result = await Promise.race([
      dns.resolveMx(host),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS lookup timeout')), DNS_TIMEOUT_MS)),
    ]);
    return { values: result.map((r) => ({ exchange: normalizeDomain(r.exchange), priority: r.priority })) };
  } catch (err: any) {
    if (err?.code === 'ENODATA' || err?.code === 'ENOTFOUND' || err?.code === 'ESERVFAIL') {
      return { values: [] };
    }
    return { values: [], error: err?.message || 'DNS lookup failed' };
  }
}

async function safeResolveCname(host: string): Promise<{ values: string[]; error?: string }> {
  try {
    const result = await Promise.race([
      dns.resolveCname(host),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS lookup timeout')), DNS_TIMEOUT_MS)),
    ]);
    return { values: result.map((r) => normalizeDomain(r)) };
  } catch (err: any) {
    if (err?.code === 'ENODATA' || err?.code === 'ENOTFOUND' || err?.code === 'ESERVFAIL') {
      return { values: [] };
    }
    return { values: [], error: err?.message || 'DNS lookup failed' };
  }
}

async function safeResolveA(host: string): Promise<{ values: string[]; error?: string }> {
  try {
    const result = await Promise.race([
      dns.resolve4(host),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS lookup timeout')), DNS_TIMEOUT_MS)),
    ]);
    return { values: result };
  } catch (err: any) {
    if (err?.code === 'ENODATA' || err?.code === 'ENOTFOUND' || err?.code === 'ESERVFAIL') {
      return { values: [] };
    }
    return { values: [], error: err?.message || 'DNS lookup failed' };
  }
}

async function ensureDkimTable(): Promise<void> {
  await pgQuery(`
    CREATE TABLE IF NOT EXISTS domain_dkim (
      id SERIAL PRIMARY KEY,
      domain_name TEXT UNIQUE NOT NULL,
      selector TEXT NOT NULL,
      public_key TEXT NOT NULL,
      private_key TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
}

function exportPublicKeyPemToDns(pubKeyPem: string): string {
  return pubKeyPem.replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\r?\n/g, '')
    .trim();
}

async function getDkimEntry(domain: string): Promise<{ selector: string; publicKey: string } | null> {
  const normalizedDomain = normalizeDomain(domain);
  await ensureDkimTable();
  const { rows } = await pgQuery<{ selector: string; public_key: string }>(
    `SELECT selector, public_key FROM domain_dkim WHERE domain_name = $1`,
    [normalizedDomain]
  );
  if (rows.length === 0) {
    return null;
  }
  return { selector: rows[0].selector, publicKey: rows[0].public_key };
}

function sanitizeSelector(selector: string): string {
  return selector.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'mail';
}

async function generateKeyPair(): Promise<{ publicKeyPem: string; privateKeyPem: string }>{
  const { generateKeyPair } = await import('crypto');
  return new Promise((resolve, reject) => {
    generateKeyPair(
      'rsa',
      {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      },
      (err, publicKey, privateKey) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({ publicKeyPem: publicKey, privateKeyPem: privateKey });
      }
    );
  });
}

function normalizeTxtMatch(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

function arrayToStatusMessage(values: string[]): string {
  if (values.length === 0) {
    return 'No records detected';
  }
  return values.join(', ');
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminFromToken(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const primaryDomain = getPrimaryDomain();
    if (!primaryDomain) {
      return NextResponse.json({ error: 'Primary domain is not configured in environment variables' }, { status: 500 });
    }

    const mailHost = getMailHost(primaryDomain);
    const mailHostLabel = mailHost.endsWith(`.${primaryDomain}`)
      ? mailHost.slice(0, mailHost.length - primaryDomain.length - 1)
      : mailHost;

  const [aLookup, mxLookup, spfLookup, dmarcLookup, autodiscoverLookup, autoconfigLookup, webmailLookup, imapLookup, smtpLookup, pop3Lookup, dkimEntry] = await Promise.all([
      safeResolveA(mailHost),
      safeResolveMx(primaryDomain),
      safeResolveTxt(primaryDomain),
      safeResolveTxt(`_dmarc.${primaryDomain}`),
      safeResolveCname(`autodiscover.${primaryDomain}`),
      safeResolveCname(`autoconfig.${primaryDomain}`),
      safeResolveCname(`webmail.${primaryDomain}`),
      safeResolveCname(`imap.${primaryDomain}`),
      safeResolveCname(`smtp.${primaryDomain}`),
      safeResolveCname(`pop3.${primaryDomain}`),
      getDkimEntry(primaryDomain),
    ]);

    const records: ServerDnsRecord[] = [];

    records.push({
      key: 'mail-a',
      type: 'A',
      name: mailHostLabel || '@',
      host: mailHost,
      expectedValue: 'Points to NubMail server public IPv4 address',
      status: aLookup.values.length > 0 ? 'configured' : 'missing',
      observedValues: aLookup.values,
      message: aLookup.values.length > 0 ? 'A record resolves for mail host' : 'Create an A record pointing to your server IP address',
    });

    const mxExpectedPriority = 10;
    const hasExpectedMx = mxLookup.values.some((mx) => equalsHostname(mx.exchange, mailHost) && mx.priority === mxExpectedPriority);
    const mxObserved = mxLookup.values.map((mx) => `${mx.priority} ${mx.exchange}`);
    let mxStatus: RecordStatus = 'missing';
    let mxMessage = 'No MX records detected for the primary domain';
    if (mxLookup.values.length > 0) {
      if (hasExpectedMx) {
        mxStatus = 'configured';
        mxMessage = 'MX record points to the NubMail server';
      } else {
        mxStatus = 'mismatch';
        mxMessage = 'MX records exist but do not point to the NubMail server host';
      }
    }
    records.push({
      key: 'domain-mx',
      type: 'MX',
      name: '@',
      host: primaryDomain,
      expectedValue: `${mxExpectedPriority} ${ensureTrailingDot(mailHost)}`,
      priority: mxExpectedPriority,
      status: mxStatus,
      observedValues: mxObserved,
      message: mxMessage,
    });

    const domain = process.env.DOMAIN;
    const baseDomain = domain ? domain.split(':')[0] : primaryDomain;

    // Prefer explicit IP authorization to reduce SPF DNS lookups
    const mailIps = aLookup.values; // IPv4 addresses for mail host
    const primaryIp = mailIps[0];
    const spfExpected = primaryIp
      ? `v=spf1 ip4:${primaryIp} ~all`
      : `v=spf1 a:${mailHost} ~all`;

    const spfStatus = spfLookup.values.some((txt) => {
      const n = normalizeTxtMatch(txt);
      if (!n.startsWith('v=spf1')) return false;
      // Match any of the resolved IPs if present
      const ipMatch = mailIps.some((ip) => n.includes(`ip4:${ip}`));
      if (ipMatch) return true;
      // Fallback accept a:mailHost if we couldn't determine IP at runtime
      const aHost = `a:${normalizeDomain(mailHost)}`;
      if (!primaryIp && n.includes(aHost)) return true;
      return false;
    })
      ? 'configured'
      : spfLookup.values.length === 0
        ? 'missing'
        : 'mismatch';
    records.push({
      key: 'domain-spf',
      type: 'TXT',
      name: '@',
      host: primaryDomain,
      expectedValue: spfExpected,
      status: spfStatus,
      observedValues: spfLookup.values,
      message:
        spfStatus === 'configured'
          ? 'SPF record authorizes email sending from this domain'
          : spfStatus === 'missing'
            ? `Add SPF TXT record to authorize ${baseDomain} for email sending`
            : `Update SPF record to authorize ${baseDomain} for email sending`,
    });

    const dmarcExpected = `v=DMARC1; p=quarantine; rua=mailto:dmarc@${primaryDomain}`;
    const dmarcStatus = dmarcLookup.values.some((txt) => {
      const normalized = normalizeTxtMatch(txt);
      return normalized.includes('v=dmarc1') && normalized.includes('p=quarantine') && normalized.includes(`rua=mailto:dmarc@${primaryDomain}`);
    })
      ? 'configured'
      : dmarcLookup.values.length === 0
        ? 'missing'
        : 'mismatch';
    records.push({
      key: 'domain-dmarc',
      type: 'TXT',
      name: '_dmarc',
      host: `_dmarc.${primaryDomain}`,
      expectedValue: dmarcExpected,
      status: dmarcStatus,
      observedValues: dmarcLookup.values,
      message:
        dmarcStatus === 'configured'
          ? 'DMARC policy is published'
          : dmarcStatus === 'missing'
            ? 'Add DMARC TXT record for reporting and enforcement'
            : 'Update DMARC record to match recommended policy',
    });

    const cnameRecords: Array<{ key: string; label: string; lookup: { values: string[] }; optional?: boolean }> = [
      { key: 'autodiscover', label: 'autodiscover', lookup: autodiscoverLookup },
      { key: 'autoconfig', label: 'autoconfig', lookup: autoconfigLookup },
      { key: 'webmail', label: 'webmail', lookup: webmailLookup, optional: true },
      { key: 'imap', label: 'imap', lookup: imapLookup },
      { key: 'smtp', label: 'smtp', lookup: smtpLookup },
      { key: 'pop3', label: 'pop3', lookup: pop3Lookup, optional: true },
    ];

    cnameRecords.forEach(({ key, label, lookup, optional }) => {
      const status = lookup.values.some((value) => equalsHostname(value, mailHost))
        ? 'configured'
        : lookup.values.length === 0
          ? 'missing'
          : 'mismatch';
      records.push({
        key: `cname-${key}`,
        type: 'CNAME',
        name: label,
        host: `${label}.${primaryDomain}`,
        expectedValue: ensureTrailingDot(mailHost),
        status,
        observedValues: lookup.values,
        message:
          status === 'configured'
            ? 'CNAME record points to the NubMail server'
            : status === 'missing'
              ? 'Add CNAME record pointing to the NubMail server host'
              : 'Update CNAME record to point to the NubMail server host',
        optional,
      });
    });

    // If no DKIM entry exists, generate one automatically with default selector 'mail'
    let ensuredDkim = dkimEntry;
    if (!ensuredDkim) {
      const selector = 'mail';
      await ensureDkimTable();
      const { publicKeyPem, privateKeyPem } = await generateKeyPair();
      const normalizedDomain = normalizeDomain(primaryDomain);
      await pgQuery(
        `INSERT INTO domain_dkim(domain_name, selector, public_key, private_key)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (domain_name)
         DO UPDATE SET selector = EXCLUDED.selector, public_key = EXCLUDED.public_key, private_key = EXCLUDED.private_key, created_at = NOW()`,
        [normalizedDomain, selector, publicKeyPem, privateKeyPem]
      );
      ensuredDkim = { selector, publicKey: publicKeyPem };
    }

    if (ensuredDkim) {
      const selector = sanitizeSelector(ensuredDkim.selector);
      const expectedDkimValue = `v=DKIM1; k=rsa; p=${exportPublicKeyPemToDns(ensuredDkim.publicKey)}`;
      const dkimHost = `${selector}._domainkey.${primaryDomain}`;
      const dkimLookup = await safeResolveTxt(dkimHost);
      const dkimConfigured = dkimLookup.values.some((txt) => normalizeTxtMatch(txt).includes(normalizeTxtMatch(expectedDkimValue)));
      records.push({
        key: 'dkim',
        type: 'TXT',
        name: `${selector}._domainkey`,
        host: dkimHost,
        expectedValue: expectedDkimValue,
        status: dkimConfigured ? 'configured' : 'missing',
        observedValues: dkimLookup.values,
        message: dkimConfigured
          ? 'DKIM record published'
          : 'Publish DKIM TXT record for outbound signing',
        canAutoGenerate: false,
        selector,
      });
    }

    return NextResponse.json({
      primaryDomain,
      mailHost,
      mailHostLabel: mailHostLabel || '@',
      lastChecked: new Date().toISOString(),
      records,
    });
  } catch (err: any) {
    console.error('Admin server DNS GET error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DKIM generation is automatic in GET handler; POST route removed.
