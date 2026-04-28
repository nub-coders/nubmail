"use client";

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Globe, Shield, Users, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuthClient } from '@/lib/auth-provider';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';

interface User {
  id: string;
  email: string;
  fullName?: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
}

interface Domain {
  id: string;
  domainName: string;
  verificationStatus: 'pending' | 'verified' | 'failed';
  userId: string;
  userEmail: string;
  createdAt: string;
}

export default function AdminDomainsPage() {
  const { user } = useAuthClient();
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, domainsRes] = await Promise.all([
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
        fetch('/api/admin/domains', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
      ]);

      if (usersRes.status === 403 || domainsRes.status === 403) {
        toast({
          title: 'Access Denied',
          description: 'You do not have admin privileges',
          variant: 'destructive',
        });
        router.push('/dashboard');
        return;
      }

      const [usersData, domainsData] = await Promise.all([usersRes.json(), domainsRes.json()]);
      if (usersRes.ok && domainsRes.ok) {
        const nextUsers = usersData.users || [];
        const nextDomains = domainsData.domains || [];
        setUsers(nextUsers);
        setDomains(nextDomains);

        if (!selectedUserId && nextUsers.length > 0) {
          const firstWithDomains = nextUsers.find((item: User) => nextDomains.some((domain: Domain) => domain.userId === item.id));
          setSelectedUserId((firstWithDomains || nextUsers[0])?.id || null);
        }
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users and domains',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const domainCountByUser = useMemo(() => {
    return domains.reduce<Record<string, number>>((accumulator, domain) => {
      accumulator[domain.userId] = (accumulator[domain.userId] || 0) + 1;
      return accumulator;
    }, {});
  }, [domains]);

  const selectedUser = selectedUserId ? users.find((item) => item.id === selectedUserId) || null : null;
  const visibleDomains = selectedUserId ? domains.filter((domain) => domain.userId === selectedUserId) : domains;
  const verifiedDomains = domains.filter((domain) => domain.verificationStatus === 'verified').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Verified
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Domain Management</h1>
        <p className="text-muted-foreground">
          Click a user to filter their domains, then click a domain to view DNS records.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : users.length}</div>
            <p className="text-xs text-muted-foreground">Select a user to drill down</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Domains</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : domains.length}</div>
            <p className="text-xs text-muted-foreground">Across all users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified Domains</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : verifiedDomains}</div>
            <p className="text-xs text-muted-foreground">DNS verified and active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Filter</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedUser ? '1 user' : 'All users'}</div>
            <p className="text-xs text-muted-foreground">{selectedUser ? selectedUser.email : 'Showing every domain'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Users
            </CardTitle>
            <CardDescription>
              {loading ? 'Loading...' : `${users.length} total users`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Domains</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((item) => {
                    const domainCount = domainCountByUser[item.id] || 0;
                    const isSelected = selectedUserId === item.id;
                    return (
                      <TableRow
                        key={item.id}
                        className={isSelected ? 'bg-muted/50' : 'cursor-pointer hover:bg-muted/40'}
                        onClick={() => setSelectedUserId(item.id)}
                      >
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{item.fullName || item.email}</span>
                            <span className="text-xs text-muted-foreground">{item.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={item.emailVerified ? 'default' : 'secondary'} className="w-fit gap-1">
                              {item.isAdmin ? <Shield className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                              {item.isAdmin ? 'Admin' : item.emailVerified ? 'Verified' : 'Unverified'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{domainCount} domains</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4" />
                Domains
              </CardTitle>
              <CardDescription>
                {selectedUser ? (
                  <>
                    Showing domains for <span className="font-medium text-foreground">{selectedUser.email}</span>
                  </>
                ) : loading ? 'Loading...' : `${domains.length} total domains`}
              </CardDescription>
            </div>
            {selectedUser && (
              <Button variant="outline" size="sm" onClick={() => setSelectedUserId(null)}>
                Show all users
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Loading domains...
                    </TableCell>
                  </TableRow>
                ) : visibleDomains.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No domains found for the selected user
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleDomains.map((domain) => (
                    <TableRow key={domain.id}>
                      <TableCell className="font-medium">
                        <Link href={`/dashboard/admin/domains/${domain.id}`} className="flex items-center gap-2 text-primary hover:underline">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          {domain.domainName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(domain.userId)}
                          className="text-left text-sm text-primary hover:underline"
                        >
                          {domain.userEmail}
                        </button>
                      </TableCell>
                      <TableCell>{getStatusBadge(domain.verificationStatus)}</TableCell>
                      <TableCell>{format(new Date(domain.createdAt), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/dashboard/admin/domains/${domain.id}`}>View records</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
