"use client";
import styles from './page.module.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Globe, Shield, Users, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuthClient } from '@/lib/auth-provider';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, domainsRes] = await Promise.all([
        fetch('/api/admin/users', { credentials: 'include' }),
        fetch('/api/admin/domains', { credentials: 'include' }),
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

        setSelectedUserId((previous) => {
          if (previous || nextUsers.length === 0) return previous;
          const firstWithDomains = nextUsers.find((item: User) => nextDomains.some((domain: Domain) => domain.userId === item.id));
          return (firstWithDomains || nextUsers[0])?.id || null;
        });
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
  }, [router, toast]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [fetchData, user]);

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
          <Badge variant="default" className={styles.nu_gap1}>
            <CheckCircle className={styles.nu_h3} />
            Verified
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className={styles.nu_gap1}>
            <XCircle className={styles.nu_h3} />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className={styles.nu_gap1}>
            <AlertCircle className={styles.nu_h3} />
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className={styles.nu_flex}>
      <div className={styles.nu_flex2}>
        <h1 className={styles.nu_text2xl}>Domain Management</h1>
        <p className={styles.nu_textMutedForeground}>
          Click a user to filter their domains, then click a domain to view DNS records.
        </p>
      </div>

      <div className={styles.nu_grid}>
        <Card>
          <CardHeader className={styles.nu_flex3}>
            <CardTitle className={styles.nu_textSm}>Total Users</CardTitle>
            <Users className={styles.nu_h4} />
          </CardHeader>
          <CardContent>
            <div className={styles.nu_text2xl2}>{loading ? '...' : users.length}</div>
            <p className={styles.nu_textXs}>Select a user to drill down</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className={styles.nu_flex3}>
            <CardTitle className={styles.nu_textSm}>Total Domains</CardTitle>
            <Globe className={styles.nu_h4} />
          </CardHeader>
          <CardContent>
            <div className={styles.nu_text2xl2}>{loading ? '...' : domains.length}</div>
            <p className={styles.nu_textXs}>Across all users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className={styles.nu_flex3}>
            <CardTitle className={styles.nu_textSm}>Verified Domains</CardTitle>
            <CheckCircle className={styles.nu_h4} />
          </CardHeader>
          <CardContent>
            <div className={styles.nu_text2xl2}>{loading ? '...' : verifiedDomains}</div>
            <p className={styles.nu_textXs}>DNS verified and active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className={styles.nu_flex3}>
            <CardTitle className={styles.nu_textSm}>Active Filter</CardTitle>
            <Shield className={styles.nu_h4} />
          </CardHeader>
          <CardContent>
            <div className={styles.nu_text2xl2}>{selectedUser ? '1 user' : 'All users'}</div>
            <p className={styles.nu_textXs}>{selectedUser ? selectedUser.email : 'Showing every domain'}</p>
          </CardContent>
        </Card>
      </div>

      <div className={styles.nu_grid2}>
        <Card className={styles.nu_hFit}>
          <CardHeader>
            <CardTitle className={styles.nu_flex4}>
              <Users className={styles.nu_h42} />
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
                    <TableCell colSpan={2} className={styles.nu_py8}>
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className={styles.nu_py8}>
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
                          <div className={styles.nu_flex5}>
                            <span className={styles.nu_fontMedium}>{item.fullName || item.email}</span>
                            <span className={styles.nu_textXs}>{item.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={styles.nu_flex5}>
                            <Badge variant={item.emailVerified ? 'default' : 'secondary'} className={styles.nu_wFit}>
                              {item.isAdmin ? <Shield className={styles.nu_h3} /> : <CheckCircle className={styles.nu_h3} />}
                              {item.isAdmin ? 'Admin' : item.emailVerified ? 'Verified' : 'Unverified'}
                            </Badge>
                            <span className={styles.nu_textXs}>{domainCount} domains</span>
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
          <CardHeader className={styles.nu_flex6}>
            <div>
              <CardTitle className={styles.nu_flex4}>
                <Globe className={styles.nu_h42} />
                Domains
              </CardTitle>
              <CardDescription>
                {selectedUser ? (
                  <>
                    Showing domains for <span className={styles.nu_fontMedium2}>{selectedUser.email}</span>
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
                  <TableHead className={styles.nu_textRight}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className={styles.nu_py8}>
                      Loading domains...
                    </TableCell>
                  </TableRow>
                ) : visibleDomains.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className={styles.nu_py8}>
                      No domains found for the selected user
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleDomains.map((domain) => (
                    <TableRow key={domain.id}>
                      <TableCell className={styles.nu_fontMedium}>
                        <Link href={`/dashboard/admin/domains/${domain.id}`} className={styles.nu_flex7}>
                          <Globe className={styles.nu_h4} />
                          {domain.domainName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(domain.userId)}
                          className={styles.nu_textLeft}
                        >
                          {domain.userEmail}
                        </button>
                      </TableCell>
                      <TableCell>{getStatusBadge(domain.verificationStatus)}</TableCell>
                      <TableCell>{new Date(domain.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell>
                      <TableCell className={styles.nu_textRight}>
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
