import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'nubmail_auth';
const PROTECTED_ROUTES = ['/dashboard', '/accounts'];
const PUBLIC_ONLY_ROUTES = ['/']; // Login page

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  // 1. --- Authentication Logic ---
  
  // If user is accessing a protected route without a token, redirect to login
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route)) && !token) {
    const url = new URL('/', request.url);
    // url.searchParams.set('callbackUrl', pathname); // Optional: remember where they were going
    return NextResponse.redirect(url);
  }

  // If user is already logged in and trying to access the login page, redirect to dashboard
  if (PUBLIC_ONLY_ROUTES.includes(pathname) && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 2. --- CSRF Protection (Basic) ---
  // For mutating requests, verify the Origin or Referer
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const host = request.headers.get('host');

    if (origin) {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        return new NextResponse('Invalid Origin', { status: 403 });
      }
    } else if (referer) {
      const refererUrl = new URL(referer);
      if (refererUrl.host !== host) {
        return new NextResponse('Invalid Referer', { status: 403 });
      }
    }
  }

  const response = NextResponse.next();

  // 3. --- Security Headers ---
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
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
    "img-src 'self' data: blob: https://placehold.co https://images.unsplash.com https://picsum.photos",
    "connect-src 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join('; ');
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: [
    // Match all request paths except static files and internal Next.js paths
    '/((?!_next/static|_next/image|api/auth/me|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
