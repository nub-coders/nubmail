"use client";

import { useState, useEffect } from 'react';
import { PlusCircle, Mail, Trash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuthClient } from '@/lib/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import type { Domain } from '@/lib/types';

interface EmailAccount {
  id: string;
  emailAddress: string;
  storageQuota: number;
  domainId: string;
  createdAt: string;
}

export default function AccountsPage() {
  const { user } = useAuthClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [localPart, setLocalPart] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const [accountsRes, domainsRes] = await Promise.all([
          fetch('/api/accounts', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
          fetch('/api/domains', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        ]);

        const accountsData = await accountsRes.json();
        const domainsData = await domainsRes.json();

        if (accountsRes.ok) setAccounts(accountsData.accounts || []);
        if (domainsRes.ok) {
          const verifiedDomains = domainsData.domains?.filter((d: Domain) => d.verificationStatus === 'verified') || [];
          setDomains(verifiedDomains);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleCreateAccount = async () => {
    if (!localPart || !selectedDomainId) {
      toast({ title: 'Missing fields', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    const selectedDomain = domains.find(d => d.id === selectedDomainId);
    if (!selectedDomain) return;

    const emailAddress = `${localPart}@${selectedDomain.domainName}`;

    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ emailAddress, domainId: selectedDomainId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create account');

      setAccounts(prev => [data, ...prev]);
      toast({ title: 'Account created!', description: `${emailAddress} has been created.` });
      setIsDialogOpen(false);
      setLocalPart('');
      setSelectedDomainId('');
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

  if (!user) {
    return <div className="py-8 text-center">You must be signed in to manage accounts.</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Accounts</h1>
          <p className="text-muted-foreground">Manage email accounts for your verified domains.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={domains.length === 0}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Email Account</DialogTitle>
              <DialogDescription>
                Create a new email account on one of your verified domains.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="localpart">Username</Label>
                <Input
                  id="localpart"
                  placeholder="info, support, hello"
                  value={localPart}
                  onChange={(e) => setLocalPart(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                />
              </div>
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
              {localPart && selectedDomainId && (
                <div className="text-sm text-muted-foreground">
                  Email address: <span className="font-medium">{localPart}@{domains.find(d => d.id === selectedDomainId)?.domainName}</span>
                </div>
              )}
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
          {loading ? (
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
                <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
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
