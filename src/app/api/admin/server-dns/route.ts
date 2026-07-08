import { NextRequest, NextResponse } from 'next/server';
import { Resolver } from 'dns/promises';

import { getAdminFromToken } from '@/lib/admin';
import { pgQuery } from '@/lib/postgres';

type RecordStatus = 'configured' | 'missing' | 'mismatch' | 'action_required' | 'check_failed';

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

const DNS_TIMEOUT_MS = 5000;
const DNS_RETRIES = 2;

// Use an explicit resolver with reliable, redundant upstream servers rather than
// relying on the host's /etc/resolv.conf, which on some deployments points at a
// single flaky/rate-limited server (e.g. 8.8.8.8) whose timeouts were being
// misreported as "record missing".
function createResolver(): Resolver {
  const resolver = new Resolver({ timeout: DNS_TIMEOUT_MS, tries: 1 });
  resolver.setServers(['1.1.1.1', '8.8.8.8', '9.9.9.9', '8.8.4.4']);
  return resolver;
}

const resolver = createResolver();

// A transient failure (timeout / SERVFAIL) is fundamentally different from an
// authoritative "no such record" answer. We retry a couple of times and, if it
// still fails, propagate `error` so callers can render "check failed" instead of
// falsely reporting the record as missing.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt <= DNS_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      // ENODATA / ENOTFOUND are authoritative "no record" answers — don't retry.
      if (err?.code === 'ENODATA' || err?.code === 'ENOTFOUND') {
        throw err;
      }
      lastErr = err;
    }
  }
  throw lastErr;
}

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
      throw new Error('Invalid domain configuration');
    }

    if (normalizedBase.startsWith('mail.') || normalizedBase.startsWith('mails.')) {
      return normalizedBase;
    }

    return normalizeDomain(`mails.${normalizedBase}`);
  }

  throw new Error('DOMAIN or HOST environment variable must be configured');
}

async function safeResolveTxt(host: string): Promise<{ values: string[]; error?: string }> {
  try {
    const result = await withRetry(() => resolver.resolveTxt(host));
    const flattened = result.map((entry) => (Array.isArray(entry) ? entry.join('') : String(entry)));
    return { values: flattened };
  } catch (err: any) {
    if (err?.code === 'ENODATA' || err?.code === 'ENOTFOUND') {
      return { values: [] };
    }
    return { values: [], error: err?.message || 'DNS lookup failed' };
  }
}

async function safeResolveMx(host: string): Promise<{ values: { exchange: string; priority: number }[]; error?: string }> {
  try {
    const result = await withRetry(() => resolver.resolveMx(host));
    return { values: result.map((r) => ({ exchange: normalizeDomain(r.exchange), priority: r.priority })) };
  } catch (err: any) {
    if (err?.code === 'ENODATA' || err?.code === 'ENOTFOUND') {
      return { values: [] };
    }
    return { values: [], error: err?.message || 'DNS lookup failed' };
  }
}

async function safeResolveCname(host: string): Promise<{ values: string[]; error?: string }> {
  try {
    const result = await withRetry(() => resolver.resolveCname(host));
    return { values: result.map((r) => normalizeDomain(r)) };
  } catch (err: any) {
    if (err?.code === 'ENODATA' || err?.code === 'ENOTFOUND') {
      return { values: [] };
    }
    return { values: [], error: err?.message || 'DNS lookup failed' };
  }
}

async function safeResolveA(host: string): Promise<{ values: string[]; error?: string }> {
  try {
    const result = await withRetry(() => resolver.resolve4(host));
    return { values: result };
  } catch (err: any) {
    if (err?.code === 'ENODATA' || err?.code === 'ENOTFOUND') {
      return { values: [] };
    }
    return { values: [], error: err?.message || 'DNS lookup failed' };
  }
}

