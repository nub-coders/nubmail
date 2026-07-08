"use client";

import { useEffect } from 'react';
import { useAuthClient } from '@/lib/auth-provider';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthClient();

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/login';
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
