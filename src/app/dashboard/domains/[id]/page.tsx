"use client";
import styles from './page.module.css';

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Copy, Download, RefreshCw, ShieldAlert, Sparkles, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn, downloadBindFile } from "@/lib/utils";
import { useAuthClient } from "@/lib/auth-provider";

interface DomainDnsRecord {
  key: string;
  type: "TXT" | "MX" | "CNAME";
  name: string;
  host: string;
  expectedValue: string;
  priority?: number;
  status: "verified" | "failed" | "not_checked";
  observedValues: string[];
  message: string;
  optional?: boolean;
  canAutoGenerate?: boolean;
}

interface DomainDnsResponse {
  domainId: string;
  domainName: string;
  verificationStatus: string;
  verificationToken: string;
  lastChecked: string;
  records: DomainDnsRecord[];
}

function StatusBadge({ status }: { status: DomainDnsRecord["status"] }) {
  const config = {
    verified: {
      icon: CheckCircle2,
      label: "Verified",
      className: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30",
    },
    failed: {
      icon: ShieldAlert,
      label: "Failed",
      className: "bg-red-500/15 text-red-700 border-red-500/30",
    },
    not_checked: {
      icon: AlertTriangle,
      label: "Not Checked",
      className: "bg-amber-500/20 text-amber-800 border-amber-500/30",
    },
  } as const;

  const { icon: Icon, label, className } = config[status];
  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <Icon className={styles.h35} />
      {label}
    </Badge>
  );
}