async function ensureDkimTable(): Promise<void> {
  /* schema-managed: domain_dkim */
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

    const [aLookup, mxLookup, spfLookup, dmarcLookup, autodiscoverLookup, autoconfigLookup, webmailLookup, imapLookup, smtpLookup, pop3Lookup] = await Promise.all([
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
    ]);

    const records: ServerDnsRecord[] = [];

    records.push({
      key: 'mail-a',
      type: 'A',
      name: mailHostLabel || '@',
      host: mailHost,
      expectedValue: 'Points to NubMail server public IPv4 address',
      status: aLookup.error ? 'check_failed' : aLookup.values.length > 0 ? 'configured' : 'missing',
      observedValues: aLookup.values,
      message: aLookup.error
        ? `DNS lookup failed (${aLookup.error}) — status unknown, try Refresh`
        : aLookup.values.length > 0
          ? 'A record resolves for mail host'
          : 'Create an A record pointing to your server IP address',
    });

    const mxExpectedPriority = 10;
    const hasExpectedMx = mxLookup.values.some((mx) => equalsHostname(mx.exchange, mailHost) && mx.priority === mxExpectedPriority);
    const mxObserved = mxLookup.values.map((mx) => `${mx.priority} ${mx.exchange}`);
    let mxStatus: RecordStatus = 'missing';
    let mxMessage = 'No MX records detected for the primary domain';
    if (mxLookup.error) {
      mxStatus = 'check_failed';
      mxMessage = `DNS lookup failed (${mxLookup.error}) — status unknown, try Refresh`;
    } else if (mxLookup.values.length > 0) {
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
      expectedValue: ensureTrailingDot(mailHost),
      priority: mxExpectedPriority,
      status: mxStatus,
      observedValues: mxObserved,
      message: mxMessage,
    });

    const domain = process.env.DOMAIN;
    const baseDomain = domain ? domain.split(':')[0] : primaryDomain;
    
    // Use the main domain for SPF, not the mail subdomain
    const spfExpected = `v=spf1 a mx -all`;
    const spfStatus: RecordStatus = spfLookup.error
      ? 'check_failed'
      : spfLookup.values.some((txt) => {
      const normalized = txt.toLowerCase().trim().replace(/\s+/g, ' ');
      const tokens = normalized.split(' ').filter(Boolean);
      if (tokens[0] !== 'v=spf1') {
        return false;
      }

      const hasA = tokens.includes('a');
      const hasMx = tokens.includes('mx');
      const hasHardFail = tokens.includes('-all');
      const hasSoftFail = tokens.includes('~all');

      return hasA && hasMx && hasHardFail && !hasSoftFail;
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
        spfStatus === 'check_failed'
          ? `DNS lookup failed (${spfLookup.error}) — status unknown, try Refresh`
          : spfStatus === 'configured'
            ? 'SPF record authorizes email sending from this domain'
            : spfStatus === 'missing'
              ? `Add SPF TXT record to authorize ${baseDomain} for email sending`
              : `Update SPF record to authorize ${baseDomain} for email sending`,
    });

    const dmarcExpected = `v=DMARC1; p=quarantine; rua=mailto:dmarc@${primaryDomain}`;
    const dmarcStatus: RecordStatus = dmarcLookup.error
      ? 'check_failed'
      : dmarcLookup.values.some((txt) => {
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
        dmarcStatus === 'check_failed'
          ? `DNS lookup failed (${dmarcLookup.error}) — status unknown, try Refresh`
          : dmarcStatus === 'configured'
            ? 'DMARC policy is published'
            : dmarcStatus === 'missing'
              ? 'Add DMARC TXT record for reporting and enforcement'
              : 'Update DMARC record to match recommended policy',
    });

    const cnameRecords: Array<{ key: string; label: string; lookup: { values: string[]; error?: string }; optional?: boolean }> = [
      { key: 'autodiscover', label: 'autodiscover', lookup: autodiscoverLookup },
      { key: 'autoconfig', label: 'autoconfig', lookup: autoconfigLookup },
      { key: 'webmail', label: 'webmail', lookup: webmailLookup, optional: true },
      { key: 'imap', label: 'imap', lookup: imapLookup },
      { key: 'smtp', label: 'smtp', lookup: smtpLookup },
      { key: 'pop3', label: 'pop3', lookup: pop3Lookup },
    ];

    cnameRecords.forEach(({ key, label, lookup, optional }) => {
      const status: RecordStatus = lookup.error
        ? 'check_failed'
        : lookup.values.some((value) => equalsHostname(value, mailHost))
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
          status === 'check_failed'
            ? `DNS lookup failed (${lookup.error}) — status unknown, try Refresh`
            : status === 'configured'
              ? 'CNAME record points to the NubMail server'
              : status === 'missing'
                ? 'Add CNAME record pointing to the NubMail server host'
                : 'Update CNAME record to point to the NubMail server host',
        optional,
      });
    });

    let ensuredDkim: { selector: string; publicKey: string } | null = null;
    let dkimProvisioningError: string | null = null;

    try {
      ensuredDkim = await getDkimEntry(primaryDomain);
    } catch (err: any) {
      dkimProvisioningError = err?.message || 'Failed to access DKIM settings';
    }

    // If no DKIM entry exists, generate one automatically with default selector 'mail'.
    if (!ensuredDkim && !dkimProvisioningError) {
      try {
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
      } catch (err: any) {
        dkimProvisioningError = err?.message || 'Failed to generate DKIM key';
      }
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
        status: dkimLookup.error ? 'check_failed' : dkimConfigured ? 'configured' : 'missing',
        observedValues: dkimLookup.values,
        message: dkimLookup.error
          ? `DNS lookup failed (${dkimLookup.error}) — status unknown, try Refresh`
          : dkimConfigured
          ? 'DKIM record published'
          : 'Publish DKIM TXT record for outbound signing',
        canAutoGenerate: false,
        selector,
      });
    } else {
      records.push({
        key: 'dkim',
        type: 'TXT',
        name: 'mail._domainkey',
        host: `mail._domainkey.${primaryDomain}`,
        expectedValue: 'v=DKIM1; k=rsa; p=<public-key>',
        status: 'action_required',
        observedValues: [],
        message: dkimProvisioningError
          ? `DKIM provisioning issue: ${dkimProvisioningError}`
          : 'DKIM key is not provisioned yet',
        canAutoGenerate: false,
        selector: 'mail',
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
