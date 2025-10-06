"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useRouter, usePathname } from 'next/navigation';

interface User { id: string; email: string; fullName?: string | null; isAdmin?: boolean }

const AuthContext = createContext<{ user: User | null; token: string | null; setToken: (t: string | null) => Promise<void>; isLoading: boolean }>({ 
  user: null, 
  token: null, 
  setToken: async () => {}, 
  isLoading: false 
});

export default function AuthClientProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const setToken = async (newToken: string | null) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem('token', newToken);
      setIsLoading(true);
      try {
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${newToken}` } });
        if (!res.ok) {
          throw new Error('Failed to verify token');
        }
        const data = await res.json();
        setUser(data.user);
      } catch (err) {
        console.error('Auth verification failed', err);
        setTokenState(null);
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    } else {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setUser(null);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          setToken(null);
          localStorage.removeItem('token');
          setUser(null);
          return;
        }
        const data = await res.json();
        setUser(data.user);

        // Route protection can be based on user role if needed
        const protectedPrefix = '/dashboard';
        const adminPrefix = '/dashboard/admin';
        if (data.user && !data.user.isAdmin && pathname && pathname.startsWith(adminPrefix)) {
          router.push('/dashboard');
        }
      } catch (err) {
        console.error('Auth load failed', err);
        toast({ title: 'Auth error', description: 'Could not verify session', variant: 'destructive' });
        setUser(null);
      }
    };
    load();
  }, [token, pathname, router]);

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  return <AuthContext.Provider value={{ user, token, setToken, isLoading }}>{children}</AuthContext.Provider>;
}

export function useAuthClient() {
  return useContext(AuthContext);
}
