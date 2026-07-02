"use client";
import styles from './page.module.css';

import { useEffect, useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuthClient } from '@/lib/auth-provider';


export default function Dashboard() {
  const { user } = useAuthClient();
  const [stats, setStats] = useState({ domains: 0, accounts: 0, emailsSent: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const res = await fetch('/api/stats', { credentials: 'include' });
        const data = await res.json();
        if (res.ok) setStats({ domains: data.domains || 0, accounts: data.accounts || 0, emailsSent: data.emailsSent || 0 });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const dashboardStats = [
    { title: 'Total Domains', value: loading ? '...' : stats.domains, description: 'active domains' },
    { title: 'Total Email Accounts', value: loading ? '...' : stats.accounts, description: 'email accounts' },
    { title: 'Emails Sent', value: loading ? '...' : stats.emailsSent, description: 'messages sent' },
  ];

  return (
    <div className={styles.nu_flex}>
      <div className={styles.nu_grid}>
        {dashboardStats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className={styles.nu_flex2}>
              <CardTitle className={styles.nu_textXs}>{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={styles.nu_text3xl}>{stat.value}</div>
              <p className={styles.nu_textXs2}>{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks to get you started</CardDescription>
        </CardHeader>
        <CardContent className={styles.nu_grid2}>
          <a href="/dashboard/domains" className={styles.nu_flex3}>
            <div className={styles.nu_textSm}>Add Domain</div>
            <div className={styles.nu_textXs3}>Register a new domain</div>
          </a>
          <a href="/dashboard/compose" className={styles.nu_flex3}>
            <div className={styles.nu_textSm}>Compose Email</div>
            <div className={styles.nu_textXs3}>Send a new message</div>
          </a>
          <a href="/dashboard/inbox" className={styles.nu_flex3}>
            <div className={styles.nu_textSm}>View Inbox</div>
            <div className={styles.nu_textXs3}>Check your messages</div>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
