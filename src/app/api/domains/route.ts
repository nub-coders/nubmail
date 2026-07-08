import { NextRequest, NextResponse } from 'next/server';
import { pgQuery } from '@/lib/postgres';
import { canPerformImportantAction, getUserFromToken } from '@/lib/admin';
import { promises as dns } from 'dns';

function normalizeTxtRecord(record: unknown): string | null {
  if (!Array.isArray(record)) return null;
  if (!record.every((part) => typeof part === 'string')) return null;
  return record.join('');
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { rows } = await pgQuery(
      `SELECT id, domain_name AS "domainName", verification_status AS "verificationStatus",
              verification_token AS "verificationToken", created_at AS "createdAt"
       FROM domains WHERE user_id = $1 ORDER BY created_at DESC`,
      [payload.sub]
    );
    return NextResponse.json({ domains: rows });
  } catch (err) {
    console.error('Domains GET error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canPerformImportantAction(payload)) {
      return NextResponse.json({ error: 'Please verify your email to perform this action.' }, { status: 403 });
    }

    const body = await req.json();
    const { domainName } = body;
    if (!domainName) return NextResponse.json({ error: 'domainName required' }, { status: 400 });

    const normalizedDomain = domainName.toLowerCase().trim().replace(/\.$/, '');
    
    const crypto = await import('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const now = new Date();
    const { rows } = await pgQuery(
      `INSERT INTO domains (domain_name, verification_status, verification_token, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, domain_name AS "domainName", verification_status AS "verificationStatus", verification_token AS "verificationToken", created_at AS "createdAt"`,
      [normalizedDomain, 'pending', verificationToken, payload.sub, now]
    );
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('Domains POST error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canPerformImportantAction(payload)) {
      return NextResponse.json({ error: 'Please verify your email to perform this action.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const domainId = url.searchParams.get('id');
    if (!domainId) return NextResponse.json({ error: 'Domain ID required' }, { status: 400 });

    const { rowCount } = await pgQuery('DELETE FROM domains WHERE id = $1 AND user_id = $2', [domainId, payload.sub]);
    if (rowCount === 0) {
      return NextResponse.json({ error: 'Domain not found or unauthorized' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Domain deleted successfully' });
  } catch (err) {
    console.error('Domain DELETE error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canPerformImportantAction(payload)) {
      return NextResponse.json({ error: 'Please verify your email to perform this action.' }, { status: 403 });
    }

    const body = await req.json();
    const { domainId, action } = body;
    
    if (!domainId) return NextResponse.json({ error: 'Domain ID required' }, { status: 400 });
    if (action !== 'verify') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    const { rows } = await pgQuery<{ 
      domain_name: string; 
      verification_status: string; 
      verification_token: string | null;
    }>(
      'SELECT domain_name, verification_status, verification_token FROM domains WHERE id = $1 AND user_id = $2',
      [domainId, payload.sub]
    );
    const domain = rows[0];

    if (!domain) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    if (domain.verification_status === 'verified') {
      return NextResponse.json({ 
        id: domainId,
        domainName: domain.domain_name,
        verificationStatus: 'verified',
        message: 'Domain is already verified'
      });
    }

    if (!domain.verification_token) {
      return NextResponse.json({ 
        error: 'Verification token not found',
        message: 'This domain was created before verification tokens were implemented. Please delete and re-add the domain.',
        verificationStatus: 'pending'
      }, { status: 400 });
    }

    const normalizedDomain = domain.domain_name.toLowerCase().trim().replace(/\.$/, '');
    const expectedTxtRecord = `nubmail-verification=${domain.verification_token}`;
    
    console.log('=== DNS Verification Debug ===');
    console.log('Domain:', normalizedDomain);
    console.log('Expected TXT record:', expectedTxtRecord);
    
    try {
      const txtRecords = await Promise.race([
        dns.resolveTxt(normalizedDomain),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('DNS lookup timeout')), 10000)
        )
      ]);
      
      console.log('DNS lookup succeeded. Found TXT records:', txtRecords);
      
      if (!txtRecords || txtRecords.length === 0) {
        console.log('✗ No TXT records found for domain');
        return NextResponse.json({ 
          error: 'DNS verification failed',
          message: `No TXT records found. Please add this TXT record to your DNS:\n\nType: TXT\nName: @\nValue: ${expectedTxtRecord}`,
          verificationStatus: 'pending'
        }, { status: 400 });
      }
      
      let txtRecordFound = false;
      for (const record of txtRecords) {
        const recordValue = normalizeTxtRecord(record);
        if (!recordValue) continue;
        console.log('Checking record:', recordValue);
        if (recordValue === expectedTxtRecord) {
          txtRecordFound = true;
          console.log('✓ Verification record found!');
          break;
        }
      }
      
      if (!txtRecordFound) {
        console.log('✗ Verification record NOT found in DNS');
        return NextResponse.json({ 
          error: 'DNS verification failed',
          message: `TXT records found, but none match the verification token. Please add this TXT record to your DNS:\n\nType: TXT\nName: @\nValue: ${expectedTxtRecord}`,
          verificationStatus: 'pending'
        }, { status: 400 });
      }
      
      // Prevent two users from ending up with the same verified domain.
      const updateResult = await pgQuery(
        `UPDATE domains
         SET verification_status = $1, verified_at = $2
         WHERE id = $3
           AND user_id = $4
           AND NOT EXISTS (
             SELECT 1
             FROM domains d2
             WHERE d2.id <> $3
               AND LOWER(d2.domain_name) = LOWER($5)
               AND d2.verification_status = 'verified'
           )
         RETURNING id`,
        ['verified', new Date(), domainId, payload.sub, normalizedDomain]
      );

      if (updateResult.rowCount === 0) {
        return NextResponse.json({
          error: 'Domain verification conflict',
          message: 'This domain is already verified by another account.',
          verificationStatus: 'pending'
        }, { status: 409 });
      }
      
      console.log('✓ Domain verified successfully');
      return NextResponse.json({ 
        id: domainId, 
        domainName: domain.domain_name,
        verificationStatus: 'verified',
        message: 'Domain verified successfully' 
      });
      
    } catch (dnsError: any) {
      console.error('DNS verification error:', dnsError);
      
      let errorMessage = 'Could not verify DNS records';
      if (dnsError.code === 'ENOTFOUND' || dnsError.code === 'ENODATA') {
        errorMessage = `Domain "${normalizedDomain}" has no DNS records or does not exist. Please ensure the domain is properly configured with your DNS provider.`;
      } else if (dnsError.message === 'DNS lookup timeout') {
        errorMessage = `DNS lookup timed out for "${normalizedDomain}". Please try again later.`;
      } else if (dnsError.code === 'ETIMEOUT' || dnsError.code === 'ECONNREFUSED') {
        errorMessage = `Could not reach DNS servers for "${normalizedDomain}". Please try again later.`;
      } else {
        errorMessage = `DNS lookup failed: ${dnsError.message || dnsError.code || 'Unknown error'}`;
      }
      
      return NextResponse.json({ 
        error: 'DNS lookup failed',
        message: errorMessage,
        verificationStatus: 'pending'
      }, { status: 400 });
    }
  } catch (err) {
    console.error('Domain PATCH error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
