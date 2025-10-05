'use client';

import { ArrowUpRight } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { collection, collectionGroup, getDocs, query } from 'firebase/firestore';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';
import { useFirebase, useUser } from '@/firebase';
import { useEffect, useState } from 'react';

const CHART_DATA = [
  { month: 'January', desktop: 186 },
  { month: 'February', desktop: 305 },
  { month: 'March', desktop: 237 },
  { month: 'April', desktop: 73 },
  { month: 'May', desktop: 209 },
  { month: 'June', desktop: 214 },
];

const CHART_CONFIG = {
  desktop: {
    label: 'Usage',
    color: 'hsl(var(--primary))',
  },
};

export default function Dashboard() {
    const { firestore } = useFirebase();
    const { user } = useUser();
    const [stats, setStats] = useState({
        domains: 0,
        accounts: 0,
        emailsSent: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            if (!user || !firestore) return;

            try {
                const domainsQuery = query(collection(firestore, `users/${user.uid}/domains`));
                const domainsSnapshot = await getDocs(domainsQuery);
                const domainsCount = domainsSnapshot.size;

                const accountsQuery = query(collectionGroup(firestore, 'emailAccounts'));
                // Note: This is a simplified query. In a real app with many users,
                // you'd want to scope this to the current user's domains for security and performance.
                const accountsSnapshot = await getDocs(accountsQuery);
                const accountsCount = accountsSnapshot.size;
                
                const emailsQuery = query(collectionGroup(firestore, 'emailMessages'));
                 const emailsSnapshot = await getDocs(emailsQuery);
                const emailsCount = emailsSnapshot.size;


                setStats({
                    domains: domainsCount,
                    accounts: accountsCount,
                    emailsSent: emailsCount,
                });
            } catch (error) {
                console.error("Error fetching stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [user, firestore]);

  const dashboardStats = [
    {
      title: 'Total Domains',
      value: loading ? '...' : stats.domains,
      description: '',
    },
    {
      title: 'Total Email Accounts',
      value: loading ? '...' : stats.accounts,
      description: '',
    },
    {
      title: 'Storage Usage',
      value: '0 GB', // Placeholder, needs real calculation
      description: 'of 60 GB',
    },
    {
      title: 'Emails Sent',
      value: loading ? '...' : stats.emailsSent,
      description: 'total',
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {dashboardStats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              {stat.title !== 'Storage Usage' && <ArrowUpRight className="h-4 w-4 text-muted-foreground" />}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
              {stat.title === 'Storage Usage' && (
                <>
                  <Progress value={0} className="mt-2 h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Storage Usage History</CardTitle>
            <CardDescription>
              Monthly storage usage over the last 6 months.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={CHART_CONFIG} className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={CHART_DATA}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="month"
                    stroke="hsl(var(--foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value} GB`}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Bar
                    dataKey="desktop"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              A log of recent activities on your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    New domain 'example.com' added.
                  </p>
                  <p className="text-sm text-muted-foreground">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Email account 'test@nub-coder.tech' created.
                  </p>
                  <p className="text-sm text-muted-foreground">1 day ago</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Password changed.
                  </p>
                  <p className="text-sm text-muted-foreground">3 days ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
