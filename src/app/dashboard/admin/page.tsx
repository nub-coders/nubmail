"use client";

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
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-muted-foreground">System overview and management</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {adminStats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <button
            onClick={() => router.push('/dashboard/admin/domains')}
            className="flex items-center gap-2 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Globe className="h-5 w-5" />
            <div className="text-left">
              <div className="font-medium">Manage Domains</div>
              <div className="text-sm text-muted-foreground">View users, domains, and DNS records</div>
            </div>
          </button>
          <button
            onClick={() => router.push('/dashboard/admin/server-dns')}
            className="flex items-center gap-2 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <Shield className="h-5 w-5" />
            <div className="text-left">
              <div className="font-medium">Server DNS</div>
              <div className="text-sm text-muted-foreground">Check mail server DNS configuration</div>
            </div>
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
