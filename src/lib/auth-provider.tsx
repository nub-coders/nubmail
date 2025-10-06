"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useRouter, usePathname } from 'next/navigation';

interface User { id: string; email: string; fullName?: string | null; emailVerified?: boolean }

const AuthContext = createContext<{
  user: User | null;
  token: string | null;
  loading: boolean;
  setToken: (t: string | null) => void;
}>({
  user: null,
  token: null,
  loading: true,
  setToken: () => {}
});

export default function AuthClientProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  // Initialize token from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('token');
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      
      try {
        const res = await fetch('/api/auth/me', { 
          headers: { Authorization: `Bearer ${token}` },
          // Prevent caching of auth check
          cache: 'no-store'
        });
        
        if (!res.ok) {
          setToken(null);
          localStorage.removeItem('token');
          setUser(null);
          return;
        }
        
        const data = await res.json();
        setUser(data.user);

        // If user exists but email not verified, and trying to access dashboard or protected routes, redirect to verification page
        const protectedPrefix = '/dashboard';
        if (data.user && data.user.emailVerified === false && pathname && pathname.startsWith(protectedPrefix)) {
          router.push('/verify-email');
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

  return (
    <AuthContext.Provider value={{ user, token, loading, setToken }}>
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
