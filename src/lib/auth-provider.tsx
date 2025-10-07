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
      localStorage.removeItem('token');
      setUser(null);
      return;
    }

    // If token immediately appears expired, remove it
    if (isTokenExpired(t)) {
      setTokenState(null);
      localStorage.removeItem('token');
      setUser(null);
      return;
    }

    // Persist and set state
    setTokenState(t);
    localStorage.setItem('token', t);

    // Optimistically set user from JWT payload (reduces perceived login delay)
    const payload = parseJwt(t);
    if (payload && payload.sub && payload.email) {
      setUser({
        id: String(payload.sub),
        email: String(payload.email),
        fullName: payload.fullName ?? null,
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

  // Initialize token from localStorage (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        // Use internal setter to validate and schedule expiry
        setTokenInternal(storedToken);
      } else {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When token changes, fetch current user data
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      if (!tokenState) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${tokenState}` },
          cache: 'no-store'
        });

        if (!res.ok) {
          // Token invalid on server; clear locally
          await setTokenInternal(null);
          setUser(null);
          setLoading(false);
          return;
        }

        const data = await res.json();
        if (!cancelled) {
          setUser(data.user);

          // If user exists but email not verified, and trying to access dashboard or protected routes, redirect to verification page
          const protectedPrefix = '/dashboard';
          if (data.user && data.user.emailVerified === false && pathname && pathname.startsWith(protectedPrefix)) {
            router.push('/verify-email');
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
