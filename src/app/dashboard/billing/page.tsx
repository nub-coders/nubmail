'use client';
import styles from './page.module.css';

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
  const { user , token} = useAuthClient();
  const [stats, setStats] = useState<Stats | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
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
    return <div className={styles.nu_py8}>You must be signed in to view billing.</div>;
  }

  if (isLoading) {
    return (
      <div className={styles.nu_py12}>
        <LoadingSpinner size="md" text="Loading billing info..." />
      </div>
    );
  }

  return (
    <div className={styles.nu_flex}>
      <div className={styles.nu_spaceY2}>
        <h1 className={styles.nu_text2xl}>Billing</h1>
        <p className={styles.nu_textSm}>Manage your plan and view usage</p>
      </div>

      <Card className={styles.nu_borderPrimary20}>
        <CardHeader>
          <div className={styles.nu_flex2}>
            <div>
              <CardTitle className={styles.nu_textXl}>Free Plan</CardTitle>
              <CardDescription>Your current subscription</CardDescription>
            </div>
            <Badge variant="secondary" className={styles.nu_bgPrimary10}>
              Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className={styles.nu_grid}>
            {FREE_PLAN_FEATURES.map((feature) => (
              <div key={feature} className={styles.nu_flex3}>
                <CheckCircle className={styles.nu_h4} />
                <span>{feature}</span>
              </div>
            ))}
          </div>
          <div className={styles.nu_mt6}>
            <Button disabled className={styles.nu_opacity60}>
              <ArrowUpCircle className={styles.nu_h42} />
              Upgrade Plan
              <span className={styles.nu_ml2}>(Coming Soon)</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className={styles.nu_grid2}>
        <Card>
          <CardContent className={styles.nu_pt6}>
            <div className={styles.nu_flex4}>
              <div className={styles.nu_h10}>
                <Globe className={styles.nu_h5} />
              </div>
              <div>
                <p className={styles.nu_text2xl2}>{stats?.domains ?? '-'}</p>
                <p className={styles.nu_textXs}>Domains</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className={styles.nu_pt6}>
            <div className={styles.nu_flex4}>
              <div className={styles.nu_h102}>
                <Users className={styles.nu_h52} />
              </div>
              <div>
                <p className={styles.nu_text2xl2}>{stats?.accounts ?? '-'}</p>
                <p className={styles.nu_textXs}>Email Accounts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className={styles.nu_pt6}>
            <div className={styles.nu_flex4}>
              <div className={styles.nu_h103}>
                <Mail className={styles.nu_h53} />
              </div>
              <div>
                <p className={styles.nu_text2xl2}>{stats?.emailsSent ?? '-'}</p>
                <p className={styles.nu_textXs}>Emails Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className={styles.nu_flex5}>
              <HardDrive className={styles.nu_h54} />
              Storage Usage
            </CardTitle>
            <CardDescription>Storage allocation per email account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={styles.nu_spaceY4}>
              {accounts.map((account) => (
                <div key={account.id} className={styles.nu_spaceY2}>
                  <div className={styles.nu_flex6}>
                    <span className={styles.nu_fontMedium}>{account.emailAddress}</span>
                    <span className={styles.nu_textMutedForeground}>{account.storageQuota} MB allocated</span>
                  </div>
                  <div className={styles.nu_h2}>
                    <div
                      className={styles.nu_hFull}
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
