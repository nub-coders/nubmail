"use client";

import { MoreHorizontal, PlusCircle, Globe, Dna, Copy, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuthClient } from '@/lib/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import type { Domain } from '@/lib/types';

const formSchema = z.object({
  domainName: z.string().min(3, {
    message: 'Domain name must be at least 3 characters.',
  }).regex(/^[a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/, {
    message: 'Please enter a valid domain name.',
  }),
});

function DnsVerificationDialog({ domainName, domainId, verificationToken, onVerify }: { domainName?: string; domainId?: string; verificationToken?: string; onVerify?: (id: string, name: string) => void }) {
  const { toast } = useToast();
  const [verifying, setVerifying] = useState(false);
  const [recordStatus, setRecordStatus] = useState<{ [key: number]: 'verified' | 'failed' | 'checking' | null }>({});
  
  const dnsRecords = [
    {
      type: 'TXT',
      name: '@',
      value: verificationToken ? `nubmail-verification=${verificationToken}` : 'Please add the domain first to get verification token',
      key: 'verification',
    },
    { 
      type: 'MX', 
      name: '@', 
      value: 'mx1.nubmail-server.com', 
      priority: 10,
      key: 'mx1',
    },
    {
      type: 'MX',
      name: '@',
      value: 'mx2.nubmail-server.com',
      priority: 20,
      key: 'mx2',
    },
    {
      type: 'TXT',
      name: '@',
      value: 'v=spf1 include:nubmail-server.com ~all',
      key: 'spf',
    },
    {
      type: 'TXT',
      name: '_dmarc',
      value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@' + (domainName || 'yourdomain.com'),
      key: 'dmarc',
    },
    {
      type: 'TXT',
      name: 'nubmail._domainkey',
      value: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyK3X3Q7JZvHmN8tF5pK9zYvN2MxG4cQ8hJ6nL7mP5tR8sU3vW4xY9zA2bC5dE6fG7hI8jJ3kK4lL5mM6nN7oO8pP9qQ0rR1sS2tT3uU4vV5wW6xX7yY8zA9bB0cC1dD2eE3fF4gG5hH6iI7jJ8kK9lL0mM1nN2oO3pP4qQ5rR6sS7tT8uU9vV0wW1xX2yY3zA4bB5cC6dD7eE8fF9gG0hH1iI2jJ3kK4lL5mM6nN7oO8pP9qQ0rR1sS2tT3uU4vV5wW6xX7yY8zA9bB0cC1dD2eE3fF4gG5hH6iI7jJ8kK9lL0mM1nN2oO3pP4qQ5rR6sS7tT8uU9vV0wIDAQAB',
      key: 'dkim',
    },
  ];

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied to clipboard!' });
    } catch (err) {
      toast({ title: 'Unable to copy', description: 'Clipboard access failed.', variant: 'destructive' });
    }
  };

  const handleVerify = async () => {
    if (!domainId || !domainName || !onVerify) return;
    
    setVerifying(true);
    const checkingStatus: { [key: number]: 'checking' } = {};
    dnsRecords.forEach((_, index) => {
      checkingStatus[index] = 'checking';
    });
    setRecordStatus(checkingStatus);
    
    try {
      await onVerify(domainId, domainName);
      const verifiedStatus: { [key: number]: 'verified' } = {};
      dnsRecords.forEach((_, index) => {
        verifiedStatus[index] = 'verified';
      });
      setRecordStatus(verifiedStatus);
    } catch (error) {
      const failedStatus: { [key: number]: 'failed' } = {};
      dnsRecords.forEach((_, index) => {
        failedStatus[index] = 'failed';
      });
      setRecordStatus(failedStatus);
    } finally {
      setVerifying(false);
    }
  };

  const getStatusIcon = (index: number) => {
    const status = recordStatus[index];
    if (status === 'verified') {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (status === 'failed') {
      return <XCircle className="h-4 w-4 text-red-500" />;
    } else if (status === 'checking') {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    return null;
  };

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Domain Verification Setup</DialogTitle>
        <DialogDescription>
          To verify your domain, add the following DNS records to your domain's DNS settings.
        </DialogDescription>
      </DialogHeader>
      <ScrollArea className="max-h-[60vh] pr-4">
        <div className="space-y-4 py-4">
          {dnsRecords.map((record, index) => (
            <div key={index} className="space-y-2">
              <Label className="font-semibold flex items-center gap-2">
                <Dna className="h-4 w-4" /> {record.type} Record
                <span className="ml-auto">{getStatusIcon(index)}</span>
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] items-center gap-2 text-sm">
                <span className="text-muted-foreground">Type:</span>
                <span>{record.type}</span>
                <span className="text-muted-foreground">Name:</span>
                <code>{record.name}</code>
                <span className="text-muted-foreground">Value:</span>
                <div className="flex items-center gap-2">
                  <code className="truncate">{record.value}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(record.value)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {record.priority && (
                  <>
                    <span className="text-muted-foreground">Priority:</span>
                    <span>{record.priority}</span>
                  </>
                )}
              </div>
              {index < dnsRecords.length - 1 && <Separator className="mt-4" />}
            </div>
          ))}
        </div>
      </ScrollArea>
      <DialogFooter>
        <Button onClick={() => (document.querySelector('[data-radix-dialog-close]') as HTMLElement)?.click()} variant="outline">Close</Button>
        <Button onClick={handleVerify} disabled={verifying || !domainId}>
          {verifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify'
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function DomainsPage() {
  const { user } = useAuthClient();
  const [isAddDomainOpen, setAddDomainOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { domainName: '' },
  });

  const [domains, setDomains] = useState<Domain[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const res = await fetch('/api/domains', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        const data = await res.json();
        if (res.ok) setDomains(data.domains || []);
        else setDomains([]);
      } catch (e) {
        console.error('Load domains failed', e);
        setDomains([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({ title: 'Authentication Error', description: 'You must be logged in to add a domain.', variant: 'destructive' });
      return;
    }

    try {
      const res = await fetch('/api/domains', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ domainName: values.domainName }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add domain');
      form.reset();
      setAddDomainOpen(false);
      setDomains(prev => (prev ? [data, ...prev] : [data]));
      toast({ title: 'Domain added successfully!', description: `Your domain ${values.domainName} has been added.` });
    } catch (error: any) {
      console.error('Error adding domain: ', error);
      toast({ title: 'Error adding domain', description: error?.message ?? 'An unexpected error occurred.', variant: 'destructive' });
    }
  };

  const handleVerifyDomain = async (domainId: string, domainName: string) => {
    const res = await fetch('/api/domains', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ domainId, action: 'verify' })
    });

    const data = await res.json();
    if (!res.ok) {
      toast({ title: 'Verification failed', description: data.message || data.error || 'Could not verify domain', variant: 'destructive' });
      throw new Error(data.message || data.error || 'Verification failed');
    }

    setDomains(prev => prev?.map(d => 
      d.id === domainId ? { ...d, verificationStatus: 'verified' } : d
    ) || null);

    toast({ title: 'Domain verified!', description: `${domainName} has been verified successfully.` });
  };

  const handleDeleteDomain = async (domainId: string, domainName: string) => {
    if (!confirm(`Are you sure you want to delete ${domainName}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/domains?id=${domainId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete domain');

      setDomains(prev => prev?.filter(d => d.id !== domainId) || null);
      toast({ title: 'Domain deleted', description: `${domainName} has been removed.` });
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({ title: 'Delete failed', description: error.message || 'Could not delete domain', variant: 'destructive' });
    }
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Domain Management</CardTitle>
          <CardDescription>You must be signed in to manage domains.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-muted-foreground">Please sign in to add and manage custom domains.</p>
            <div className="flex w-full max-w-xs gap-2">
              <Link href="/register" className="w-full">
                <Button className="w-full">Sign up</Button>
              </Link>
              <Link href="/" className="w-full">
                <Button variant="outline" className="w-full">Sign in</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Domain Management</h1>
          <p className="text-muted-foreground">Add and manage your custom domains.</p>
        </div>
        <Dialog open={isAddDomainOpen} onOpenChange={setAddDomainOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="ml-auto gap-1">
              <PlusCircle className="h-4 w-4" />
              Add Domain
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Domain</DialogTitle>
              <DialogDescription>Enter the domain name you want to add.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="domainName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Domain Name</FormLabel>
                      <FormControl>
                        <Input placeholder="example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAddDomainOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Adding...' : 'Add Domain'}</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Domains</CardTitle>
          <CardDescription>An overview of all your registered domains and their verification status.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground">Loading domains...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains && domains.length > 0 ? (
                  domains.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        {item.domainName}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={item.verificationStatus === 'verified' ? 'default' : item.verificationStatus === 'pending' ? 'secondary' : 'destructive'}
                          className={item.verificationStatus === 'verified' ? 'bg-green-500/20 text-green-700 border-green-500/30' : ''}
                        >
                          {item.verificationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Dialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button aria-haspopup="true" size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Toggle menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DialogTrigger asChild>
                                <DropdownMenuItem>View DNS Setup</DropdownMenuItem>
                              </DialogTrigger>
                              <DropdownMenuItem 
                                className="text-destructive" 
                                onClick={() => handleDeleteDomain(item.id, item.domainName)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <DnsVerificationDialog 
                            domainName={item.domainName} 
                            domainId={item.id}
                            verificationToken={item.verificationToken}
                            onVerify={handleVerifyDomain}
                          />
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">No domains added yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
