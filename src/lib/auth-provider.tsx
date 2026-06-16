"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useRouter, usePathname } from 'next/navigation';

interface User { id: string; email: string; fullName?: string | null; emailVerified?: boolean; isAdmin?: boolean }

type AuthCtx = {
  user: User | null;
  token: string | null; // Always null. Kept for back-compat with older call sites.
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
  // Legacy: no-op token setter. Triggers session refetch via cookie when called with a value.
  setToken: (t: string | null) => Promise<void>;
  isLoading?: boolean;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  token: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
  setUser: () => {},
  setToken: async () => {},
  isLoading: undefined,
});

export default function AuthClientProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
      if (!res.ok) {
        setUser(null);
        const protectedPrefixes = ['/dashboard', '/accounts'];
        const publicPaths = ['/', '/register', '/verify-email'];
        if (pathname && protectedPrefixes.some((p) => pathname.startsWith(p)) && !publicPaths.includes(pathname)) {
          router.push('/');
        }
        return;
      }
      const data = await res.json();
      setUser(data.user || null);
      if (data.user && data.user.emailVerified && pathname === '/verify-email') {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Auth load failed', err);
      toast({ title: 'Auth error', description: 'Could not verify session', variant: 'destructive' });
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include', cache: 'no-store' });
    } catch {
      // ignore
    }
    setUser(null);
    if (pathname !== '/') router.replace('/');
  };

  // Back-compat shim: callers pass null to log out, or a value to mean "session changed"
  // (which we satisfy by re-fetching /api/auth/me using the cookie). We deliberately do
  // not persist the token in JS state.
  const setToken = async (t: string | null) => {
    if (t === null) {
      await logout();
      return;
    }
    await refresh();
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <AuthContext.Provider value={{ user, token: null, loading, refresh, logout, setUser, setToken, isLoading: loading }}>
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
