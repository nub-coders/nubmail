"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Copy, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";

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
import { cn } from "@/lib/utils";
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
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}

export default function DomainDnsPage() {
  const params = useParams();
  const router = useRouter();
  const domainId = params.id as string;
  const { user } = useAuthClient();
  const { toast } = useToast();
  const [data, setData] = useState<DomainDnsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
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
          Authorization: `Bearer ${localStorage.getItem('token')}`
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/dashboard/domains')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Domain DNS Setup</h1>
            <p className="text-muted-foreground">
              Configure DNS records for {data?.domainName || 'your domain'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={fetchDomainDns} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh status
          </Button>
          <Button onClick={verifyDnsRecords} disabled={verifying || loading}>
            <CheckCircle2 className={cn("mr-2 h-4 w-4", verifying && "animate-spin")} />
            {verifying ? "Verifying..." : "Verify Records"}
          </Button>
          {/* DKIM generation button removed */}
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Domain name</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="font-medium">{data.domainName}</span>
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Verification status</p>
                <div className="mt-2">
                  <Badge
                    variant={data.verificationStatus === 'verified' ? 'default' : 'secondary'}
                    className={data.verificationStatus === 'verified' ? 'bg-green-500/20 text-green-700 border-green-500/30' : ''}
                  >
                    {data.verificationStatus}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Configuration status</p>
                <div className="mt-2">
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
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Loading DNS status...
                  </TableCell>
                </TableRow>
              ) : data ? (
                data.records.map((record) => (
                  <TableRow key={record.key} className={cn(record.optional && "opacity-80")}>
                    <TableCell className="font-medium">{record.type}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{record.name}</span>
                        <span className="text-xs text-muted-foreground">{record.host}</span>
                        {record.optional && (
                          <span className="text-xs text-muted-foreground">Optional</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="break-all text-xs">{record.expectedValue}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copyToClipboard(record.expectedValue)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {typeof record.priority === "number" && (
                        <div className="text-xs text-muted-foreground">Priority {record.priority}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={record.status} />
                    </TableCell>
                    <TableCell>
                      {record.observedValues.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {record.observedValues.map((value, index) => (
                            <code key={`${record.key}-${index}`} className="break-all text-xs">
                              {value}
                            </code>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No records detected</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground">
                      {record.message}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Domain DNS data not available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data && (
        <Card className="border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
                  DNS Propagation Notice
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  DNS changes can take anywhere from a few minutes to 48 hours to propagate globally. 
                  If verification fails, please wait and try again later.
                </p>
                <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
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
