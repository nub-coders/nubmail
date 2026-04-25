'use client';

import { useEffect, useState, useMemo } from 'react';
import { Shield, Inbox, Trash2, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuthClient } from '@/lib/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { useEmailSelection } from '@/hooks/use-email-selection';
import { BulkActionBar } from '@/components/bulk-action-bar';
import { bulkPatchEmails } from '@/lib/bulk-email-actions';
import { cn } from '@/lib/utils';

interface Email {
  id: string;
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  sentAt: string;
}

export default function SpamPage() {
  const { user } = useAuthClient();
  const { toast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const emailIds = useMemo(() => emails.map(e => e.id), [emails]);
  const selection = useEmailSelection(emailIds);

  const fetchSpam = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/emails?folder=spam', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok) setEmails(data.emails || []);
    } catch {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchSpam();
  }, [user]);

  const handleNotSpam = async (emailId: string) => {
    setActionLoading(emailId);
    try {
      const res = await fetch('/api/emails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ emailId, spam: false })
      });
      if (!res.ok) throw new Error();
      setEmails(prev => prev.filter(e => e.id !== emailId));
      selection.removeIds([emailId]);
      toast({ title: 'Moved to Inbox', description: 'Email marked as not spam' });
    } catch {
      toast({ title: 'Error', description: 'Failed to update email', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (emailId: string) => {
    setActionLoading(emailId);
    try {
      const res = await fetch('/api/emails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ emailId, deleted: true })
      });
      if (!res.ok) throw new Error();
      setEmails(prev => prev.filter(e => e.id !== emailId));
      selection.removeIds([emailId]);
      toast({ title: 'Deleted', description: 'Email moved to trash' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete email', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async (fields: Record<string, unknown>, label: string) => {
    setBulkLoading(true);
    try {
      const { success, failed } = await bulkPatchEmails(selection.selectedArray, fields);
      if (success > 0) {
        setEmails(prev => prev.filter(e => !selection.isSelected(e.id)));
        selection.clearSelection();
      }
      toast({ title: label, description: failed > 0 ? `${success} succeeded, ${failed} failed` : `${success} emails updated` });
    } catch {
      toast({ title: 'Error', description: `Failed to ${label.toLowerCase()}`, variant: 'destructive' });
    } finally {
      setBulkLoading(false);
    }
  };

  if (!user) {
    return <div className="py-8 text-center">You must be signed in to view spam.</div>;
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Spam</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading...' : `${emails.length} emails marked as spam`}
          </p>
        </div>
      </div>

      <BulkActionBar
        selectedCount={selection.selectedCount}
        totalCount={emails.length}
        isAllSelected={selection.isAllSelected}
        onSelectAll={selection.selectAll}
        onClearSelection={selection.clearSelection}
        loading={bulkLoading}
        actions={[
          { label: 'Not Spam', icon: <Inbox className="h-4 w-4" />, onClick: () => handleBulkAction({ spam: false }, 'Moved to Inbox') },
          { label: 'Delete', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleBulkAction({ deleted: true }, 'Deleted'), variant: 'destructive' },
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
                <LoadingSpinner size="md" text="Loading spam..." />
              </div>
            )}
            {!isLoading && emails.length === 0 && (
              <EmptyState
                icon={<Shield className="h-16 w-16" />}
                title="Spam Folder is Empty"
                description="Emails identified as spam will be moved here."
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleNotSpam(email.id)}
                        disabled={actionLoading === email.id}
                      >
                        <Inbox className="h-3 w-3 mr-1" />
                        Not Spam
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="hover:bg-destructive/20"
                        onClick={() => handleDelete(email.id)}
                        disabled={actionLoading === email.id}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
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
