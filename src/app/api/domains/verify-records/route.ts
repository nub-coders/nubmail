import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/admin';
import { getDb } from '@/lib/mongodb';
import dns from 'dns/promises';

interface RecordVerificationResult {
  key: string;
  type: string;
  status: 'verified' | 'failed' | 'not_checked';
  message?: string;
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
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('DNS lookup timeout')), 10000)
          )
        ]);
        
        for (const record of txtRecords) {
          const recordValue = Array.isArray(record) ? record.join('') : record;
          if (recordValue.includes(expectedValue) || expectedValue.includes(recordValue)) {
            return { verified: true, message: 'TXT record found and verified' };
          }
        }
        return { verified: false, message: 'TXT record not found or does not match' };
      }
      
      case 'MX': {
        const mxRecords = await Promise.race([
          dns.resolveMx(domain),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('DNS lookup timeout')), 10000)
          )
        ]);
        
        for (const record of mxRecords) {
          if (record.exchange.toLowerCase().includes(expectedValue.toLowerCase()) ||
              expectedValue.toLowerCase().includes(record.exchange.toLowerCase())) {
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
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('DNS lookup timeout')), 10000)
            )
          ]);
          
          for (const record of cnameRecords) {
            if (record.toLowerCase().includes(expectedValue.toLowerCase()) ||
                expectedValue.toLowerCase().includes(record.toLowerCase())) {
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

    const db = await getDb();
    const domains = db.collection('domains');
    const { ObjectId } = await import('mongodb');
    
    const domain = await domains.findOne({ 
      _id: new ObjectId(domainId), 
      userId: payload.sub 
    });

    if (!domain) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    const normalizedDomain = domain.domainName.toLowerCase().trim().replace(/\.$/, '');
    
    const recordsToVerify = [
      {
        key: 'verification',
        type: 'TXT',
        name: '@',
        value: `nubmail-verification=${domain.verificationToken}`,
      },
      { 
        key: 'mx1',
        type: 'MX', 
        name: '@', 
        value: 'mx1.nubmail-server.com', 
        priority: 10,
      },
      {
        key: 'mx2',
        type: 'MX',
        name: '@',
        value: 'mx2.nubmail-server.com',
        priority: 20,
      },
      {
        key: 'spf',
        type: 'TXT',
        name: '@',
        value: 'v=spf1 include:nubmail-server.com ~all',
      },
      {
        key: 'dmarc',
        type: 'TXT',
        name: '_dmarc',
        value: 'v=DMARC1',
      },
      {
        key: 'dkim',
        type: 'TXT',
        name: 'nubmail._domainkey',
        value: 'v=DKIM1',
      },
      {
        key: 'autodiscover',
        type: 'CNAME',
        name: 'autodiscover',
        value: 'mails.nub-coder.tech',
      },
      {
        key: 'autoconfig',
        type: 'CNAME',
        name: 'autoconfig',
        value: 'mails.nub-coder.tech',
      },
      {
        key: 'webmail',
        type: 'CNAME',
        name: 'webmail',
        value: 'mails.nub-coder.tech',
      },
      {
        key: 'imap',
        type: 'CNAME',
        name: 'imap',
        value: 'mails.nub-coder.tech',
      },
      {
        key: 'smtp',
        type: 'CNAME',
        name: 'smtp',
        value: 'mails.nub-coder.tech',
      },
      {
        key: 'pop3',
        type: 'CNAME',
        name: 'pop3',
        value: 'mails.nub-coder.tech',
      },
    ];

    const results: RecordVerificationResult[] = [];
    
    for (const record of recordsToVerify) {
      const result = await verifyDnsRecord(
        normalizedDomain,
        record.type,
        record.name,
        record.value,
        record.priority
      );
      
      results.push({
        key: record.key,
        type: record.type,
        status: result.verified ? 'verified' : 'failed',
        message: result.message,
      });
    }

    const allVerified = results.every(r => r.status === 'verified');
    const verificationRecord = results.find(r => r.key === 'verification');
    
    if (allVerified || (verificationRecord && verificationRecord.status === 'verified')) {
      await domains.updateOne(
        { _id: new ObjectId(domainId) },
        { $set: { verificationStatus: 'verified', verifiedAt: new Date() } }
      );
    }

    return NextResponse.json({ 
      domainId,
      domainName: normalizedDomain,
      records: results,
      overallStatus: allVerified ? 'verified' : 'partial'
    });

  } catch (err) {
    console.error('Domain record verification error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
