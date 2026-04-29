/**
 * Simple in-memory rate limiter for auth endpoints.
 * Helps prevent brute-force attacks and signals to Google Safe Browsing
 * that this is a security-conscious, legitimate application.
 */

interface RateEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateEntry>();

// Cleanup stale entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check if a request should be rate limited.
 * @param key - Unique identifier (e.g. IP + endpoint)
 * @param maxAttempts - Maximum number of attempts allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns `{ limited: true, retryAfterMs }` if rate limited, `{ limited: false }` otherwise
 */
export function rateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): { limited: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }

  entry.count++;
  if (entry.count > maxAttempts) {
    return { limited: true, retryAfterMs: entry.resetAt - now };
  }

  return { limited: false };
}

/**
 * Extract a client identifier from a request for rate limiting.
 * Uses X-Forwarded-For (from reverse proxy) or falls back to
 * X-Real-IP or a generic key.
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
