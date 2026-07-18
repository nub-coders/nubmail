"use client";
import styles from './page.module.css';

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Download, HelpCircle, RefreshCw, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";

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
import { useToast } from "@/hooks/use-toast";
import { cn, downloadBindFile } from "@/lib/utils";
import { useAuthClient } from "@/lib/auth-provider";

interface ServerDnsRecord {
  key: string;
  type: "A" | "MX" | "TXT" | "CNAME";
  name: string;
  host: string;
  expectedValue: string;
  priority?: number;
  status: "configured" | "missing" | "mismatch" | "action_required" | "check_failed";
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

function CopyButton({ text }: { text: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        description: "Copied to clipboard",
        duration: 2000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy value to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button variant="ghost" size="icon" className={styles.nu_h6} onClick={handleCopy} title="Copy">
      {copied ? <CheckCircle2 className={styles.nu_h35} /> : <Copy className={styles.nu_h352} />}
      <span className={styles.nu_srOnly}>Copy</span>
    </Button>
  );
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
    check_failed: {
      icon: HelpCircle,
      label: "Check failed",
      className: "bg-slate-500/15 text-slate-700 border-slate-500/30",
    },
  } as const;

  const { icon: Icon, label, className } = config[status];
  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <Icon className={styles.nu_h353} />
      {label}
    </Badge>
  );
}

export default function AdminServerDnsPage() {
  const { user } = useAuthClient();
  const { toast } = useToast();
  const [data, setData] = useState<ServerDnsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // DKIM generation is automatic; no UI button needed
  // Test email feature removed

  const dkimRecord = useMemo(
    () => data?.records.find((record) => record.key === "dkim"),
    [data]
  );

  const hasBlockingIssues = useMemo(
    () =>
      data?.records.some(
        (record) => !record.optional && record.status !== "configured" && record.status !== "check_failed"
      ) ?? false,
    [data]
  );

  const fetchStatus = useCallback(async () => {
    if (!user?.isAdmin) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/server-dns", {
        credentials: "include",
        cache: "no-store",
      });

      if (res.status === 403) {
        toast({
          title: "Access denied",
          description: "You need admin privileges to view server DNS setup.",
          variant: "destructive",
        });
        setLoadError("Access denied. You need admin privileges to view server DNS setup.");
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
      const message = error?.message || "An unexpected error occurred";
      setLoadError(message);
      toast({
        title: "Unable to load DNS status",
        description: message,
        variant: "destructive",
      });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [toast, user?.isAdmin]);

  // DKIM generation is automatic; record value will be displayed when available

  // Test email feature removed

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

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
          <p className={styles.nu_textSm}>
            Contact an administrator if you believe you should have access.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={styles.nu_spaceY6}>
      <div className={styles.nu_flex}>
        <div>
          <h1 className={styles.nu_text2xl}>Server DNS Setup</h1>
          <p className={styles.nu_textMutedForeground}>
            Configure authoritative DNS records required for the NubMail infrastructure.
          </p>
        </div>
        <div className={styles.nu_flex2}>
          <Button variant="outline" onClick={fetchStatus} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh status
          </Button>
          {data && (
            <Button variant="outline" onClick={() => downloadBindFile(data.primaryDomain, data.records)}>
              <Download className={styles.nu_mr2} />
              Download zone file
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
            <div className={styles.nu_grid}>
              <div className={styles.nu_roundedLg}>
                <p className={styles.nu_textSm}>Primary domain</p>
                <div className={styles.nu_mt2}>
                  <ShieldCheck className={styles.nu_h4} />
                  <span className={styles.nu_fontMedium}>{data.primaryDomain}</span>
                </div>
              </div>
              <div className={styles.nu_roundedLg}>
                <p className={styles.nu_textSm}>Mail host</p>
                <div className={styles.nu_mt2}>
                  <ShieldCheck className={styles.nu_h4} />
                  <span className={styles.nu_fontMedium}>{data.mailHost}</span>
                </div>
              </div>
              <div className={styles.nu_roundedLg}>
                <p className={styles.nu_textSm}>Configuration status</p>
                <div className={styles.nu_mt22}>
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
                  <TableCell colSpan={6} className={styles.nu_h24}>
                    Loading DNS status...
                  </TableCell>
                </TableRow>
              ) : data ? (
                data.records.map((record) => (
                  <TableRow key={record.key} className={cn(record.optional && "opacity-80")}> 
                    <TableCell className={styles.nu_fontMedium}>{record.type}</TableCell>
                    <TableCell>
                      <div className={styles.nu_flex3}>
                        <span>{record.name}</span>
                        <div className={styles.nu_flex4}>
                          <span className={styles.nu_textXs}>{record.host}</span>
                          <CopyButton text={record.host} />
                        </div>
                        {record.optional && (
                          <span className={styles.nu_textXs}>(optional)</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={styles.nu_flex4}>
                        <code className={styles.nu_breakAll}>{record.expectedValue}</code>
                        <CopyButton text={record.expectedValue} />
                      </div>
                      {typeof record.priority === "number" && (
                        <div className={styles.nu_textXs}>Priority {record.priority}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={record.status} />
                    </TableCell>
                    <TableCell>
                      {record.observedValues.length > 0 ? (
                        <div className={styles.nu_flex5}>
                          {record.observedValues.map((value, index) => (
                            <code key={`${record.key}-${index}`} className={styles.nu_breakAll}>
                              {value}
                            </code>
                          ))}
                        </div>
                      ) : (
                        <span className={styles.nu_textXs}>No records detected</span>
                      )}
                    </TableCell>
                    <TableCell className={styles.nu_maxWXs}>
                      {record.message}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className={styles.nu_h24}>
                    {loadError ? `Unable to load server DNS data: ${loadError}` : "Server DNS data not available."}
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
