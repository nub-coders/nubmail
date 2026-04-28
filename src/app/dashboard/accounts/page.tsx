"use client";

import React, { useState, useEffect } from 'react';
import { PlusCircle, Mail, Trash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuthClient } from '@/lib/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import type { Domain } from '@/lib/types';

interface EmailAccount {
  id: string;
  emailAddress: string;
  storageQuota: number;
  domainId: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  createdAt: string;
}

export default function AccountsPage() {
  const { user, token, loading: authLoading } = useAuthClient();
  const { toast } = useToast();
  const [dataLoading, setDataLoading] = useState(false);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [localPart, setLocalPart] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [useCustomSmtp, setUseCustomSmtp] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [serverDomain, setServerDomain] = useState<string | null>(null);
  const [serverDnsVerified, setServerDnsVerified] = useState(false);
  const [useServerDomain, setUseServerDomain] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!token || authLoading) return;
      
      setDataLoading(true);
      try {
        const [accountsRes, domainsRes, meRes] = await Promise.all([
          fetch('/api/accounts', { 
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store'
          }),
          fetch('/api/domains', { 
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store'
          }),
          fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store'
          })
        ]);

        if (!accountsRes.ok || !domainsRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const accountsData = await accountsRes.json();
        const domainsData = await domainsRes.json();
        const meData = meRes.ok ? await meRes.json() : null;

        setAccounts(accountsData.accounts || []);
        const verifiedDomains = domainsData.domains?.filter((d: Domain) => d.verificationStatus === 'verified') || [];
        setDomains(verifiedDomains);
        
        // Check if user is admin
        if (meData?.user?.isAdmin) {
          setIsAdmin(true);
          // Fetch server DNS status for admins
          const serverDnsRes = await fetch('/api/admin/server-dns', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store'
          });
          if (serverDnsRes.ok) {
            const serverDnsData = await serverDnsRes.json();
            setServerDomain(serverDnsData.primaryDomain);
            // Check if critical DNS records are configured
            const mxRecord = serverDnsData.records?.find((r: any) => r.type === 'MX');
            const aRecord = serverDnsData.records?.find((r: any) => r.type === 'A' && r.key === 'mail-a');
            const dnsVerified = mxRecord?.status === 'configured' && aRecord?.status === 'configured';
            setServerDnsVerified(dnsVerified);
          }
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load accounts and domains',
          variant: 'destructive'
        });
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [token, authLoading, toast]);

  const handleCreateAccount = async () => {
    if (!localPart) {
      toast({ title: 'Missing username', description: 'Please enter a username', variant: 'destructive' });
      return;
    }
    
    if (!useServerDomain && !selectedDomainId) {
      toast({ title: 'Missing domain', description: 'Please select a domain', variant: 'destructive' });
      return;
    }

    const hasPartialSmtp = useCustomSmtp && !!(smtpHost || smtpPort || smtpUser || smtpPass);
    const hasCompleteSmtp = !!(smtpHost && smtpPort && smtpUser && smtpPass);

    if (useCustomSmtp) {
      if (!hasCompleteSmtp) {
        toast({ title: 'Incomplete SMTP settings', description: 'Either fill all SMTP fields or disable custom SMTP to use NubMail defaults.', variant: 'destructive' });
        return;
      }
    } else if (hasPartialSmtp) {
      toast({ title: 'Incomplete SMTP settings', description: 'Either fill all SMTP fields or disable custom SMTP to use NubMail defaults.', variant: 'destructive' });
      return;
    }

    let emailAddress: string;
    if (useServerDomain) {
      emailAddress = `${localPart}@${serverDomain}`;
    } else {
      const selectedDomain = domains.find(d => d.id === selectedDomainId);
      if (!selectedDomain) return;
      emailAddress = `${localPart}@${selectedDomain.domainName}`;
    }

    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          emailAddress,
          domainId: useServerDomain ? null : selectedDomainId,
          useServerDomain,
          ...(useCustomSmtp && smtpHost && smtpPort && smtpUser && smtpPass ? {
            smtpHost,
            smtpPort,
            smtpUser,
            smtpPass
          } : {})
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create account');

      setAccounts(prev => [data, ...prev]);
      toast({ title: 'Account created!', description: `${emailAddress} has been created.` });
      setIsDialogOpen(false);
      setLocalPart('');
      setSelectedDomainId('');
      setUseCustomSmtp(false);
      setUseServerDomain(false);
      setSmtpHost('');
      setSmtpPort('587');
      setSmtpUser('');
      setSmtpPass('');
    } catch (error: any) {
      console.error('Create account error:', error);
      toast({ title: 'Failed to create account', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteAccount = async (accountId: string, emailAddress: string) => {
    if (!confirm(`Are you sure you want to delete ${emailAddress}?`)) return;

    try {
      const res = await fetch(`/api/accounts?id=${accountId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete account');

      setAccounts(prev => prev.filter(a => a.id !== accountId));
      toast({ title: 'Account deleted', description: `${emailAddress} has been removed.` });
    } catch (error: any) {
      console.error('Delete account error:', error);
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    }
  };

  if (authLoading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-4">Email Accounts</h1>
        <div className="animate-pulse">
          <div className="h-12 bg-muted rounded mb-4"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!user || !token) {
    return <div className="py-8 text-center">You must be signed in to manage accounts.</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Email Accounts</h1>
          <p className="text-muted-foreground">Manage email accounts for your verified domains.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!isAdmin && domains.length === 0}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Email Account</DialogTitle>
              <DialogDescription>
                Create a new email account. SMTP settings are optional - leave them empty to use NubMail&apos;s built-in SMTP server.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid gap-2">
                <Label htmlFor="localpart">Username</Label>
                <Input
                  id="localpart"
                  placeholder="info, support, hello"
                  value={localPart}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalPart(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                />
              </div>
              
              {isAdmin && serverDomain && serverDnsVerified && (
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="useServerDomain"
                      checked={useServerDomain}
                      onCheckedChange={(checked) => {
                        setUseServerDomain(Boolean(checked));
                        if (checked) {
                          setSelectedDomainId('');
                        }
                      }}
                    />
                    <Label htmlFor="useServerDomain" className="font-medium">
                      Use server domain ({serverDomain})
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    Admin option: Create accounts on the verified server domain without manually adding it.
                  </p>
                </div>
              )}
              
              {!useServerDomain && (
                <div className="grid gap-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a domain" />
                    </SelectTrigger>
                    <SelectContent>
                      {domains.map(domain => (
                        <SelectItem key={domain.id} value={domain.id}>
                          @{domain.domainName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {localPart && (useServerDomain ? serverDomain : selectedDomainId) && (
                <div className="text-sm text-muted-foreground">
                  Email address: <span className="font-medium">
                    {localPart}@{useServerDomain ? serverDomain : domains.find(d => d.id === selectedDomainId)?.domainName}
                  </span>
                </div>
              )}
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="useCustomSmtp"
                    checked={useCustomSmtp}
                    onCheckedChange={(checked) => {
                      const enabled = Boolean(checked);
                      setUseCustomSmtp(enabled);
                      if (!enabled) {
                        setSmtpHost('');
                        setSmtpPort('587');
                        setSmtpUser('');
                        setSmtpPass('');
                      }
                    }}
                  />
                  <div>
                    <Label htmlFor="useCustomSmtp" className="font-medium">
                      Use custom SMTP settings
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Leave disabled to use NubMail&apos;s built-in SMTP server. Enable to provide your own SMTP credentials.
                    </p>
                  </div>
                </div>

                {useCustomSmtp && (
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="smtpHost">SMTP Host</Label>
                      <Input
                        id="smtpHost"
                        placeholder="smtp.example.com"
                        value={smtpHost}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmtpHost(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="smtpPort">SMTP Port</Label>
                      <Input
                        id="smtpPort"
                        type="number"
                        placeholder="587"
                        value={smtpPort}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmtpPort(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="smtpUser">SMTP Username</Label>
                      <Input
                        id="smtpUser"
                        placeholder="username or email"
                        value={smtpUser}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmtpUser(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="smtpPass">SMTP Password</Label>
                      <Input
                        id="smtpPass"
                        type="password"
                        placeholder="••••••••"
                        value={smtpPass}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmtpPass(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateAccount}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Email Accounts</CardTitle>
          <CardDescription>
            {domains.length === 0 
              ? 'You need to verify a domain before creating email accounts.' 
              : 'Manage your email accounts below.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dataLoading ? (
            <div className="py-6 text-center">Loading accounts...</div>
          ) : accounts.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              {domains.length === 0 
                ? 'Please add and verify a domain first.' 
                : 'No email accounts created yet.'}
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map(account => (
                <div key={account.id} className="flex items-center justify-between p-4 border border-border/40 rounded-xl hover:bg-muted/30 transition-colors duration-150">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{account.emailAddress}</div>
                      <div className="text-sm text-muted-foreground">
                        {account.storageQuota}MB storage
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteAccount(account.id, account.emailAddress)}
                  >
                    <Trash className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
