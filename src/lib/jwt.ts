// Utility helpers for decoding JWT and checking expiry (client-side)

export function parseJwt(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    // Add padding if necessary
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const decoded = atob(padded);
    try {
      return JSON.parse(decoded);
    } catch (err) {
      // Sometimes JWT payload contains unicode; attempt decodeURIComponent trick
      const uriDecoded = decodeURIComponent(
        Array.prototype.map
          .call(decoded, (c: string) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );
      return JSON.parse(uriDecoded);
    }
  } catch (err) {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token);
  if (!payload) return true;
  if (!payload.exp) return true;
  const expMs = payload.exp * 1000;
  return Date.now() >= expMs;
}

export function getTokenExpiryMs(token: string): number {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return 0;
  const expMs = payload.exp * 1000;
  return Math.max(0, expMs - Date.now());
}
