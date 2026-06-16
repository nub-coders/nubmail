import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';

const JWT_ISSUER = process.env.JWT_ISSUER || 'nubmail';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'nubmail-app';
const JWT_ALGORITHM: jwt.Algorithm = 'HS256';

function getSecret(): string | null {
  const s = process.env.JWT_SECRET;
  return s && s.length >= 16 ? s : null;
}

export type SessionTokenPayload = JwtPayload & {
  sub: string;
  email?: string;
  fullName?: string | null;
  emailVerified?: boolean;
  isAdmin?: boolean;
  type?: string;
};

export function signSessionToken(payload: Omit<SessionTokenPayload, 'iss' | 'aud' | 'iat' | 'exp'>, opts?: SignOptions): string | null {
  const secret = getSecret();
  if (!secret) return null;
  return jwt.sign(payload, secret, {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: '7d',
    ...opts,
  });
}

export function signVerifyToken(sub: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  return jwt.sign({ sub, type: 'verify' }, secret, {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: '30m',
  });
}

export function verifyJwt(token: string, opts?: { type?: string }): SessionTokenPayload | null {
  const secret = getSecret();
  if (!secret) return null;
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as SessionTokenPayload;
    if (!decoded || typeof decoded !== 'object' || !decoded.sub) return null;
    if (opts?.type && decoded.type !== opts.type) return null;
    return decoded;
  } catch {
    return null;
  }
}
