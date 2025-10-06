import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { pgQuery, usePostgres } from '@/lib/postgres';
import { verify } from 'jsonwebtoken';
import { promises as dns } from 'dns';

async function getUserFromToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || null;
  if (!token) return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const payload = verify(token, secret) as any;
    return payload;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (usePostgres()) {
      const { rows } = await pgQuery(
        `SELECT id, domain_name AS "domainName", verification_status AS "verificationStatus",
                verification_token AS "verificationToken", created_at AS "createdAt"
         FROM domains WHERE user_id = $1 ORDER BY created_at DESC`,
        [payload.sub]
      );
      return NextResponse.json({ domains: rows });
    } else {
      const db = await getDb();
      const domains = db.collection('domains');
      const docs = await domains
        .find({ userId: payload.sub }, { projection: { domainName: 1, verificationStatus: 1, verificationToken: 1, createdAt: 1 } })
        .sort({ createdAt: -1 })
        .toArray();
      return NextResponse.json({ 
        domains: docs.map(d => ({ 
          id: String(d._id), 
          domainName: d.domainName, 
          verificationStatus: d.verificationStatus,
          verificationToken: d.verificationToken,
          createdAt: d.createdAt 
        })) 
      });
    }
  } catch (err) {
    console.error('Domains GET error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { domainName } = body;
    if (!domainName) return NextResponse.json({ error: 'domainName required' }, { status: 400 });

    const normalizedDomain = domainName.toLowerCase().trim().replace(/\.$/, '');
    
    const crypto = await import('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const now = new Date();
    if (usePostgres()) {
      const { rows } = await pgQuery(
        `INSERT INTO domains (domain_name, verification_status, verification_token, user_id, created_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, domain_name AS "domainName", verification_status AS "verificationStatus", verification_token AS "verificationToken", created_at AS "createdAt"`,
        [normalizedDomain, 'pending', verificationToken, payload.sub, now]
      );
      return NextResponse.json(rows[0]);
    } else {
      const db = await getDb();
      const domains = db.collection('domains');
      const res = await domains.insertOne({ 
        domainName: normalizedDomain, 
        verificationStatus: 'pending', 
        verificationToken,
        userId: payload.sub, 
        createdAt: now 
      });
  
      return NextResponse.json({ 
        id: String(res.insertedId), 
        domainName: normalizedDomain, 
        verificationStatus: 'pending',
        verificationToken,
        createdAt: now 
      });
    }
  } catch (err) {
    console.error('Domains POST error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const domainId = url.searchParams.get('id');
    if (!domainId) return NextResponse.json({ error: 'Domain ID required' }, { status: 400 });

    if (usePostgres()) {
      const { rowCount } = await pgQuery('DELETE FROM domains WHERE id = $1 AND user_id = $2', [domainId, payload.sub]);
      if (rowCount === 0) {
        return NextResponse.json({ error: 'Domain not found or unauthorized' }, { status: 404 });
      }
      return NextResponse.json({ message: 'Domain deleted successfully' });
    } else {
      const db = await getDb();
      const domains = db.collection('domains');
      const { ObjectId } = await import('mongodb');
      
      const result = await domains.deleteOne({ 
        _id: new ObjectId(domainId), 
        userId: payload.sub 
      });
  
      if (result.deletedCount === 0) {
        return NextResponse.json({ error: 'Domain not found or unauthorized' }, { status: 404 });
      }
  
      return NextResponse.json({ message: 'Domain deleted successfully' });
    }
  } catch (err) {
    console.error('Domain DELETE error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { domainId, action } = body;
    
    if (!domainId) return NextResponse.json({ error: 'Domain ID required' }, { status: 400 });
    if (action !== 'verify') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

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

    if (domain.verificationStatus === 'verified') {
      return NextResponse.json({ 
        id: domainId,
        domainName: domain.domainName,
        verificationStatus: 'verified',
        message: 'Domain is already verified'
      });
    }

    if (!domain.verificationToken) {
      return NextResponse.json({ 
        error: 'Verification token not found',
        message: 'This domain was created before verification tokens were implemented. Please delete and re-add the domain.',
        verificationStatus: 'pending'
      }, { status: 400 });
    }

    const normalizedDomain = domain.domainName.toLowerCase().trim().replace(/\.$/, '');
    const expectedTxtRecord = `nubmail-verification=${domain.verificationToken}`;
    
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
        const recordValue = Array.isArray(record) ? record.join('') : record;
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
      
      await domains.updateOne(
        { _id: new ObjectId(domainId) },
        { $set: { verificationStatus: 'verified', verifiedAt: new Date() } }
      );
      
      console.log('✓ Domain verified successfully');
      return NextResponse.json({ 
        id: domainId, 
        domainName: domain.domainName,
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
