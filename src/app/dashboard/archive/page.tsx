'use client';
import styles from './page.module.css';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { Archive, Inbox, Trash2, Clock } from 'lucide-react';
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

export default function ArchivePage() {
  const { user } = useAuthClient();
  const { toast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const emailIds = useMemo(() => emails.map(e => e.id), [emails]);
  const selection = useEmailSelection(emailIds);

  const fetchArchive = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/emails?folder=archive', {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) setEmails(data.emails || []);
    } catch {} finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchArchive();
  }, [fetchArchive]);

  const handleUnarchive = async (emailId: string) => {
    setActionLoading(emailId);
    try {
      const res = await fetch('/api/emails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId, archived: false })
      });
      if (!res.ok) throw new Error();
      setEmails(prev => prev.filter(e => e.id !== emailId));
      selection.removeIds([emailId]);
      toast({ title: 'Unarchived', description: 'Email moved back to inbox' });
    } catch {
      toast({ title: 'Error', description: 'Failed to unarchive email', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (emailId: string) => {
    setActionLoading(emailId);
    try {
      const res = await fetch('/api/emails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
    return <div className={styles.nu_py8}>You must be signed in to view archive.</div>;
  }

  return (
    <div className={styles.nu_flex}>
      <div className={styles.nu_flex2}>
        <div className={styles.nu_spaceY2}>
          <div className={styles.nu_flex3}>
            <h1 className={styles.nu_text2xl}>Archive</h1>
          </div>
          <p className={styles.nu_textSm}>
            {isLoading ? 'Loading...' : `${emails.length} archived emails`}
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
          { label: 'Unarchive', icon: <Inbox className={styles.nu_h4} />, onClick: () => handleBulkAction({ archived: false }, 'Unarchived') },
          { label: 'Delete', icon: <Trash2 className={styles.nu_h4} />, onClick: () => handleBulkAction({ deleted: true }, 'Deleted'), variant: 'destructive' },
        ]}
      />

      <Card className={styles.nu_flex1}>
        <CardContent className={styles.nu_p0}>
          <div className={styles.nu_flex4}>
            {!isLoading && emails.length > 0 && (
              <div className={styles.nu_flex5}>
                <Checkbox
                  checked={selection.isAllSelected}
                  onCheckedChange={() => selection.isAllSelected ? selection.clearSelection() : selection.selectAll()}
                  aria-label="Select all"
                />
                <span className={styles.nu_textXs}>
                  {selection.selectedCount > 0 ? `${selection.selectedCount} selected` : 'Select all'}
                </span>
              </div>
            )}
            {isLoading && (
              <div className={styles.nu_py12}>
                <LoadingSpinner size="md" text="Loading archive..." />
              </div>
            )}
            {!isLoading && emails.length === 0 && (
              <EmptyState
                icon={<Archive className={styles.nu_h16} />}
                title="Archive is Empty"
                description="Emails you archive will appear here."
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
                <div className={styles.nu_flex6}>
                  <div className={styles.nu_flex7}>
                    <Checkbox
                      checked={selection.isSelected(email.id)}
                      onCheckedChange={() => selection.toggleSelect(email.id)}
                      aria-label={`Select email from ${email.sender}`}
                    />
                  </div>
                  <div className={styles.nu_flex12}>
                    <div className={styles.nu_flex13}>
                      <div className={styles.nu_flex8}>
                        <div className={styles.nu_h6}>
                          <span className={styles.nu_textXs2}>
                            {email.sender.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className={styles.nu_fontMedium}>{email.sender}</span>
                      </div>
                      <h4 className={styles.nu_textSm2}>
                        {email.subject || '(No Subject)'}
                      </h4>
                      <p className={styles.nu_textXs3}>
                        {email.body?.replace(/<[^>]*>/g, '').trim() || 'No content'}
                      </p>
                    </div>
                    <div className={styles.nu_flex9}>
                      <span className={styles.nu_textXs4}>
                        <Clock className={styles.nu_h3} />
                        {new Date(email.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => handleUnarchive(email.id)} disabled={actionLoading === email.id}>
                        <Inbox className={styles.nu_h32} />
                        Unarchive
                      </Button>
                      <Button size="sm" variant="ghost" className={styles.nu_hoverBgDestructive20} onClick={() => handleDelete(email.id)} disabled={actionLoading === email.id}>
                        <Trash2 className={styles.nu_h3} />
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
