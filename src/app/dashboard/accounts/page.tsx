"use client";
import styles from './page.module.css';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, Mail, Trash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuthClient } from '@/lib/auth-provider';
import { useToast } from '@/hooks/use-toast';
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
  const router = useRouter();
  const { user, loading: authLoading } = useAuthClient();
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
      if (!user || authLoading) return;
      
      setDataLoading(true);
      try {
        const [accountsRes, domainsRes, meRes] = await Promise.all([
          fetch('/api/accounts', { 
            credentials: 'include',
            cache: 'no-store'
          }),
          fetch('/api/domains', { 
            credentials: 'include',
            cache: 'no-store'
          }),
          fetch('/api/auth/me', {
            credentials: 'include',
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
            credentials: 'include',
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
  }, [user, authLoading, toast]);

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
        credentials: 'include'
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

  if (!user) {
    if (authLoading) {
      return (
        <div className={styles.nu_container}>
          <h1 className={styles.nu_text2xl}>Email Accounts</h1>
          <div className={styles.nu_animatePulse}>
            <div className={styles.nu_h12}></div>
            <div className={styles.nu_h32}></div>
          </div>
        </div>
      );
    }
    router.push('/login');
    return null;
  }

  return (
    <div className={styles.nu_flex}>
      <div className={styles.nu_flex2}>
        <div>
          <h1 className={styles.nu_text2xl2}>Email Accounts</h1>
          <p className={styles.nu_textMutedForeground}>Manage email accounts for your verified domains.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!isAdmin && domains.length === 0}>
              <PlusCircle className={styles.nu_mr2} />
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
            <div className={styles.nu_grid}>
              <div className={styles.nu_grid2}>
                <Label htmlFor="localpart">Username</Label>
                <Input
                  id="localpart"
                  placeholder="info, support, hello"
                  value={localPart}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalPart(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                />
              </div>
              
              {isAdmin && serverDomain && serverDnsVerified && (
                <div className={styles.nu_grid2}>
                  <div className={styles.nu_flex3}>
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
                    <Label htmlFor="useServerDomain" className={styles.nu_fontMedium}>
                      Use server domain ({serverDomain})
                    </Label>
                  </div>
                  <p className={styles.nu_textXs}>
                    Admin option: Create accounts on the verified server domain without manually adding it.
                  </p>
                </div>
              )}
              
              {!useServerDomain && (
                <div className={styles.nu_grid2}>
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
                <div className={styles.nu_textSm}>
                  Email address: <span className={styles.nu_fontMedium}>
                    {localPart}@{useServerDomain ? serverDomain : domains.find(d => d.id === selectedDomainId)?.domainName}
                  </span>
                </div>
              )}
              <div className={styles.nu_borderT}>
                <div className={styles.nu_flex4}>
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
                    <Label htmlFor="useCustomSmtp" className={styles.nu_fontMedium}>
                      Use custom SMTP settings
                    </Label>
                    <p className={styles.nu_textSm}>
                      Leave disabled to use NubMail&apos;s built-in SMTP server. Enable to provide your own SMTP credentials.
                    </p>
                  </div>
                </div>

                {useCustomSmtp && (
                  <div className={styles.nu_grid3}>
                    <div className={styles.nu_grid2}>
                      <Label htmlFor="smtpHost">SMTP Host</Label>
                      <Input
                        id="smtpHost"
                        placeholder="smtp.example.com"
                        value={smtpHost}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmtpHost(e.target.value)}
                      />
                    </div>
                    <div className={styles.nu_grid2}>
                      <Label htmlFor="smtpPort">SMTP Port</Label>
                      <Input
                        id="smtpPort"
                        type="number"
                        placeholder="587"
                        value={smtpPort}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmtpPort(e.target.value)}
                      />
                    </div>
                    <div className={styles.nu_grid2}>
                      <Label htmlFor="smtpUser">SMTP Username</Label>
                      <Input
                        id="smtpUser"
                        placeholder="username or email"
                        value={smtpUser}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSmtpUser(e.target.value)}
                      />
                    </div>
                    <div className={styles.nu_grid2}>
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
            <div className={styles.nu_py6}>Loading accounts...</div>
          ) : accounts.length === 0 ? (
            <div className={styles.nu_py62}>
              {domains.length === 0 
                ? 'Please add and verify a domain first.' 
                : 'No email accounts created yet.'}
            </div>
          ) : (
            <div className={styles.nu_spaceY2}>
              {accounts.map(account => (
                <div key={account.id} className={styles.nu_flex5}>
                  <div className={styles.nu_flex6}>
                    <Mail className={styles.nu_h5} />
                    <div>
                      <div className={styles.nu_fontMedium}>{account.emailAddress}</div>
                      <div className={styles.nu_textSm}>
                        {account.storageQuota}MB storage
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteAccount(account.id, account.emailAddress)}
                  >
                    <Trash className={styles.nu_h4} />
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
