'use client';

import { useEffect, useState, useMemo } from 'react';
import { Send, Search, ArrowLeft, Trash2, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuthClient } from '@/lib/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { useEmailSelection } from '@/hooks/use-email-selection';
import { BulkActionBar } from '@/components/bulk-action-bar';
import { bulkPatchEmails } from '@/lib/bulk-email-actions';
import { getEmailPreviewText, getSafeEmailHtml } from '@/lib/email-body';

interface Email {
  id: string;
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  sentAt: string;
  read: boolean;
}

export default function SentPage() {
  const { user } = useAuthClient();
  const { toast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const filteredEmails = emails.filter(email =>
    searchQuery === '' ||
    email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.recipients.some(r => r.toLowerCase().includes(searchQuery.toLowerCase())) ||
    email.body.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredIds = useMemo(() => filteredEmails.map(e => e.id), [filteredEmails]);
  const selection = useEmailSelection(filteredIds);

  useEffect(() => {
    const fetchEmails = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const res = await fetch('/api/emails?folder=sent', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (res.ok) setEmails(data.emails || []);
      } catch {} finally {
        setIsLoading(false);
      }
    };
    fetchEmails();
  }, [user]);

  const handleEmailClick = (email: Email) => {
    setSelectedEmail(email);
    setIsEmailOpen(true);
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
    return <div className="py-8 text-center">You must be signed in to view sent emails.</div>;
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sent</h1>
          <p className="text-muted-foreground">
            {isLoading ? 'Loading...' : `${emails.length} sent messages`}
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search sent emails..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <BulkActionBar
        selectedCount={selection.selectedCount}
        totalCount={filteredEmails.length}
        isAllSelected={selection.isAllSelected}
        onSelectAll={selection.selectAll}
        onClearSelection={selection.clearSelection}
        loading={bulkLoading}
        actions={[
          { label: 'Delete', icon: <Trash2 className="h-4 w-4" />, onClick: () => handleBulkAction({ deleted: true }, 'Deleted'), variant: 'destructive' },
          { label: 'Star', icon: <Star className="h-4 w-4" />, onClick: () => handleBulkAction({ starred: true }, 'Starred') },
        ]}
      />

      <Card className="flex-1">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 h-96 flex flex-col items-center justify-center text-center">
              <p>Loading sent emails...</p>
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="p-6 h-96 flex flex-col items-center justify-center text-center">
              <Send className="h-16 w-16 text-muted-foreground/50 mb-4"/>
              <h3 className="text-xl font-semibold">
                {searchQuery ? 'No matching emails' : 'No Sent Emails'}
              </h3>
              <p className="text-muted-foreground mt-2">
                {searchQuery ? 'Try a different search term.' : 'Emails you send will appear here.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {!isLoading && filteredEmails.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/20">
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
              {filteredEmails.map((email) => (
                <div
                  key={email.id}
                  className={cn(
                    'flex items-start border-b border-border/30 transition-colors duration-150 hover:bg-muted/50',
                    selection.isSelected(email.id) && 'bg-primary/10'
                  )}
                >
                  <div className="flex items-center px-3 pt-5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selection.isSelected(email.id)}
                      onCheckedChange={() => selection.toggleSelect(email.id)}
                      aria-label={`Select email to ${email.recipients.join(', ')}`}
                    />
                  </div>
                  <button
                    onClick={() => handleEmailClick(email)}
                    className="flex-1 flex flex-col items-start gap-2 p-4 pl-1 text-sm w-full text-left cursor-pointer"
                  >
                    <div className="flex w-full items-center">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-primary">
                            {email.recipients[0]?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="font-semibold">
                          To: {email.recipients.join(', ')}
                        </div>
                      </div>
                      <div className="ml-auto text-xs text-muted-foreground">
                        {new Date(email.sentAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-xs font-medium">
                      {email.subject || '(No Subject)'}
                    </div>
                    <div className="line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                      {getEmailPreviewText(email.body)}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEmailOpen} onOpenChange={setIsEmailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsEmailOpen(false)}>
                <ArrowLeft className="h-4 w-4" />
                Back to Sent
              </Button>
            </DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="flex flex-col gap-4 overflow-hidden">
              <div className="space-y-2 border-b pb-4">
                <h2 className="text-xl font-semibold">{selectedEmail.subject || '(No Subject)'}</h2>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <div><strong>From:</strong> {selectedEmail.sender}</div>
                  <div><strong>To:</strong> {selectedEmail.recipients.join(', ')}</div>
                  <div><strong>Date:</strong> {new Date(selectedEmail.sentAt).toLocaleString()}</div>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <div
                  className="prose max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{
                    __html: getSafeEmailHtml(selectedEmail.body)
                  }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
