// Utility helpers for decoding JWT and checking expiry (client-side)

type JwtPayload = {
  exp?: number;
  [key: string]: unknown;
};

function decodeBase64Url(input: string): string | null {
  if (!input || !/^[A-Za-z0-9_-]+$/.test(input)) return null;
  try {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function parseJwt(token: string): JwtPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const decoded = decodeBase64Url(parts[1]);
  if (!decoded) return null;

  try {
    const payload = JSON.parse(decoded);
    return payload && typeof payload === 'object' ? (payload as JwtPayload) : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token);
  if (!payload) return true;
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return true;
  const expMs = payload.exp * 1000;
  return Date.now() >= expMs;
}

export function getTokenExpiryMs(token: string): number {
  const payload = parseJwt(token);
  if (!payload || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return 0;
  const expMs = payload.exp * 1000;
  return Math.max(0, expMs - Date.now());
}
