"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useRouter, usePathname } from 'next/navigation';
import { parseJwt, isTokenExpired, getTokenExpiryMs } from '@/lib/jwt';

interface User { id: string; email: string; fullName?: string | null; emailVerified?: boolean; isAdmin?: boolean }

const AuthContext = createContext<{
  user: User | null;
  token: string | null;
  loading: boolean;
  // setToken returns a promise for compatibility with callers that await it
  setToken: (t: string | null) => Promise<void>;
  isLoading?: boolean;
}>({
  user: null,
  token: null,
  loading: true,
  setToken: async () => {},
  isLoading: undefined
});

export default function AuthClientProvider({ children }: { children: React.ReactNode }) {
  const [tokenState, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const expiryTimerRef = useRef<number | null>(null);

  // Helper to clear expiry timer
  const clearExpiryTimer = () => {
    if (expiryTimerRef.current) {
      window.clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  };

  // Internal setter that manages localStorage and expiry timer
  const setTokenInternal = async (t: string | null) => {
    // Clear any existing timer
    clearExpiryTimer();

    if (!t) {
      setTokenState(null);
      setUser(null);
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
        });
      } catch {
      }
      if (pathname !== '/') {
        router.replace('/');
      }
      return;
    }

    // If token immediately appears expired, remove it
    if (isTokenExpired(t)) {
      setTokenState(null);
      setUser(null);
      return;
    }

    // Keep token in memory only; server-side auth is cookie-based.
    setTokenState(t);

    // Optimistically set user from JWT payload (reduces perceived login delay)
    const payload = parseJwt(t);
    if (payload && payload.sub && payload.email) {
      const fullName = typeof payload.fullName === 'string' ? payload.fullName : null;
      setUser({
        id: String(payload.sub),
        email: String(payload.email),
        fullName,
        emailVerified: typeof payload.emailVerified === 'boolean' ? payload.emailVerified : undefined,
        isAdmin: typeof payload.isAdmin === 'boolean' ? payload.isAdmin : undefined,
      });
    }

    // Schedule automatic logout when token expires
    const msUntilExpiry = getTokenExpiryMs(t);
    if (msUntilExpiry > 0) {
      expiryTimerRef.current = window.setTimeout(() => {
        setTokenInternal(null);
        toast({ title: 'Session expired', description: 'Please sign in again', variant: 'destructive' });
      }, msUntilExpiry + 1000); // +1s buffer
    }
  };

  // Fetch current user data from cookie-based session, with optional Bearer fallback.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);

      try {
        const headers: HeadersInit = {};
        if (tokenState) {
          headers.Authorization = `Bearer ${tokenState}`;
        }
        const res = await fetch('/api/auth/me', {
          headers,
          cache: 'no-store'
        });

        if (!res.ok) {
          // Session invalid; clear in-memory token and user state.
          if (!cancelled) setTokenState(null);
          setUser(null);

          // Redirect to login if trying to access protected route
          const protectedPrefixes = ['/dashboard', '/accounts'];
          const publicPaths = ['/', '/register', '/verify-email'];
          if (pathname && protectedPrefixes.some((prefix) => pathname.startsWith(prefix)) && !publicPaths.includes(pathname)) {
            router.push('/');
          }
          return;
        }

        const data = await res.json();
        if (!cancelled) {
          setUser(data.user);

          // Restore token in memory when session was validated via cookie
          // (e.g. after app restart where React state was lost but cookie persisted)
          if (data.token && !tokenState) {
            setTokenState(data.token);

            // Schedule automatic logout when token expires
            const msUntilExpiry = getTokenExpiryMs(data.token);
            if (msUntilExpiry > 0) {
              clearExpiryTimer();
              expiryTimerRef.current = window.setTimeout(() => {
                setTokenInternal(null);
                toast({ title: 'Session expired', description: 'Please sign in again', variant: 'destructive' });
              }, msUntilExpiry + 1000);
            }
          }

          if (data.user && data.user.emailVerified && pathname === '/verify-email') {
            router.push('/dashboard');
          }
        }
      } catch (err) {
        console.error('Auth load failed', err);
        toast({ title: 'Auth error', description: 'Could not verify session', variant: 'destructive' });
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [tokenState, pathname, router]);

  // Public setToken function (returns promise to allow `await setToken(...)` usage)
  const setTokenPublic = async (t: string | null) => {
    await setTokenInternal(t);
  };

  return (
    <AuthContext.Provider value={{ user, token: tokenState, loading, setToken: setTokenPublic, isLoading: loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthClient() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthClient must be used within an AuthClientProvider');
  }
  return context;
}
