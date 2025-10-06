import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
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

    const db = await getDb();
    const domains = db.collection('domains');
    const docs = await domains.find({ userId: payload.sub }).sort({ createdAt: -1 }).toArray();
    return NextResponse.json({ domains: docs.map(d => ({ id: String(d._id), domainName: d.domainName, verificationStatus: d.verificationStatus, createdAt: d.createdAt })) });
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

    const db = await getDb();
    const domains = db.collection('domains');
    const now = new Date();
    const res = await domains.insertOne({ domainName, verificationStatus: 'pending', userId: payload.sub, createdAt: now });

    return NextResponse.json({ id: String(res.insertedId), domainName, verificationStatus: 'pending', createdAt: now });
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

    const verificationCode = Buffer.from(domain.domainName).toString('base64').substring(0, 32);
    const expectedTxtRecord = `nubmail-verification=${verificationCode}`;
    
    console.log('=== DNS Verification Debug ===');
    console.log('Domain:', domain.domainName);
    console.log('Expected TXT record:', expectedTxtRecord);
    
    let verificationStatus = 'pending';
    let txtRecordFound = false;
    
    try {
      const txtRecords = await dns.resolveTxt(domain.domainName);
      console.log('DNS lookup succeeded. Found TXT records:', txtRecords);
      
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
      }
      
      if (txtRecordFound) {
        verificationStatus = 'verified';
        await domains.updateOne(
          { _id: new ObjectId(domainId) },
          { $set: { verificationStatus, verifiedAt: new Date() } }
        );
        
        return NextResponse.json({ 
          id: domainId, 
          domainName: domain.domainName,
          verificationStatus,
          message: 'Domain verified successfully' 
        });
      } else {
        return NextResponse.json({ 
          error: 'DNS verification failed',
          message: `TXT record not found. Please add the following TXT record to your DNS: ${expectedTxtRecord}`,
          verificationStatus: 'pending'
        }, { status: 400 });
      }
    } catch (dnsError: any) {
      console.error('DNS verification error:', dnsError);
      return NextResponse.json({ 
        error: 'DNS lookup failed',
        message: `Could not resolve DNS records for ${domain.domainName}. Error: ${dnsError.code || dnsError.message}`,
        verificationStatus: 'pending'
      }, { status: 400 });
    }
  } catch (err) {
    console.error('Domain PATCH error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
