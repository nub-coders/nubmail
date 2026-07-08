"use client";
import styles from './page.module.css';

import { PlusCircle, Globe } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { useAuthClient } from '@/lib/auth-provider';
import { useToast } from '@/hooks/use-toast';
import type { Domain } from '@/lib/types';

const formSchema = z.object({
  domainName: z.string().min(3, {
    message: 'Domain name must be at least 3 characters.',
  }).regex(/^[a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/, {
    message: 'Please enter a valid domain name.',
  }),
});

export default function DomainsPage() {
  const { user } = useAuthClient();
  const [isAddDomainOpen, setAddDomainOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { domainName: '' },
  });

  const [domains, setDomains] = useState<Domain[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadDomains = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/domains', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setDomains(data.domains || []);
      else setDomains([]);
    } catch (e) {
      console.error('Load domains failed', e);
      setDomains([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({ title: 'Authentication Error', description: 'You must be logged in to add a domain.', variant: 'destructive' });
      return;
    }

    try {
      const res = await fetch('/api/domains', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domainName: values.domainName }) });
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



  if (!user) {
    return null;
  }

  return (
    <div className={styles.nu_flex3}>
      <div className={styles.nu_flex4}>
        <div>
          <h1 className={styles.nu_text2xl}>Domain Management</h1>
          <p className={styles.nu_textMutedForeground}>Add and manage your custom domains.</p>
        </div>
        <Dialog open={isAddDomainOpen} onOpenChange={setAddDomainOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className={styles.nu_mlAuto}>
              <PlusCircle className={styles.nu_h4} />
              Add Domain
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Domain</DialogTitle>
              <DialogDescription>Enter the domain name you want to add.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className={styles.nu_spaceY4}>
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
            <p className={styles.nu_textCenter}>Loading domains...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>

                </TableRow>
              </TableHeader>
              <TableBody>
                {domains && domains.length > 0 ? (
                  domains.map((item: any) => (
                    <TableRow 
                      key={item.id}
                      className={styles.nu_cursorPointer}
                      onClick={() => router.push(`/dashboard/domains/${item.id}`)}
                    >
                      <TableCell className={styles.nu_fontMedium}>
                        <Globe className={styles.nu_h42} />
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
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className={styles.nu_textCenter2}>No domains added yet.</TableCell>
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
