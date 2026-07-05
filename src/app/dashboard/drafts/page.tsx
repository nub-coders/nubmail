'use client';
import styles from './page.module.css';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Trash2, Clock, Edit } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuthClient } from '@/lib/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { useEmailSelection } from '@/hooks/use-email-selection';
import { BulkActionBar } from '@/components/bulk-action-bar';
import { bulkDeleteDrafts } from '@/lib/bulk-email-actions';
import { cn } from '@/lib/utils';

interface Draft {
  id: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export default function DraftsPage() {
  const router = useRouter();
  const { user } = useAuthClient();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const draftIds = useMemo(() => drafts.map(d => d.id), [drafts]);
  const selection = useEmailSelection(draftIds);

  const fetchDrafts = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/drafts', {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) setDrafts(data.drafts || []);
    } catch {} finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const handleEdit = (draft: Draft) => {
    router.push(`/dashboard/compose?draftId=${draft.id}`);
  };

  const handleDelete = async (draftId: string) => {
    setDeletingId(draftId);
    try {
      const res = await fetch(`/api/drafts?id=${draftId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error();
      setDrafts(prev => prev.filter(d => d.id !== draftId));
      selection.removeIds([draftId]);
      toast({ title: 'Deleted', description: 'Draft deleted' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete draft', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    setBulkLoading(true);
    try {
      const { success, failed } = await bulkDeleteDrafts(selection.selectedArray);
      if (success > 0) {
        setDrafts(prev => prev.filter(d => !selection.isSelected(d.id)));
        selection.clearSelection();
      }
      toast({ title: 'Deleted', description: failed > 0 ? `${success} succeeded, ${failed} failed` : `${success} drafts deleted` });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete drafts', variant: 'destructive' });
    } finally {
      setBulkLoading(false);
    }
  };

  if (!user) {
    return <div className={styles.nu_py8}>You must be signed in to view drafts.</div>;
  }

  return (
    <div className={styles.nu_flex}>
      <div className={styles.nu_flex2}>
        <div className={styles.nu_spaceY2}>
          <div className={styles.nu_flex3}>
            <h1 className={styles.nu_text2xl}>Drafts</h1>
          </div>
          <p className={styles.nu_textSm}>
            {isLoading ? 'Loading...' : `${drafts.length} saved drafts`}
          </p>
        </div>
      </div>

      <BulkActionBar
        selectedCount={selection.selectedCount}
        totalCount={drafts.length}
        isAllSelected={selection.isAllSelected}
        onSelectAll={selection.selectAll}
        onClearSelection={selection.clearSelection}
        loading={bulkLoading}
        actions={[
          { label: 'Delete', icon: <Trash2 className={styles.nu_h4} />, onClick: handleBulkDelete, variant: 'destructive' },
        ]}
      />

      <Card className={styles.nu_flex1}>
        <CardContent className={styles.nu_p0}>
          <div className={styles.nu_flex4}>
            {!isLoading && drafts.length > 0 && (
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
                <LoadingSpinner size="md" text="Loading drafts..." />
              </div>
            )}
            {!isLoading && drafts.length === 0 && (
              <EmptyState
                icon={<FileText className={styles.nu_h16} />}
                title="No Drafts"
                description="Emails you save as drafts will appear here."
                action={{
                  label: 'Compose Email',
                  onClick: () => router.push('/dashboard/compose')
                }}
              />
            )}
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className={cn(
                  'group relative border-b border-border/30 last:border-b-0 transition-colors duration-150',
                  'hover:bg-muted/40',
                  selection.isSelected(draft.id) && 'bg-primary/10'
                )}
              >
                <div className={styles.nu_flex6}>
                  <div className={styles.nu_flex7} onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selection.isSelected(draft.id)}
                      onCheckedChange={() => selection.toggleSelect(draft.id)}
                      aria-label={`Select draft: ${draft.subject || 'No Subject'}`}
                    />
                  </div>
                  <button
                    onClick={() => handleEdit(draft)}
                    className={styles.nu_flex12}
                  >
                    <div className={styles.nu_flex8}>
                      <div className={styles.nu_flex13}>
                        <div className={styles.nu_flex9}>
                          <div className={styles.nu_h5}>
                            <span className={styles.nu_text10px}>
                              {draft.toAddress ? draft.toAddress.charAt(0).toUpperCase() : '?'}
                            </span>
                          </div>
                          <Edit className={styles.nu_h3} />
                          <span className={styles.nu_textXs2}>
                            {draft.toAddress ? `To: ${draft.toAddress}` : 'No recipient'}
                          </span>
                        </div>
                        <h4 className={styles.nu_textSm2}>
                          {draft.subject || '(No Subject)'}
                        </h4>
                        <p className={styles.nu_textXs3}>
                          {draft.body?.replace(/<[^>]*>/g, '').trim() || 'Empty draft'}
                        </p>
                      </div>

                      <div className={styles.nu_flex10}>
                        <span className={styles.nu_textXs4}>
                          <Clock className={styles.nu_h32} />
                          {new Date(draft.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={styles.nu_h7}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(draft.id);
                          }}
                          disabled={deletingId === draft.id}
                        >
                          <Trash2 className={styles.nu_h32} />
                        </Button>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
