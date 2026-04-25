"use client";

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
        const res = await fetch('/api/stats', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
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
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {dashboardStats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks to get you started</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <a href="/dashboard/domains" className="flex flex-col items-center gap-2 p-5 border border-border/40 rounded-xl hover:bg-muted/50 hover:border-border transition-all duration-150 cursor-pointer">
            <div className="text-sm font-medium">Add Domain</div>
            <div className="text-xs text-muted-foreground text-center">Register a new domain</div>
          </a>
          <a href="/dashboard/compose" className="flex flex-col items-center gap-2 p-5 border border-border/40 rounded-xl hover:bg-muted/50 hover:border-border transition-all duration-150 cursor-pointer">
            <div className="text-sm font-medium">Compose Email</div>
            <div className="text-xs text-muted-foreground text-center">Send a new message</div>
          </a>
          <a href="/dashboard/inbox" className="flex flex-col items-center gap-2 p-5 border border-border/40 rounded-xl hover:bg-muted/50 hover:border-border transition-all duration-150 cursor-pointer">
            <div className="text-sm font-medium">View Inbox</div>
            <div className="text-xs text-muted-foreground text-center">Check your messages</div>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
