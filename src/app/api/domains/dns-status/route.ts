import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromToken, getUserFromToken } from '@/lib/admin';
import dns from 'dns/promises';
import { pgQuery } from '@/lib/postgres';

interface DomainDnsRecord {
  key: string;
  type: 'TXT' | 'MX' | 'CNAME';
  name: string;
  host: string;
  expectedValue: string;
  priority?: number;
  status: 'verified' | 'failed' | 'not_checked';
  observedValues: string[];
  message: string;
  optional?: boolean;
  canAutoGenerate?: boolean;
}

function normalizeDomain(input: string): string {
  return input.toLowerCase().trim().replace(/\.$/, '');
}

function getMailHost(domain?: string): string {
  const hostCandidate = process.env.HOST?.trim();
  if (hostCandidate) {
    return normalizeDomain(hostCandidate);
  }

  const virtualHost = process.env.VIRTUAL_HOST?.trim();
  if (virtualHost) {
    return normalizeDomain(virtualHost);
  }

  const baseDomain = process.env.DOMAIN?.trim() || domain;
  if (baseDomain) {
    const normalizedBase = normalizeDomain(baseDomain);
    if (!normalizedBase) {
      throw new Error('Invalid domain configuration');
    }

    if (normalizedBase.startsWith('mail.') || normalizedBase.startsWith('mails.')) {
      return normalizedBase;
    }

    return `mails.${normalizedBase}`;
  }

  throw new Error('DOMAIN or HOST environment variable must be configured');
}

function exportPublicKeyPemToDns(pubKeyPem: string): string {
  return pubKeyPem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\r?\n/g, '')
    .trim();
}

async function safeResolveTxt(host: string): Promise<{ values: string[]; error?: string }> {
  try {
    const result = await Promise.race([
      dns.resolveTxt(host),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS lookup timeout')), 10000)),
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
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS lookup timeout')), 10000)),
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
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS lookup timeout')), 10000)),
    ]);
    return { values: result.map((r) => normalizeDomain(r)) };
  } catch (err: any) {
    if (err?.code === 'ENODATA' || err?.code === 'ENOTFOUND' || err?.code === 'ESERVFAIL') {
      return { values: [] };
    }
    return { values: [], error: err?.message || 'DNS lookup failed' };
  }
}

function equalsHostname(a: string, b: string): boolean {
  return normalizeDomain(a).replace(/\.$/, '') === normalizeDomain(b).replace(/\.$/, '');
}

