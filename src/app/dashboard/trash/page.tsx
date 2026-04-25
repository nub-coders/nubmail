'use client';

import { useEffect, useState, useMemo } from 'react';
import { Trash2, RotateCcw, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuthClient } from '@/lib/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { useEmailSelection } from '@/hooks/use-email-selection';
import { BulkActionBar } from '@/components/bulk-action-bar';
import { bulkPatchEmails, bulkDeleteEmails } from '@/lib/bulk-email-actions';
import { cn } from '@/lib/utils';

interface Email {
  id: string;
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  sentAt: string;
  deletedAt: string;
}

export default function TrashPage() {
  const { user } = useAuthClient();
  const { toast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const emailIds = useMemo(() => emails.map(e => e.id), [emails]);
  const selection = useEmailSelection(emailIds);

  const fetchTrash = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/emails?folder=trash', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok) setEmails(data.emails || []);
    } catch {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchTrash();
  }, [user]);

  const handleRestore = async (emailId: string) => {
    setActionLoading(emailId);
    try {
      const res = await fetch('/api/emails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ emailId, deleted: false })
      });
      if (!res.ok) throw new Error();
      setEmails(prev => prev.filter(e => e.id !== emailId));
      selection.removeIds([emailId]);
      toast({ title: 'Restored', description: 'Email moved back to inbox' });
    } catch {
      toast({ title: 'Error', description: 'Failed to restore email', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (emailId: string) => {
    setActionLoading(emailId);
    try {
      const res = await fetch(`/api/emails?emailId=${emailId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error();
      setEmails(prev => prev.filter(e => e.id !== emailId));
      selection.removeIds([emailId]);
      toast({ title: 'Deleted', description: 'Email permanently deleted' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete email', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEmptyTrash = async () => {
    setActionLoading('empty');
    try {
      await Promise.all(emails.map(e =>
        fetch(`/api/emails?emailId=${e.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
      ));
      setEmails([]);
      selection.clearSelection();
      toast({ title: 'Trash emptied', description: 'All emails permanently deleted' });
    } catch {
      toast({ title: 'Error', description: 'Failed to empty trash', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkRestore = async () => {
    setBulkLoading(true);
    try {
      const { success, failed } = await bulkPatchEmails(selection.selectedArray, { deleted: false });
      if (success > 0) {
        setEmails(prev => prev.filter(e => !selection.isSelected(e.id)));
        selection.clearSelection();
      }
      toast({ title: 'Restored', description: failed > 0 ? `${success} succeeded, ${failed} failed` : `${success} emails restored` });
    } catch {
      toast({ title: 'Error', description: 'Failed to restore emails', variant: 'destructive' });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkPermanentDelete = async () => {
    setBulkLoading(true);
    try {
      const { success, failed } = await bulkDeleteEmails(selection.selectedArray);
      if (success > 0) {
        setEmails(prev => prev.filter(e => !selection.isSelected(e.id)));
        selection.clearSelection();
      }
      toast({ title: 'Deleted', description: failed > 0 ? `${success} succeeded, ${failed} failed` : `${success} emails permanently deleted` });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete emails', variant: 'destructive' });
    } finally {
      setBulkLoading(false);
    }
  };

  if (!user) {
    return <div className="py-8 text-center">You must be signed in to view trash.</div>;
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Trash</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading...' : `${emails.length} deleted emails`}
          </p>
        </div>
        {emails.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={actionLoading === 'empty'}>
                <Trash2 className="h-4 w-4 mr-2" />
                Empty Trash
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Empty Trash?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all {emails.length} emails in trash. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleEmptyTrash} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <BulkActionBar
        selectedCount={selection.selectedCount}
        totalCount={emails.length}
        isAllSelected={selection.isAllSelected}
        onSelectAll={selection.selectAll}
        onClearSelection={selection.clearSelection}
        loading={bulkLoading}
        actions={[
          { label: 'Restore', icon: <RotateCcw className="h-4 w-4" />, onClick: handleBulkRestore },
          { label: 'Delete Forever', icon: <Trash2 className="h-4 w-4" />, onClick: handleBulkPermanentDelete, variant: 'destructive' },
        ]}
      />

      <Card className="flex-1 border border-border/40 shadow-card bg-card">
        <CardContent className="p-0">
          <div className="flex flex-col">
            {!isLoading && emails.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 border-b border-border/30 bg-muted/20">
                <Checkbox
                  checked={selection.isAllSelected}
                  onCheckedChange={() => selection.isAllSelected ? selection.clearSelection() : selection.selectAll()}
                  aria-label="Select all"
                />
                <span className="text-xs text-muted-foreground">
                  {selection.selectedCount > 0 ? `${selection.selectedCount} selected` : 'Select all'}
                </span>
              </div>
            )}
            {isLoading && (
              <div className="py-12">
                <LoadingSpinner size="md" text="Loading trash..." />
              </div>
            )}
            {!isLoading && emails.length === 0 && (
              <EmptyState
                icon={<Trash2 className="h-16 w-16" />}
                title="Trash is Empty"
                description="When you delete an email, it will appear here."
              />
            )}
            {emails.map((email) => (
              <div
                key={email.id}
                className={cn(
                  'group relative border-b border-border/30 last:border-b-0 transition-colors duration-150',
                  'hover:bg-muted/40',
                  selection.isSelected(email.id) && 'bg-primary/10'
                )}
              >
                <div className="flex items-start gap-0">
                  <div className="flex items-center px-3 pt-4">
                    <Checkbox
                      checked={selection.isSelected(email.id)}
                      onCheckedChange={() => selection.toggleSelect(email.id)}
                      aria-label={`Select email from ${email.sender}`}
                    />
                  </div>
                  <div className="flex-1 flex items-start justify-between gap-4 p-4 pl-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate text-foreground/80">{email.sender}</span>
                      </div>
                      <h4 className="text-sm font-medium text-foreground/90 line-clamp-1">
                        {email.subject || '(No Subject)'}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                        {email.body?.replace(/<[^>]*>/g, '').trim() || 'No content'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(email.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => handleRestore(email.id)} disabled={actionLoading === email.id}>
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Restore
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive" disabled={actionLoading === email.id}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
                            <AlertDialogDescription>This email will be permanently deleted. This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handlePermanentDelete(email.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
