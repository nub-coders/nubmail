import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'nubmail_auth';
const PROTECTED_ROUTES = ['/dashboard', '/accounts'];
const PUBLIC_ONLY_ROUTES = ['/login']; // Login page

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route)) && !token) {
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  if (PUBLIC_ONLY_ROUTES.includes(pathname) && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
  if (isStateChanging) {
    const hasApiKey = request.headers.has('x-api-key') ||
      (request.headers.get('authorization') || '').startsWith('ApiKey ');
    const hasCookie = !!request.cookies.get(AUTH_COOKIE_NAME)?.value;

    // Skip CSRF for API-key-only requests (no session cookie present)
    if (!(hasApiKey && !hasCookie)) {
      const origin = request.headers.get('origin');
      const referer = request.headers.get('referer');
      const host = request.headers.get('host');

      let candidateHost: string | null = null;
      if (origin) {
        try { candidateHost = new URL(origin).host; } catch { return new NextResponse('Invalid Origin', { status: 403 }); }
      } else if (referer) {
        try { candidateHost = new URL(referer).host; } catch { return new NextResponse('Invalid Referer', { status: 403 }); }
      }
      if (!candidateHost || candidateHost !== host) {
        return new NextResponse('CSRF check failed', { status: 403 });
      }
    }
  }

  const response = NextResponse.next();

  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '0');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
