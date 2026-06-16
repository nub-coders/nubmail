'use client';
import styles from './page.module.css';

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
import { EmailBodyFrame } from '@/components/email-body-frame';

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
  const { user , token} = useAuthClient();
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
          headers: { Authorization: `Bearer ${token}` }
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
      const { success, failed } = await bulkPatchEmails(selection.selectedArray, fields, token);
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
    return <div className={styles.nu_py8}>You must be signed in to view sent emails.</div>;
  }

  return (
    <div className={styles.nu_flex}>
      <div className={styles.nu_flex2}>
        <div>
          <h1 className={styles.nu_text2xl}>Sent</h1>
          <p className={styles.nu_textMutedForeground}>
            {isLoading ? 'Loading...' : `${emails.length} sent messages`}
          </p>
        </div>
        <div className={styles.nu_relative}>
          <Search className={styles.nu_absolute} />
          <Input
            type="search"
            placeholder="Search sent emails..."
            className={styles.nu_pl8}
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
          { label: 'Delete', icon: <Trash2 className={styles.nu_h4} />, onClick: () => handleBulkAction({ deleted: true }, 'Deleted'), variant: 'destructive' },
          { label: 'Star', icon: <Star className={styles.nu_h4} />, onClick: () => handleBulkAction({ starred: true }, 'Starred') },
        ]}
      />

      <Card className={styles.nu_flex1}>
        <CardContent className={styles.nu_p0}>
          {isLoading ? (
            <div className={styles.nu_p6}>
              <p>Loading sent emails...</p>
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className={styles.nu_p6}>
              <Send className={styles.nu_h16}/>
              <h3 className={styles.nu_textXl}>
                {searchQuery ? 'No matching emails' : 'No Sent Emails'}
              </h3>
              <p className={styles.nu_textMutedForeground2}>
                {searchQuery ? 'Try a different search term.' : 'Emails you send will appear here.'}
              </p>
            </div>
          ) : (
            <div className={styles.nu_flex3}>
              {!isLoading && filteredEmails.length > 0 && (
                <div className={styles.nu_flex4}>
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
              {filteredEmails.map((email) => (
                <div
                  key={email.id}
                  className={cn(
                    'flex items-start border-b border-border/30 transition-colors duration-150 hover:bg-muted/50',
                    selection.isSelected(email.id) && 'bg-primary/10'
                  )}
                >
                  <div className={styles.nu_flex5} onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selection.isSelected(email.id)}
                      onCheckedChange={() => selection.toggleSelect(email.id)}
                      aria-label={`Select email to ${email.recipients.join(', ')}`}
                    />
                  </div>
                  <button
                    onClick={() => handleEmailClick(email)}
                    className={styles.nu_flex12}
                  >
                    <div className={styles.nu_flex6}>
                      <div className={styles.nu_flex7}>
                        <div className={styles.nu_h6}>
                          <span className={styles.nu_textXs2}>
                            {email.recipients[0]?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className={styles.nu_fontSemibold}>
                          To: {email.recipients.join(', ')}
                        </div>
                      </div>
                      <div className={styles.nu_mlAuto}>
                        {new Date(email.sentAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className={styles.nu_textXs3}>
                      {email.subject || '(No Subject)'}
                    </div>
                    <div className={styles.nu_lineClamp2}>
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
        <DialogContent className={styles.nu_maxW4xl}>
          <DialogHeader>
            <DialogTitle className={styles.nu_flex7}>
              <Button variant="ghost" size="sm" onClick={() => setIsEmailOpen(false)}>
                <ArrowLeft className={styles.nu_h4} />
                Back to Sent
              </Button>
            </DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className={styles.nu_flex8}>
              <div className={styles.nu_spaceY2}>
                <h2 className={styles.nu_textXl}>{selectedEmail.subject || '(No Subject)'}</h2>
                <div className={styles.nu_flex9}>
                  <div><strong>From:</strong> {selectedEmail.sender}</div>
                  <div><strong>To:</strong> {selectedEmail.recipients.join(', ')}</div>
                  <div><strong>Date:</strong> {new Date(selectedEmail.sentAt).toLocaleString()}</div>
                </div>
              </div>
              <div className={styles.nu_flex13}>
                <EmailBodyFrame
                  className={styles.nu_prose}
                  html={getSafeEmailHtml(selectedEmail.body)}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
