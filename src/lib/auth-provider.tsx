"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface User { id: string; email: string; fullName?: string | null }

const AuthContext = createContext<{ user: User | null; token: string | null; setToken: (t: string | null) => void }>({ user: null, token: null, setToken: () => {} });

export default function AuthClientProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  const [user, setUser] = useState<User | null>(null);
  const { toast } = useToast();

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
      } catch (err) {
        console.error('Auth load failed', err);
        toast({ title: 'Auth error', description: 'Could not verify session', variant: 'destructive' });
        setUser(null);
      }
    };
    load();
  }, [token]);

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  return <AuthContext.Provider value={{ user, token, setToken }}>{children}</AuthContext.Provider>;
}

export function useAuthClient() {
  return useContext(AuthContext);
}
