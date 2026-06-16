import { NextRequest, NextResponse } from 'next/server';
import { canPerformImportantAction, getUserFromToken } from '@/lib/admin';
import { pgQuery } from '@/lib/postgres';

async function ensureTable() {
  // Schema is authoritative (docs/postgres-schema.sql). No runtime DDL.
  return;
}

function normalizeDomain(d: string) {
  return d.toLowerCase().trim().replace(/\.$/, '');
}

async function getDomainByIdForUser(domainId: string, userId: string) {
  const { rows } = await pgQuery<{ domainName: string }>(
    `SELECT domain_name AS "domainName" FROM domains WHERE id = $1 AND user_id = $2`,
    [domainId, userId]
  );
  return rows[0] || null;
}

function exportPublicKeyPemToDns(pubKeyPem: string): string {
  // Remove PEM headers/footers and newlines to get base64 body for DNS
  return pubKeyPem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\r?\n/g, '')
    .trim();
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
        if (err) return reject(err);
        resolve({ publicKeyPem: publicKey, privateKeyPem: privateKey });
      }
    );
  });
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getUserFromToken(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const domainId = url.searchParams.get('domainId');
    if (!domainId) return NextResponse.json({ error: 'domainId required' }, { status: 400 });

    const dom = await getDomainByIdForUser(domainId, payload.sub);
    if (!dom) return NextResponse.json({ error: 'Domain not found' }, { status: 404 });

    await ensureTable();

    const { rows } = await pgQuery<{ selector: string; public_key: string }>(
      `SELECT selector, public_key FROM domain_dkim WHERE domain_name = $1`,
      [normalizeDomain(dom.domainName)]
    );

    if (rows.length === 0) {
      return NextResponse.json({ exists: false });
    }

    const selector = rows[0].selector;
    const publicKey = rows[0].public_key;

    return NextResponse.json({
      exists: true,
      selector,
      recordName: `${selector}._domainkey`,
      recordValue: `v=DKIM1; k=rsa; p=${exportPublicKeyPemToDns(publicKey)}`,
    });
  } catch (err) {
    console.error('DKIM GET error', err);
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
    const { domainId, selector: customSelector, privateKeyPem } = body || {};
    if (!domainId) return NextResponse.json({ error: 'domainId required' }, { status: 400 });

    const dom = await getDomainByIdForUser(domainId, payload.sub);
    if (!dom) return NextResponse.json({ error: 'Domain not found' }, { status: 404 });

    await ensureTable();

    const selector = String(customSelector || 'mail').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'mail';
    const normalizedDomain = normalizeDomain(dom.domainName);

    // If a private key is provided, import-existing flow: verify DNS matches and save it
    if (privateKeyPem) {
      try {
        const crypto = await import('node:crypto');
        // Build public key from provided private key
        const priv = crypto.createPrivateKey({ key: privateKeyPem });
        const pub = crypto.createPublicKey(priv);
        const publicKeyPem = pub.export({ type: 'spki', format: 'pem' }) as unknown as string;

        // Verify that DNS TXT for selector matches the derived public key
        const { promises: dns } = await import('node:dns');
        const host = `${selector}._domainkey.${normalizedDomain}`;
        let txtValues: string[] = [];
        try {
          const records = await dns.resolveTxt(host);
          txtValues = records.map(parts => parts.join(''));
        } catch (e: any) {
          return NextResponse.json({ error: `DKIM TXT not found at ${host}. Please publish it first.` }, { status: 400 });
        }
        const expectedP = exportPublicKeyPemToDns(publicKeyPem);
        const found = txtValues.some(v => v.replace(/\s+/g, '').includes(`p=${expectedP}`));
        if (!found) {
          return NextResponse.json({ error: 'Provided private key does not match the DKIM TXT record in DNS for this selector.' }, { status: 400 });
        }

        // Store in DB
        await pgQuery(
          `INSERT INTO domain_dkim(domain_name, selector, public_key, private_key)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (domain_name)
           DO UPDATE SET selector = EXCLUDED.selector, public_key = EXCLUDED.public_key, private_key = EXCLUDED.private_key, created_at = NOW()`,
          [normalizedDomain, selector, publicKeyPem, privateKeyPem]
        );

        return NextResponse.json({
          selector,
          recordName: `${selector}._domainkey`,
          recordValue: `v=DKIM1; k=rsa; p=${exportPublicKeyPemToDns(publicKeyPem)}`,
          imported: true
        });
      } catch (e: any) {
        console.error('DKIM import error', e);
        return NextResponse.json({ error: e?.message || 'Invalid private key' }, { status: 400 });
      }
    }

    // Default flow: generate a new keypair
    const { publicKeyPem, privateKeyPem: newPrivateKeyPem } = await generateKeyPair();

    await pgQuery(
      `INSERT INTO domain_dkim(domain_name, selector, public_key, private_key)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (domain_name)
       DO UPDATE SET selector = EXCLUDED.selector, public_key = EXCLUDED.public_key, private_key = EXCLUDED.private_key, created_at = NOW()`,
      [normalizedDomain, selector, publicKeyPem, newPrivateKeyPem]
    );

    return NextResponse.json({
      selector,
      recordName: `${selector}._domainkey`,
      recordValue: `v=DKIM1; k=rsa; p=${exportPublicKeyPemToDns(publicKeyPem)}`,
      imported: false
    });
  } catch (err: any) {
    console.error('DKIM POST error', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