export default function DomainDnsPage() {
  const params = useParams();
  const router = useRouter();
  const domainId = params.id as string;
  const { user , token} = useAuthClient();
  const { toast } = useToast();
  const [data, setData] = useState<DomainDnsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // DKIM generation is automatic; no UI button

  const dkimRecord = useMemo(
    () => data?.records.find((record) => record.key === "dkim"),
    [data]
  );

  const hasFailedRecords = useMemo(
    () => data?.records.some((record) => record.status === "failed") ?? false,
    [data]
  );

  const allVerified = useMemo(
    () => data?.records.every((record) => record.status === "verified") ?? false,
    [data]
  );

  const fetchDomainDns = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/domains/dns-status?domainId=${domainId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to load domain DNS status" }));
        throw new Error(body.error || "Failed to load domain DNS status");
      }

      const body = (await res.json()) as DomainDnsResponse;
      setData(body);
    } catch (error: any) {
      console.error("Failed to load domain DNS status", error);
      toast({
        title: "Unable to load DNS status",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyDnsRecords = async () => {
    if (!user || !domainId) return;
    setVerifying(true);
    try {
      const res = await fetch('/api/domains/verify-records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ domainId })
      });

      const result = await res.json();
      
      if (!res.ok) {
        toast({ 
          title: 'Verification failed', 
          description: result.message || result.error || 'Could not verify DNS records', 
          variant: 'destructive' 
        });
        return;
      }

      if (result.overallStatus === 'verified') {
        toast({ 
          title: 'Domain verified!', 
          description: `All DNS records for ${data?.domainName} have been verified successfully.` 
        });
      } else {
        const failedCount = result.records.filter((r: any) => r.status === 'failed').length;
        const verifiedCount = result.records.filter((r: any) => r.status === 'verified').length;
        toast({ 
          title: 'Partial verification', 
          description: `${verifiedCount} of ${result.records.length} DNS records verified. ${failedCount} records need attention.`,
        });
      }

      // Refresh the data after verification
      await fetchDomainDns();
    } catch (error: any) {
      console.error('Verification error:', error);
      toast({ 
        title: 'Verification error', 
        description: 'Unable to connect to verification service', 
        variant: 'destructive' 
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleDeleteDomain = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/domains?id=${domainId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete domain');

      toast({ title: 'Domain deleted', description: `${data?.domainName || 'Domain'} has been removed.` });
      router.push('/dashboard/domains');
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({ title: 'Delete failed', description: error.message || 'Could not delete domain', variant: 'destructive' });
    } finally {
      setDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  // DKIM generation is automatic

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied to clipboard!' });
    } catch (err) {
      toast({ title: 'Unable to copy', description: 'Clipboard access failed.', variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (user && domainId) {
      fetchDomainDns();
    }
  }, [user, domainId]);

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Domain DNS Setup</CardTitle>
          <CardDescription>Sign in to manage domain DNS configuration.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className={styles.flex}>
      <div className={styles.flex2}>
        <div className={styles.flex3}>
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/dashboard/domains')}
          >
            <ArrowLeft className={styles.h4} />
          </Button>
          <div>
            <h1 className={styles.text2xl}>Domain DNS Setup</h1>
            <p className={styles.textMutedForeground}>
              Configure DNS records for {data?.domainName || 'your domain'}
            </p>
          </div>
        </div>
        <div className={styles.flex4}>
          <Button variant="outline" onClick={fetchDomainDns} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh status
          </Button>
          {data && (
            <Button variant="outline" onClick={() => downloadBindFile(data.domainName, data.records)}>
              <Download className={styles.mr2} />
              Download zone file
            </Button>
          )}
          <Button onClick={verifyDnsRecords} disabled={verifying || loading}>
            <CheckCircle2 className={cn("mr-2 h-4 w-4", verifying && "animate-spin")} />
            {verifying ? "Verifying..." : "Verify Records"}
          </Button>
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={loading || !data}>
                <Trash2 className={styles.mr2} />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the domain <strong>{data?.domainName}</strong> and all associated email accounts. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteDomain} disabled={deleting} className={styles.bgDestructive}>
                  {deleting ? "Deleting..." : "Delete Domain"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
                <p className={styles.textSm}>Domain name</p>
                <div className={styles.mt2}>
                  <span className={styles.fontMedium}>{data.domainName}</span>
                </div>
              </div>
              <div className={styles.roundedLg}>
                <p className={styles.textSm}>Verification status</p>
                <div className={styles.mt22}>
                  <Badge
                    variant={data.verificationStatus === 'verified' ? 'default' : 'secondary'}
                    className={data.verificationStatus === 'verified' ? 'bg-green-500/20 text-green-700 border-green-500/30' : ''}
                  >
                    {data.verificationStatus}
                  </Badge>
                </div>
              </div>
              <div className={styles.roundedLg}>
                <p className={styles.textSm}>Configuration status</p>
                <div className={styles.mt22}>
                  <StatusBadge status={allVerified ? "verified" : hasFailedRecords ? "failed" : "not_checked"} />
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
            Add these records at your DNS provider. Use @ for apex/root and keep values exact.
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
                  <TableRow key={record.key} className={cn(record.optional && "opacity-80")}>
                    <TableCell className={styles.fontMedium}>{record.type}</TableCell>
                    <TableCell>
                      <div className={styles.flex5}>
                        <span>{record.name}</span>
                        <span className={styles.textXs}>{record.host}</span>
                        {record.optional && (
                          <span className={styles.textXs}>Optional</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={styles.flex6}>
                        <code className={styles.breakAll}>{record.expectedValue}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={styles.h7}
                          onClick={() => copyToClipboard(record.expectedValue)}
                        >
                          <Copy className={styles.h35} />
                        </Button>
                      </div>
                      {typeof record.priority === "number" && (
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
              <AlertTriangle className={styles.h5} />
              <div>
                <p className={styles.fontSemibold}>
                  DNS Propagation Notice
                </p>
                <p className={styles.textSm2}>
                  DNS changes can take anywhere from a few minutes to 48 hours to propagate globally. 
                  If verification fails, please wait and try again later.
                </p>
                <p className={styles.mt23}>
                  For full inbox deliverability, also ensure your server DNS is configured by your admin in Dashboard → Admin → Server.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
