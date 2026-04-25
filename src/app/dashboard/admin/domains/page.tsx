"use client";

import { useEffect, useState } from 'react';
import { MoreHorizontal, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
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
  DropdownMenuSeparator,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuthClient } from '@/lib/auth-provider';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';

interface Domain {
  id: string;
  domainName: string;
  verificationStatus: 'pending' | 'verified' | 'failed';
  userId: string;
  userEmail: string;
  createdAt: string;
}

export default function AdminDomainsPage() {
  const { user } = useAuthClient();
  const router = useRouter();
  const { toast } = useToast();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDomain, setDeleteDomain] = useState<Domain | null>(null);

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/domains', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (res.status === 403) {
        toast({
          title: 'Access Denied',
          description: 'You do not have admin privileges',
          variant: 'destructive'
        });
        router.push('/dashboard');
        return;
      }

      const data = await res.json();
      if (res.ok) {
        setDomains(data.domains || []);
      }
    } catch (error) {
      console.error('Error fetching domains:', error);
      toast({
        title: 'Error',
        description: 'Failed to load domains',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const handleUpdateStatus = async (domainId: string, newStatus: 'pending' | 'verified' | 'failed') => {
    try {
      const res = await fetch('/api/admin/domains', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ domainId, verificationStatus: newStatus })
      });

      const data = await res.json();

      if (res.ok) {
        toast({
          title: 'Success',
          description: `Domain status updated to ${newStatus}`
        });
        fetchDomains();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to update domain',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update domain',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteDomain = async () => {
    if (!deleteDomain) return;

    try {
      const res = await fetch(`/api/admin/domains?domainId=${deleteDomain.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      const data = await res.json();

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Domain deleted successfully'
        });
        fetchDomains();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete domain',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete domain',
        variant: 'destructive'
      });
    } finally {
      setDeleteDomain(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Verified
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Domain Management</h1>
        <p className="text-muted-foreground">Manage all domains across all users</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Domains</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : `${domains.length} total domains`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Loading domains...
                  </TableCell>
                </TableRow>
              ) : domains.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    No domains found
                  </TableCell>
                </TableRow>
              ) : (
                domains.map((domain) => (
                  <TableRow key={domain.id}>
                    <TableCell className="font-medium">{domain.domainName}</TableCell>
                    <TableCell>{domain.userEmail}</TableCell>
                    <TableCell>{getStatusBadge(domain.verificationStatus)}</TableCell>
                    <TableCell>
                      {format(new Date(domain.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleUpdateStatus(domain.id, 'verified')}
                            disabled={domain.verificationStatus === 'verified'}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark as Verified
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleUpdateStatus(domain.id, 'pending')}
                            disabled={domain.verificationStatus === 'pending'}
                          >
                            <AlertCircle className="mr-2 h-4 w-4" />
                            Mark as Pending
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleUpdateStatus(domain.id, 'failed')}
                            disabled={domain.verificationStatus === 'failed'}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Mark as Failed
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteDomain(domain)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Domain
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteDomain} onOpenChange={() => setDeleteDomain(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the domain <strong>{deleteDomain?.domainName}</strong> and all associated email accounts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDomain} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Domain
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
