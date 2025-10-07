import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/admin';
import dns from 'dns/promises';
import { pgQuery } from '@/lib/postgres';

interface RecordVerificationResult {
  key: string;
  type: string;
  status: 'verified' | 'failed' | 'not_checked';
  message?: string;
}

function getMailHost(): string {
  return (process.env.DOMAIN || process.env.VIRTUAL_HOST || '').trim() || 'mails.nub-coder.tech';
}

function normalizeTxtMatch(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

function normalizeDomain(input: string): string {
  return input.toLowerCase().trim().replace(/\.$/, '');
}

function exportPublicKeyPemToDns(pubKeyPem: string): string {
  return pubKeyPem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\r?\n/g, '')
    .trim();
}

async function verifyDnsRecord(
  domain: string,
  recordType: string,
  recordName: string,
  expectedValue: string,
  priority?: number
): Promise<{ verified: boolean; message: string }> {
  const fullDomain = recordName === '@' ? domain : `${recordName}.${domain}`;
  try {
    switch (recordType) {
      case 'TXT': {
        const txtRecords = await Promise.race([
          dns.resolveTxt(fullDomain),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS lookup timeout')), 10000)),
        ]);
        
        // Check if this is an SPF record (needs special normalized matching)
        const isSPFRecord = expectedValue.toLowerCase().startsWith('v=spf1');
        
        for (const record of txtRecords) {
          const recordValue = Array.isArray(record) ? record.join('') : record;
          
          if (isSPFRecord) {
            // For SPF records, use normalized matching (remove whitespace, case-insensitive)
            const normalizedRecord = normalizeTxtMatch(recordValue);
            const normalizedExpected = normalizeTxtMatch(expectedValue);
            
            // Extract the mail host from the expected value (e.g., "v=spf1 include:mails.nub-coder.tech ~all")
            const includeMatch = normalizedExpected.match(/include:([^\s~]+)/);
            if (includeMatch) {
              const expectedHost = includeMatch[1];
              // Check if the record is SPF and includes the expected mail host
              if (normalizedRecord.startsWith('v=spf1') && normalizedRecord.includes(`include:${expectedHost}`)) {
                return { verified: true, message: 'SPF record found and verified' };
              }
            } else {
              // Fallback: check if normalized values match
              if (normalizedRecord === normalizedExpected || normalizedRecord.includes(normalizedExpected)) {
                return { verified: true, message: 'SPF record found and verified' };
              }
            }
          } else {
            // For other TXT records (verification, DMARC, DKIM), use standard matching
            if (recordValue.includes(expectedValue) || expectedValue.includes(recordValue)) {
              return { verified: true, message: 'TXT record found and verified' };
            }
          }
        }
        return { verified: false, message: 'TXT record not found or does not match' };
      }
      case 'MX': {
        const mxRecords = await Promise.race([
          dns.resolveMx(domain),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS lookup timeout')), 10000)),
        ]);
        for (const record of mxRecords) {
          if (
            record.exchange.toLowerCase().includes(expectedValue.toLowerCase()) ||
            expectedValue.toLowerCase().includes(record.exchange.toLowerCase())
          ) {
            if (priority !== undefined && record.priority === priority) {
              return { verified: true, message: `MX record found with correct priority (${priority})` };
            } else if (priority === undefined) {
              return { verified: true, message: 'MX record found' };
            }
          }
        }
        return { verified: false, message: 'MX record not found or priority does not match' };
      }
      case 'CNAME': {
        try {
          const cnameRecords = await Promise.race([
            dns.resolveCname(fullDomain),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS lookup timeout')), 10000)),
          ]);
          for (const record of cnameRecords) {
            if (
              record.toLowerCase().includes(expectedValue.toLowerCase()) ||
              expectedValue.toLowerCase().includes(record.toLowerCase())
            ) {
              return { verified: true, message: 'CNAME record found and verified' };
            }
          }
          return { verified: false, message: 'CNAME record not found or does not match' };
        } catch (err: any) {
          if (err.code === 'ENODATA') {
            return { verified: false, message: 'CNAME record not found' };
          }
          throw err;
        }
      }
      default:
        return { verified: false, message: 'Unsupported record type' };
    }
  } catch (error: any) {
    if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
      return { verified: false, message: `No ${recordType} records found for ${fullDomain}` };
    } else if (error.message === 'DNS lookup timeout') {
      return { verified: false, message: 'DNS lookup timed out' };
    }
    return { verified: false, message: `DNS error: ${error.message || 'Unknown error'}` };
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { domainId } = body;
    if (!domainId) return NextResponse.json({ error: 'Domain ID required' }, { status: 400 });

    const { rows } = await pgQuery<{ domainName: string; verificationToken: string | null }>(
      `SELECT domain_name AS "domainName", verification_token AS "verificationToken"
       FROM domains WHERE id = $1 AND user_id = $2`,
      [domainId, payload.sub]
    );
    const domain = rows[0];
    if (!domain) return NextResponse.json({ error: 'Domain not found' }, { status: 404 });

    const normalizedDomain = domain.domainName.toLowerCase().trim().replace(/\.$/, '');
    const mailHost = getMailHost();

    // Try to fetch DKIM info for this domain
    const { rows: dkimRows } = await pgQuery<{ selector: string; public_key: string }>(
      `SELECT selector, public_key FROM domain_dkim WHERE domain_name = $1`,
      [normalizedDomain]
    );

    const recordsToVerify: Array<{
      key: string;
      type: 'TXT' | 'MX' | 'CNAME';
      name: string;
      value: string;
      priority?: number;
    }> = [
      {
        key: 'verification',
        type: 'TXT',
        name: '@',
        value: `nubmail-verification=${domain.verificationToken}`,
      },
      { key: 'mx1', type: 'MX', name: '@', value: mailHost, priority: 10 },
      { key: 'spf', type: 'TXT', name: '@', value: `v=spf1 include:${mailHost} ~all` },
      { key: 'dmarc', type: 'TXT', name: '_dmarc', value: 'v=DMARC1' },
      { key: 'autodiscover', type: 'CNAME', name: 'autodiscover', value: mailHost },
      { key: 'autoconfig', type: 'CNAME', name: 'autoconfig', value: mailHost },
      { key: 'webmail', type: 'CNAME', name: 'webmail', value: mailHost },
      { key: 'imap', type: 'CNAME', name: 'imap', value: mailHost },
      { key: 'smtp', type: 'CNAME', name: 'smtp', value: mailHost },
      { key: 'pop3', type: 'CNAME', name: 'pop3', value: mailHost },
    ];

    if (dkimRows.length > 0) {
      const selector = dkimRows[0].selector;
      const p = exportPublicKeyPemToDns(dkimRows[0].public_key);
      recordsToVerify.push({
        key: 'dkim',
        type: 'TXT',
        name: `${selector}._domainkey`,
        value: `p=${p}`,
      });
    }

    const results: RecordVerificationResult[] = [];
    for (const record of recordsToVerify) {
      const result = await verifyDnsRecord(
        normalizedDomain,
        record.type,
        record.name,
        record.value,
        record.priority
      );
      results.push({ key: record.key, type: record.type, status: result.verified ? 'verified' : 'failed', message: result.message });
    }

    const allVerified = results.every((r) => r.status === 'verified');
    if (allVerified) {
      await pgQuery(
        `UPDATE domains SET verification_status = 'verified', verified_at = NOW() WHERE id = $1 AND user_id = $2`,
        [domainId, payload.sub]
      );
    }

    return NextResponse.json({ domainId, domainName: normalizedDomain, records: results, overallStatus: allVerified ? 'verified' : 'partial' });
  } catch (err) {
    console.error('Domain record verification error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
