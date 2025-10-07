"use client";

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthClient } from '@/lib/auth-provider';

type Result = { check: string; ok: boolean; details?: string };

export default function AdminServerPage() {
  const { token } = useAuthClient();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/server/dns', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setResults(data.results || []);
      setConfig(data.config || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  const domain = config?.mailHostname || '';
  const apex = config?.rootDomain || '';

  // Suggested records for our own server only
  const suggested = [
    { name: domain, type: 'A', value: config?.serverPublicIp || '<your-server-ip>' },
    { name: apex, type: 'TXT', value: `v=spf1 a:${domain} mx ~all` },
    { name: `mail._domainkey.${apex}`, type: 'TXT', value: 'DKIM public key (selector: mail)' },
    { name: `_dmarc.${apex}`, type: 'TXT', value: 'v=DMARC1; p=none; rua=mailto:postmaster@' + apex },
  ];

  function isSuggestedVerified(rec: { name: string; type: string }) {
    if (!results || results.length === 0) return false;
    const checks = {
      A: `A ${domain}`,
      SPF: `SPF ${apex}`,
      DKIM: `DKIM mail._domainkey.${apex}`,
      DMARC: `DMARC _dmarc.${apex}`,
    };
    if (rec.type === 'A') {
      return !!results.find((r) => r.check === checks.A && r.ok);
    }
    // Heuristic based on check label prefixes
    if (rec.name === apex && rec.type === 'TXT') {
      return !!results.find((r) => r.check === checks.SPF && r.ok);
    }
    if (rec.name.startsWith('mail._domainkey') && rec.type === 'TXT') {
      return !!results.find((r) => r.check === checks.DKIM && r.ok);
    }
    if (rec.name.startsWith('_dmarc.') && rec.type === 'TXT') {
      return !!results.find((r) => r.check === checks.DMARC && r.ok);
    }
    return false;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Server Configuration</CardTitle>
          <CardDescription>DNS verification for this server only. Add the records below, then re-run checks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Root domain: <span className="font-medium">{config?.rootDomain}</span> · Mail host: <span className="font-medium">{config?.mailHostname}</span> · DKIM selector: <span className="font-medium">{config?.dkimSelector}</span>
            </div>
            <Button size="sm" onClick={load} disabled={loading}>{loading ? 'Checking…' : 'Re-run checks'}</Button>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Required DNS records</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Host</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Verified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggested.map((rec, i) => {
                  const ok = isSuggestedVerified(rec);
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{rec.name}</TableCell>
                      <TableCell>{rec.type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{rec.value}</TableCell>
                      <TableCell>{ok ? <Badge variant="default">OK</Badge> : <Badge variant="destructive">Missing</Badge>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Check</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.check}</TableCell>
                  <TableCell>{r.ok ? <Badge variant="default">OK</Badge> : <Badge variant="destructive">Fail</Badge>}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{r.details || ''}</TableCell>
                </TableRow>
              ))}
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-sm text-muted-foreground">No results yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


