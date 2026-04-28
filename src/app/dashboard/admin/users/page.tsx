"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminUsersPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/admin/domains');
  }, [router]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Redirecting to domain management...</p>
    </div>
  );
}
