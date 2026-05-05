"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuthClient } from '@/lib/auth-provider';

export default function AccountsRedirectPage() {
  const { user, loading } = useAuthClient();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    router.replace(user ? '/dashboard/accounts' : '/');
  }, [loading, router, user]);

  return null;
}