function normalizeTxtMatch(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminFromToken(req);
    const payload = admin ?? await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actorUserId = 'sub' in payload ? payload.sub : payload.id;

    const { searchParams } = new URL(req.url);
    const domainId = searchParams.get('domainId');
    
    if (!domainId) {
      return NextResponse.json({ error: 'Domain ID required' }, { status: 400 });
    }

    const { rows } = await pgQuery<{
      domainName: string;
      verificationToken: string | null;
      verificationStatus: string;
      userId: string;
      userEmail: string | null;
      userFullName: string | null;
    }>(
      `SELECT d.domain_name AS "domainName",
              d.verification_token AS "verificationToken",
              d.verification_status AS "verificationStatus",
              d.user_id AS "userId",
              u.email AS "userEmail",
              u.full_name AS "userFullName"
       FROM domains d
       LEFT JOIN users u ON d.user_id = u.id
       WHERE d.id = $1${admin ? '' : ' AND d.user_id = $2'}`,
      admin ? [domainId] : [domainId, actorUserId]
    );
    
    const domain = rows[0];
    if (!domain) return NextResponse.json({ error: 'Domain not found' }, { status: 404 });

    const normalizedDomain = normalizeDomain(domain.domainName);
    const mailHost = getMailHost(normalizedDomain);

    // Fetch DKIM info for this domain
    const { rows: dkimRows } = await pgQuery<{ selector: string; public_key: string }>(
      `SELECT selector, public_key FROM domain_dkim WHERE domain_name = $1`,
      [normalizedDomain]
    );

    // Perform DNS lookups in parallel
    const [verificationTxtLookup, mxLookup, spfLookup, dmarcLookup, autodiscoverLookup, autoconfigLookup, webmailLookup, imapLookup, smtpLookup, pop3Lookup] = await Promise.all([
      safeResolveTxt(normalizedDomain),
      safeResolveMx(normalizedDomain),
      safeResolveTxt(normalizedDomain),
      safeResolveTxt(`_dmarc.${normalizedDomain}`),
      safeResolveCname(`autodiscover.${normalizedDomain}`),
      safeResolveCname(`autoconfig.${normalizedDomain}`),
      safeResolveCname(`webmail.${normalizedDomain}`),
      safeResolveCname(`imap.${normalizedDomain}`),
      safeResolveCname(`smtp.${normalizedDomain}`),
      safeResolveCname(`pop3.${normalizedDomain}`),
    ]);

    const records: DomainDnsRecord[] = [];

    // Verification TXT record
    const verificationExpected = `nubmail-verification=${domain.verificationToken}`;
    const hasVerificationTxt = verificationTxtLookup.values.some((txt) => txt.includes(verificationExpected));
    records.push({
      key: 'verification',
      type: 'TXT',
      name: '@',
      host: normalizedDomain,
      expectedValue: verificationExpected,
      status: hasVerificationTxt ? 'verified' : 'not_checked',
      observedValues: verificationTxtLookup.values,
      message: hasVerificationTxt ? 'Domain verification record found' : 'Add verification TXT record to verify domain ownership',
    });

    // MX record
    const mxExpectedPriority = 10;
    const hasExpectedMx = mxLookup.values.some((mx) => equalsHostname(mx.exchange, mailHost) && mx.priority === mxExpectedPriority);
    const mxObserved = mxLookup.values.map((mx) => `${mx.priority} ${mx.exchange}`);
    records.push({
      key: 'mx1',
      type: 'MX',
      name: '@',
      host: normalizedDomain,
      expectedValue: `${mxExpectedPriority} ${mailHost}`,
      priority: mxExpectedPriority,
      status: hasExpectedMx ? 'verified' : 'not_checked',
      observedValues: mxObserved,
      message: hasExpectedMx ? 'MX record points to NubMail server' : 'Add MX record to enable email delivery',
    });

    // SPF record
    const spfExpected = `v=spf1 include:${mailHost} -all`;
    const hasSPF = spfLookup.values.some((txt) => {
      const normalized = normalizeTxtMatch(txt);
      return normalized.startsWith('v=spf1') && normalized.includes(`include:${normalizeDomain(mailHost)}`);
    });
    records.push({
      key: 'spf',
      type: 'TXT',
      name: '@',
      host: normalizedDomain,
      expectedValue: spfExpected,
      status: hasSPF ? 'verified' : 'not_checked',
      observedValues: spfLookup.values.filter(txt => txt.toLowerCase().includes('spf')),
      message: hasSPF ? 'SPF record authorizes NubMail to send emails' : 'Add SPF TXT record to authorize email sending',
    });

    // DMARC record
    const dmarcExpected = `v=DMARC1; p=quarantine; rua=mailto:dmarc@${normalizedDomain}`;
    const hasDMARC = dmarcLookup.values.some((txt) => {
      const normalized = normalizeTxtMatch(txt);
      return normalized.includes('v=dmarc1');
    });
    records.push({
      key: 'dmarc',
      type: 'TXT',
      name: '_dmarc',
      host: `_dmarc.${normalizedDomain}`,
      expectedValue: dmarcExpected,
      status: hasDMARC ? 'verified' : 'not_checked',
      observedValues: dmarcLookup.values,
      message: hasDMARC ? 'DMARC policy is published' : 'Add DMARC TXT record for email authentication',
    });

  // DKIM record (auto-generate if missing)
  if (dkimRows.length > 0) {
      const selector = dkimRows[0].selector;
      const p = exportPublicKeyPemToDns(dkimRows[0].public_key);
      const dkimHost = `${selector}._domainkey.${normalizedDomain}`;
      const dkimLookup = await safeResolveTxt(dkimHost);
      const dkimExpected = `v=DKIM1; k=rsa; p=${p}`;
      const hasDKIM = dkimLookup.values.some((txt) => txt.includes(`p=${p}`));
      
      records.push({
        key: 'dkim',
        type: 'TXT',
        name: `${selector}._domainkey`,
        host: dkimHost,
        expectedValue: dkimExpected,
        status: hasDKIM ? 'verified' : 'not_checked',
        observedValues: dkimLookup.values,
        message: hasDKIM ? 'DKIM signature is configured' : 'Add DKIM TXT record for email signing',
      });
    } else {
      // Auto-generate DKIM for this domain
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
      const { generateKeyPair } = await import('crypto');
      const keyPair = await new Promise<{ publicKeyPem: string; privateKeyPem: string }>((resolve, reject) => {
        generateKeyPair('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } }, (err, pub, priv) => {
          if (err) return reject(err);
          resolve({ publicKeyPem: pub, privateKeyPem: priv });
        });
      });
      const selector = 'mail';
      await pgQuery(
        `INSERT INTO domain_dkim(domain_name, selector, public_key, private_key)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (domain_name)
         DO UPDATE SET selector = EXCLUDED.selector, public_key = EXCLUDED.public_key, private_key = EXCLUDED.private_key, created_at = NOW()`,
        [normalizedDomain, selector, keyPair.publicKeyPem, keyPair.privateKeyPem]
      );
      const p = exportPublicKeyPemToDns(keyPair.publicKeyPem);
      const dkimHost = `${selector}._domainkey.${normalizedDomain}`;
      const dkimLookup = await safeResolveTxt(dkimHost);
      const dkimExpected = `v=DKIM1; k=rsa; p=${p}`;
      const hasDKIM = dkimLookup.values.some((txt) => txt.includes(`p=${p}`));
      records.push({
        key: 'dkim',
        type: 'TXT',
        name: `${selector}._domainkey`,
        host: dkimHost,
        expectedValue: dkimExpected,
        status: hasDKIM ? 'verified' : 'not_checked',
        observedValues: dkimLookup.values,
        message: hasDKIM ? 'DKIM signature is configured' : 'Add DKIM TXT record for email signing',
      });
    }

    // CNAME records
    const cnameRecords = [
      { key: 'autodiscover', label: 'autodiscover', lookup: autodiscoverLookup },
      { key: 'autoconfig', label: 'autoconfig', lookup: autoconfigLookup },
      { key: 'webmail', label: 'webmail', lookup: webmailLookup, optional: true },
      { key: 'imap', label: 'imap', lookup: imapLookup },
      { key: 'smtp', label: 'smtp', lookup: smtpLookup },
      { key: 'pop3', label: 'pop3', lookup: pop3Lookup, optional: true },
    ];

    cnameRecords.forEach(({ key, label, lookup, optional }) => {
      const hasCNAME = lookup.values.some((value) => equalsHostname(value, mailHost));
      records.push({
        key: `cname-${key}`,
        type: 'CNAME',
        name: label,
        host: `${label}.${normalizedDomain}`,
        expectedValue: mailHost,
        status: hasCNAME ? 'verified' : 'not_checked',
        observedValues: lookup.values,
        message: hasCNAME 
          ? `${label.charAt(0).toUpperCase() + label.slice(1)} CNAME is configured` 
          : optional 
            ? `Optional: Add ${label} CNAME for better client compatibility`
            : `Add ${label} CNAME record`,
        optional,
      });
    });

    return NextResponse.json({
      domainId,
      domainName: normalizedDomain,
      verificationStatus: domain.verificationStatus,
      verificationToken: domain.verificationToken,
      userId: domain.userId,
      userEmail: domain.userEmail,
      userFullName: domain.userFullName,
      lastChecked: new Date().toISOString(),
      records,
    });
  } catch (err) {
    console.error('Domain DNS status error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
