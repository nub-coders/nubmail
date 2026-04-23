import { NextRequest } from 'next/server';
import { verify } from 'jsonwebtoken';
import { pgQuery } from '@/lib/postgres';
import dns from 'dns/promises';

function normalizeDomain(input: string): string {
  return input.toLowerCase().trim().replace(/\.$/, '');
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
  const domainEnv = process.env.DOMAIN?.trim();
  const baseDomain = domainEnv ? normalizeDomain(domainEnv) : primaryDomain;
  if (baseDomain.startsWith('mail.') || baseDomain.startsWith('mails.')) {
    return baseDomain;
  }
  return `mails.${baseDomain}`;
}

export async function isServerDnsVerified(): Promise<boolean> {
  try {
    const primaryDomain = getPrimaryDomain();
    if (!primaryDomain) return false;
    
    const mailHost = getMailHost(primaryDomain);
    
    // Check MX record - the critical one for email
    const mxRecords = await dns.resolveMx(primaryDomain);
    const hasValidMx = mxRecords.some(mx => 
      equalsHostname(mx.exchange, mailHost) && mx.priority === 10
    );
    
    if (!hasValidMx) return false;
    
    // Check A record for mail host
    const aRecords = await dns.resolve4(mailHost);
    if (aRecords.length === 0) return false;
    
    return true;
  } catch (error) {
    console.error('Server DNS verification check failed:', error);
    return false;
  }
}

export async function getAdminFromToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || null;
  if (!token) return null;
  
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  
  try {
    const payload = verify(token, secret) as any;
    const { rows } = await pgQuery<{ id: string; email: string; is_admin: boolean }>(
      'SELECT id, email, is_admin FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = rows[0];
    if (!user || !user.is_admin) return null;
    return { id: String(user.id), email: user.email, isAdmin: true };
  } catch {
    return null;
  }
}

export async function getUserFromToken(req: NextRequest) {
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
