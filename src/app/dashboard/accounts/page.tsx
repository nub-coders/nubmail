"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuthClient } from '@/lib/auth-provider';

export default function AccountsPage() {
  const { user } = useAuthClient();
  const [loading] = useState(false);

  if (!user) {
    return <div className="py-8 text-center">You must be signed in to manage accounts.</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold">Email Accounts</h1>
        <p className="text-muted-foreground">Manage email accounts for your verified domains.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>This section is being migrated from Firebase to the new backend. Functionality will be available soon.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-6 text-center">Accounts management is temporarily unavailable.</div>
        </CardContent>
      </Card>
    </div>
  );
}
