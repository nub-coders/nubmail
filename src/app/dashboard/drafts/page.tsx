'use client';

import { useEffect, useState, useMemo } from 'react';
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

  const fetchDrafts = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/drafts', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok) setDrafts(data.drafts || []);
    } catch {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchDrafts();
  }, [user]);

  const handleEdit = (draft: Draft) => {
    router.push(`/dashboard/compose?draftId=${draft.id}`);
  };

  const handleDelete = async (draftId: string) => {
    setDeletingId(draftId);
    try {
      const res = await fetch(`/api/drafts?id=${draftId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
    return <div className="py-8 text-center">You must be signed in to view drafts.</div>;
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Drafts</h1>
          </div>
          <p className="text-sm text-muted-foreground">
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
          { label: 'Delete', icon: <Trash2 className="h-4 w-4" />, onClick: handleBulkDelete, variant: 'destructive' },
        ]}
      />

      <Card className="flex-1 border border-border/40 shadow-card bg-card">
        <CardContent className="p-0">
          <div className="flex flex-col">
            {!isLoading && drafts.length > 0 && (
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
                <LoadingSpinner size="md" text="Loading drafts..." />
              </div>
            )}
            {!isLoading && drafts.length === 0 && (
              <EmptyState
                icon={<FileText className="h-16 w-16" />}
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
                <div className="flex items-start gap-0">
                  <div className="flex items-center px-3 pt-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selection.isSelected(draft.id)}
                      onCheckedChange={() => selection.toggleSelect(draft.id)}
                      aria-label={`Select draft: ${draft.subject || 'No Subject'}`}
                    />
                  </div>
                  <button
                    onClick={() => handleEdit(draft)}
                    className="flex-1 p-4 pl-1 text-left focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-inset"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Edit className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground truncate">
                            {draft.toAddress ? `To: ${draft.toAddress}` : 'No recipient'}
                          </span>
                        </div>
                        <h4 className="text-sm font-medium text-foreground/90 line-clamp-1">
                          {draft.subject || '(No Subject)'}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                          {draft.body?.replace(/<[^>]*>/g, '').trim() || 'Empty draft'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(draft.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(draft.id);
                          }}
                          disabled={deletingId === draft.id}
                        >
                          <Trash2 className="h-3 w-3" />
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
