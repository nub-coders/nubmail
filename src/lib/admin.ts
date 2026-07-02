import { NextRequest } from 'next/server';
import { pgQuery } from '@/lib/postgres';
import dns from 'dns/promises';
import { getTokenFromRequest, verifySession } from '@/lib/auth-token';
import { verifyJwt } from '@/lib/jwt-server';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  fullName: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
}

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
  const token = getTokenFromRequest(req);
  if (!token) return null;

  const session = await verifySession(token);
  if (!session) return null;
  if (!session.isAdmin) return null;

  return { id: String(session.id), email: session.email, isAdmin: true };
}

export async function getUserFromToken(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return null;

  const session = await verifySession(token);
  if (!session) return null;

  return {
    sub: String(session.id),
    email: session.email,
    fullName: session.fullName,
    emailVerified: !!session.emailVerified,
    isAdmin: !!session.isAdmin,
  } satisfies AuthenticatedUser;
}
export function canPerformImportantAction(user: AuthenticatedUser): boolean {
  return user.isAdmin || user.emailVerified;
}
