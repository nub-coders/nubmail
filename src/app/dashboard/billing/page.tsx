'use client';

import { useEffect, useState } from 'react';
import { Globe, Users, Mail, HardDrive, CheckCircle, ArrowUpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuthClient } from '@/lib/auth-provider';

interface Stats {
  domains: number;
  accounts: number;
  emailsSent: number;
}

interface Account {
  id: string;
  emailAddress: string;
  storageQuota: number;
}

const FREE_PLAN_FEATURES = [
  'Unlimited custom domains',
  '1 GB storage per email account',
  'Built-in SMTP server',
  'DKIM signing',
  'API access',
  'Team collaboration',
];

export default function BillingPage() {
  const { user } = useAuthClient();
  const [stats, setStats] = useState<Stats | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const token = localStorage.getItem('token');
      try {
        const [statsRes, accountsRes] = await Promise.all([
          fetch('/api/stats', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/accounts', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const statsData = await statsRes.json();
        const accountsData = await accountsRes.json();
        if (statsRes.ok) setStats(statsData);
        if (accountsRes.ok) setAccounts(accountsData.accounts || []);
      } catch {} finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (!user) {
    return <div className="py-8 text-center">You must be signed in to view billing.</div>;
  }

  if (isLoading) {
    return (
      <div className="py-12">
        <LoadingSpinner size="md" text="Loading billing info..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">Manage your plan and view usage</p>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Free Plan</CardTitle>
              <CardDescription>Your current subscription</CardDescription>
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary text-sm px-3 py-1">
              Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {FREE_PLAN_FEATURES.map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Button disabled className="opacity-60">
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              Upgrade Plan
              <span className="ml-2 text-xs">(Coming Soon)</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.domains ?? '-'}</p>
                <p className="text-xs text-muted-foreground">Domains</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.accounts ?? '-'}</p>
                <p className="text-xs text-muted-foreground">Email Accounts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.emailsSent ?? '-'}</p>
                <p className="text-xs text-muted-foreground">Emails Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Storage Usage
            </CardTitle>
            <CardDescription>Storage allocation per email account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {accounts.map((account) => (
                <div key={account.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{account.emailAddress}</span>
                    <span className="text-muted-foreground">{account.storageQuota} MB allocated</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60 transition-all"
                      style={{ width: '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
