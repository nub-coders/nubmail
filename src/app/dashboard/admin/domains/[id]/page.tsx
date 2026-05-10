"use client";
import styles from './page.module.css';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, CheckCircle2, Copy, Download, RefreshCw, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { cn, downloadBindFile } from '@/lib/utils';
import { useAuthClient } from '@/lib/auth-provider';

interface DomainDnsRecord {
  key: string;
  type: 'TXT' | 'MX' | 'CNAME';
  name: string;
  host: string;
  expectedValue: string;
  priority?: number;
  status: 'verified' | 'failed' | 'not_checked';
  observedValues: string[];
  message: string;
  optional?: boolean;
}

interface AdminDomainDnsResponse {
  domainId: string;
  domainName: string;
  verificationStatus: string;
  verificationToken: string;
  userId: string;
  userEmail: string | null;
  userFullName: string | null;
  lastChecked: string;
  records: DomainDnsRecord[];
}

function StatusBadge({ status }: { status: DomainDnsRecord['status'] }) {
  const config = {
    verified: {
      icon: CheckCircle2,
      label: 'Verified',
      className: 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
    },
    failed: {
      icon: ShieldAlert,
      label: 'Failed',
      className: 'bg-red-500/15 text-red-700 border-red-500/30',
    },
    not_checked: {
      icon: AlertTriangle,
      label: 'Not Checked',
      className: 'bg-amber-500/20 text-amber-800 border-amber-500/30',
    },
  } as const;

  const { icon: Icon, label, className } = config[status];
  return (
    <Badge variant="outline" className={cn('gap-1', className)}>
      <Icon className={styles.h35} />
      {label}
    </Badge>
  );
}

export default function AdminDomainDetailPage() {
  const params = useParams();
  const router = useRouter();
  const domainId = params.id as string;
  const { user , token} = useAuthClient();
  const { toast } = useToast();
  const [data, setData] = useState<AdminDomainDnsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const allVerified = data?.records.every((record) => record.status === 'verified') ?? false;
  const hasFailedRecords = data?.records.some((record) => record.status === 'failed') ?? false;

  const fetchDomain = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/domains/dns-status?domainId=${domainId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 403) {
        toast({
          title: 'Access denied',
          description: 'You do not have access to this domain',
          variant: 'destructive',
        });
        router.push('/dashboard/admin/domains');
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to load domain DNS status' }));
        throw new Error(body.error || 'Failed to load domain DNS status');
      }

      setData(await res.json());
    } catch (error: any) {
      console.error('Failed to load admin domain status', error);
      toast({
        title: 'Unable to load DNS status',
        description: error?.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied to clipboard!' });
    } catch {
      toast({ title: 'Unable to copy', description: 'Clipboard access failed.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (user && domainId) {
      fetchDomain();
    }
  }, [user, domainId]);

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Domain DNS Setup</CardTitle>
          <CardDescription>Sign in to view domain DNS configuration.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className={styles.flex}>
      <div className={styles.flex2}>
        <div className={styles.flex3}>
          <Button variant="outline" size="icon" onClick={() => router.push('/dashboard/admin/domains')}>
            <ArrowLeft className={styles.h4} />
          </Button>
          <div>
            <h1 className={styles.text2xl}>Domain Records</h1>
            <p className={styles.textMutedForeground}>
              {data?.domainName || 'Loading domain'} {data?.userEmail ? `owned by ${data.userEmail}` : ''}
            </p>
          </div>
        </div>
        <div className={styles.flex4}>
          {data && (
            <Button variant="outline" onClick={() => downloadBindFile(data.domainName, data.records as any)}>
              <Download className={styles.mr2} />
              Download zone file
            </Button>
          )}
          <Button variant="outline" onClick={fetchDomain} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh status
          </Button>
        </div>
      </div>

      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Domain overview</CardTitle>
            <CardDescription>
              Last checked {new Date(data.lastChecked).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={styles.grid}>
              <div className={styles.roundedLg}>
                <p className={styles.textSm}>Domain</p>
                <div className={styles.mt2}>{data.domainName}</div>
              </div>
              <div className={styles.roundedLg}>
                <p className={styles.textSm}>Owner</p>
                <div className={styles.mt2}>{data.userFullName || data.userEmail || 'Unknown'}</div>
              </div>
              <div className={styles.roundedLg}>
                <p className={styles.textSm}>Verification status</p>
                <div className={styles.mt22}>
                  <Badge variant={data.verificationStatus === 'verified' ? 'default' : 'secondary'} className={data.verificationStatus === 'verified' ? 'bg-green-500/20 text-green-700 border-green-500/30' : ''}>
                    {data.verificationStatus}
                  </Badge>
                </div>
              </div>
              <div className={styles.roundedLg}>
                <p className={styles.textSm}>Configuration</p>
                <div className={styles.mt22}>
                  <StatusBadge status={allVerified ? 'verified' : hasFailedRecords ? 'failed' : 'not_checked'} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Required DNS records</CardTitle>
          <CardDescription>
            Click any value to copy it, then add it at the DNS provider for this user’s domain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Expected value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Observed</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className={styles.h24}>
                    Loading DNS status...
                  </TableCell>
                </TableRow>
              ) : data ? (
                data.records.map((record) => (
                  <TableRow key={record.key} className={cn(record.optional && 'opacity-80')}>
                    <TableCell className={styles.fontMedium}>{record.type}</TableCell>
                    <TableCell>
                      <div className={styles.flex5}>
                        <span>{record.name}</span>
                        <span className={styles.textXs}>{record.host}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={styles.flex6}>
                        <code className={styles.breakAll}>{record.expectedValue}</code>
                        <Button variant="ghost" size="icon" className={styles.h7} onClick={() => copyToClipboard(record.expectedValue)}>
                          <Copy className={styles.h35} />
                        </Button>
                      </div>
                      {typeof record.priority === 'number' && (
                        <div className={styles.textXs}>Priority {record.priority}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={record.status} />
                    </TableCell>
                    <TableCell>
                      {record.observedValues.length > 0 ? (
                        <div className={styles.flex7}>
                          {record.observedValues.map((value, index) => (
                            <code key={`${record.key}-${index}`} className={styles.breakAll}>
                              {value}
                            </code>
                          ))}
                        </div>
                      ) : (
                        <span className={styles.textXs}>No records detected</span>
                      )}
                    </TableCell>
                    <TableCell className={styles.maxWXs}>
                      {record.message}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className={styles.h24}>
                    Domain DNS data not available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data && (
        <Card className={styles.borderAmber200}>
          <CardContent className={styles.pt6}>
            <div className={styles.flex8}>
              <AlertTriangle className={styles.mt05} />
              <div>
                <p className={styles.mb1}>DNS Propagation Notice</p>
                <p className={styles.textSm2}>
                  DNS changes can take anywhere from a few minutes to 48 hours to propagate globally.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}