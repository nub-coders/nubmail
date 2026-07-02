"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRouter, usePathname } from 'next/navigation';

interface User { id: string; email: string; fullName?: string | null; emailVerified?: boolean; isAdmin?: boolean }

type AuthCtx = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
  isLoading?: boolean;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
  setUser: () => {},
  isLoading: undefined,
});

export default function AuthClientProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const didInitialLoad = useRef(false);

  const redirectToLogin = async () => {
    const protectedPrefixes = ['/dashboard', '/accounts'];
    const publicPaths = ['/', '/login', '/register', '/verify-email'];
    if (pathname && protectedPrefixes.some((p) => pathname.startsWith(p)) && !publicPaths.includes(pathname)) {
      window.location.href = '/login';
    }
  };

  const refresh = async () => {
    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include', signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        setUser(null);
        await redirectToLogin();
        return;
      }
      const data = await res.json();
      setUser(data.user || null);
      if (data.user && data.user.emailVerified && pathname === '/verify-email') {
        router.push('/dashboard');
      }
    } catch (err) {
      clearTimeout(timeout);
      console.error('Auth load failed', err);
      setUser(null);
      await redirectToLogin();
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
    if (pathname !== '/login') router.replace('/login');
  };

  useEffect(() => {
    if (!didInitialLoad.current) {
      didInitialLoad.current = true;
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout, setUser, isLoading: loading }}>
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
