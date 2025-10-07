"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";

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

interface ServerDnsRecord {
  key: string;
  type: "A" | "MX" | "TXT" | "CNAME";
  name: string;
  host: string;
  expectedValue: string;
  priority?: number;
  status: "configured" | "missing" | "mismatch" | "action_required";
  observedValues: string[];
  message: string;
  optional?: boolean;
  canAutoGenerate?: boolean;
  selector?: string;
}

interface ServerDnsResponse {
  primaryDomain: string;
  mailHost: string;
  mailHostLabel: string;
  lastChecked: string;
  records: ServerDnsRecord[];
}

function StatusBadge({ status }: { status: ServerDnsRecord["status"] }) {
  const config = {
    configured: {
      icon: CheckCircle2,
      label: "Configured",
      className: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30",
    },
    missing: {
      icon: ShieldAlert,
      label: "Missing",
      className: "bg-red-500/15 text-red-700 border-red-500/30",
    },
    mismatch: {
      icon: AlertTriangle,
      label: "Mismatch",
      className: "bg-amber-500/20 text-amber-800 border-amber-500/30",
    },
    action_required: {
      icon: Sparkles,
      label: "Action required",
      className: "bg-sky-500/20 text-sky-700 border-sky-500/30",
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

export default function AdminServerDnsPage() {
  const { user } = useAuthClient();
  const { toast } = useToast();
  const [data, setData] = useState<ServerDnsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [dkimLoading, setDkimLoading] = useState(false);

  const fetchStatus = async () => {
    if (!user?.isAdmin) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/server-dns", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (res.status === 403) {
        toast({
          title: "Access denied",
          description: "You need admin privileges to view server DNS setup.",
          variant: "destructive",
        });
        setData(null);
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to load server DNS status" }));
        throw new Error(body.error || "Failed to load server DNS status");
      }

      const body = (await res.json()) as ServerDnsResponse;
      setData(body);
    } catch (error: any) {
      console.error("Failed to load server DNS status", error);
      toast({
        title: "Unable to load DNS status",
        description: error?.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateDkim = async () => {
    if (!user?.isAdmin) return;
    const selector = dkimRecord?.selector || "mail";
    setDkimLoading(true);
    try {
      const res = await fetch("/api/admin/server-dns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ action: "generateDkim", selector }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to generate DKIM" }));
        throw new Error(body.error || "Failed to generate DKIM");
      }

      const body = await res.json();
      toast({
        title: "DKIM key generated",
        description: `Publish TXT record ${body.recordName} with the new value.`,
      });
      await fetchStatus();
    } catch (error: any) {
      console.error("Failed to generate DKIM", error);
      toast({
        title: "DKIM generation failed",
        description: error?.message || "Unable to generate DKIM key",
        variant: "destructive",
      });
    } finally {
      setDkimLoading(false);
    }
  };

  useEffect(() => {
    if (user?.isAdmin) {
      fetchStatus();
    }
  }, [user]);

  const dkimRecord = useMemo(() => data?.records.find((record) => record.key === "dkim"), [data]);
  const hasBlockingIssues = useMemo(
    () => data?.records.some((record) => !record.optional && record.status !== "configured") ?? false,
    [data]
  );

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Server DNS Setup</CardTitle>
          <CardDescription>Sign in to manage server DNS configuration.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!user.isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access restricted</CardTitle>
          <CardDescription>This page is only available to administrator accounts.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Contact an administrator if you believe you should have access.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Server DNS Setup</h1>
          <p className="text-muted-foreground">
            Configure authoritative DNS records required for the NubMail infrastructure.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={fetchStatus} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh status
          </Button>
          {dkimRecord?.canAutoGenerate && (
            <Button onClick={generateDkim} disabled={dkimLoading}>
              <Sparkles className={cn("mr-2 h-4 w-4", dkimLoading && "animate-spin")} />
              {dkimLoading ? "Generating..." : "Generate DKIM"}
            </Button>
          )}
        </div>
      </div>

      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Environment overview</CardTitle>
            <CardDescription>
              Last checked {new Date(data.lastChecked).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Primary domain</p>
                <div className="mt-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{data.primaryDomain}</span>
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Mail host</p>
                <div className="mt-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{data.mailHost}</span>
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Configuration status</p>
                <div className="mt-2">
                  <StatusBadge status={hasBlockingIssues ? "missing" : "configured"} />
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
            Review and configure these DNS records with your domain registrar. Optional records improve client compatibility but are not strictly required.
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
                      <code className="break-all text-xs">{record.expectedValue}</code>
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
                    Server DNS data not available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
