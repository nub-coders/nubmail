"use client";
import styles from './page.module.css';

import { useEffect, useState } from 'react';
import { Users, Globe, Shield, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthClient } from '@/lib/auth-provider';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';

export default function AdminDashboardPage() {
  const { user , token} = useAuthClient();
  const router = useRouter();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDomains: 0,
    verifiedDomains: 0,
    adminUsers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminStats = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const [usersRes, domainsRes] = await Promise.all([
          fetch('/api/admin/users', {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch('/api/admin/domains', {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        if (usersRes.status === 403 || domainsRes.status === 403) {
          toast({
            title: 'Access Denied',
            description: 'You do not have admin privileges',
            variant: 'destructive'
          });
          router.push('/dashboard');
          return;
        }

        const usersData = await usersRes.json();
        const domainsData = await domainsRes.json();

        if (usersRes.ok && domainsRes.ok) {
          setStats({
            totalUsers: usersData.users?.length || 0,
            totalDomains: domainsData.domains?.length || 0,
            verifiedDomains: domainsData.domains?.filter((d: any) => d.verificationStatus === 'verified').length || 0,
            adminUsers: usersData.users?.filter((u: any) => u.isAdmin).length || 0
          });
        }
      } catch (error) {
        console.error('Error fetching admin stats:', error);
        toast({
          title: 'Error',
          description: 'Failed to load admin statistics',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAdminStats();
  }, [user, router, toast]);

  const adminStats = [
    { 
      title: 'Total Users', 
      value: loading ? '...' : stats.totalUsers,
      icon: Users,
      description: `${stats.adminUsers} admins`
    },
    { 
      title: 'Total Domains', 
      value: loading ? '...' : stats.totalDomains,
      icon: Globe,
      description: `${stats.verifiedDomains} verified`
    },
    { 
      title: 'System Status', 
      value: 'Operational',
      icon: Activity,
      description: 'All services running'
    },
    { 
      title: 'Admin Access', 
      value: 'Active',
      icon: Shield,
      description: 'Full privileges'
    },
  ];

  return (
    <div className={styles.nu_flex}>
      <div>
        <h1 className={styles.nu_text2xl}>Admin Dashboard</h1>
        <p className={styles.nu_textMutedForeground}>System overview and management</p>
      </div>

      <div className={styles.nu_grid}>
        {adminStats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className={styles.nu_flex2}>
              <CardTitle className={styles.nu_textSm}>{stat.title}</CardTitle>
              <stat.icon className={styles.nu_h4} />
            </CardHeader>
            <CardContent>
              <div className={styles.nu_text2xl2}>{stat.value}</div>
              <p className={styles.nu_textXs}>{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className={styles.nu_grid2}>
          <button
            onClick={() => router.push('/dashboard/admin/domains')}
            className={styles.nu_flex3}
          >
            <Globe className={styles.nu_h5} />
            <div className={styles.nu_textLeft}>
              <div className={styles.nu_fontMedium}>Manage Domains</div>
              <div className={styles.nu_textSm2}>View users, domains, and DNS records</div>
            </div>
          </button>
          <button
            onClick={() => router.push('/dashboard/admin/server-dns')}
            className={styles.nu_flex3}
          >
            <Shield className={styles.nu_h5} />
            <div className={styles.nu_textLeft}>
              <div className={styles.nu_fontMedium}>Server DNS</div>
              <div className={styles.nu_textSm2}>Check mail server DNS configuration</div>
            </div>
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
