'use client';
import styles from './page.module.css';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Mail, MailOpen, Clock, Archive, Trash2, RefreshCw, Star, Shield, BookOpen, BookX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuthClient } from '@/lib/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { useEmailSelection } from '@/hooks/use-email-selection';
import { BulkActionBar } from '@/components/bulk-action-bar';
import { bulkPatchEmails } from '@/lib/bulk-email-actions';
import { getEmailPreviewText } from '@/lib/email-body';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Email {
  id: string;
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  sentAt: string;
  read: boolean;
}

interface EmailAccount {
  id: string;
  emailAddress: string;
  storageQuota: number;
  domainId: string;
  createdAt: string;
}

export default function InboxPage() {
  const router = useRouter();
  const { user , token} = useAuthClient();
  const { toast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Filter by selected account
  const accountFilteredEmails = selectedAccount === 'all'
    ? emails
    : emails.filter(email => email.recipients.includes(selectedAccount));

  // Filter by search query
  const filteredEmails = accountFilteredEmails.filter(email =>
    searchQuery === '' ||
    email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.body.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredIds = useMemo(() => filteredEmails.map(e => e.id), [filteredEmails]);
  const selection = useEmailSelection(filteredIds);

  const fetchEmailAccounts = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/accounts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setEmailAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Failed to fetch email accounts');
    }
  };

  const fetchEmails = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/emails?folder=inbox', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setEmails(data.emails || []);
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!user || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/emails?folder=inbox', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setEmails(data.emails || []);
        selection.clearSelection();
      }
    } catch (error) {
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchEmailAccounts();
      fetchEmails();
    }
  }, [user]);

  const handleEmailClick = (email: Email) => {
    router.push(`/dashboard/inbox/${email.id}`);
  };

  const handleQuickAction = async (e: React.MouseEvent, emailId: string, action: 'archive' | 'delete') => {
    e.stopPropagation();
    try {
      const fields = action === 'archive' ? { archived: true } : { deleted: true };
      const res = await fetch('/api/emails', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ emailId, ...fields })
      });
      if (!res.ok) throw new Error();
      setEmails(prev => prev.filter(e => e.id !== emailId));
      selection.removeIds([emailId]);
      toast({
        title: action === 'archive' ? 'Archived' : 'Deleted',
        description: action === 'archive' ? 'Email moved to archive' : 'Email moved to trash'
      });
    } catch {
      toast({ title: 'Error', description: `Failed to ${action} email`, variant: 'destructive' });
    }
  };

  const handleBulkAction = async (fields: Record<string, unknown>, label: string) => {
    setBulkLoading(true);
    try {
      const { success, failed } = await bulkPatchEmails(selection.selectedArray, fields, token);
      if (success > 0) {
        setEmails(prev => prev.filter(e => !selection.isSelected(e.id)));
        selection.clearSelection();
      }
      toast({
        title: label,
        description: failed > 0 ? `${success} succeeded, ${failed} failed` : `${success} emails updated`
      });
    } catch {
      toast({ title: 'Error', description: `Failed to ${label.toLowerCase()}`, variant: 'destructive' });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkReadState = async (read: boolean) => {
    setBulkLoading(true);
    try {
      const { success, failed } = await bulkPatchEmails(selection.selectedArray, { read }, token);
      if (success > 0) {
        setEmails(prev => prev.map(e =>
          selection.isSelected(e.id) ? { ...e, read } : e
        ));
        selection.clearSelection();
      }
      toast({
        title: read ? 'Marked as read' : 'Marked as unread',
        description: failed > 0 ? `${success} succeeded, ${failed} failed` : `${success} emails updated`
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to update emails', variant: 'destructive' });
    } finally {
      setBulkLoading(false);
    }
  };

  if (!user) {
    return (
      <div className={styles.nu_py8}>You must be signed in to view your inbox.</div>
    );
  }

  const unreadCount = emails.filter(e => !e.read).length;

  return (
    <div className={styles.nu_flex}>
      {/* Header Section */}
      <div className={styles.nu_flex2}>
        <div className={styles.nu_spaceY2}>
          <div className={styles.nu_flex3}>
            <h1 className={styles.nu_text2xl}>Inbox</h1>
          </div>
          <div className={styles.nu_flex4}>
            <p className={styles.nu_textSm}>
              {isLoading ? 'Loading messages...' : `${emails.length} messages`}
            </p>
            {unreadCount > 0 && (
              <Badge variant="secondary" className={styles.nu_bgPrimary10}>
                <MailOpen className={styles.nu_h3} />
                {unreadCount} unread
              </Badge>
            )}
          </div>
        </div>

        {/* Search and Actions */}
        <div className={styles.nu_flex3}>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className={styles.nu_w200px}>
              <SelectValue placeholder="All inboxes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All inboxes</SelectItem>
              {emailAccounts.map((account) => (
                <SelectItem key={account.id} value={account.emailAddress}>
                  {account.emailAddress}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={styles.nu_shrink0}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
          <div className={styles.nu_relative}>
            <Search className={styles.nu_absolute} />
            <Input
              type="search"
              placeholder="Search emails..."
              className={styles.nu_pl10}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selection.selectedCount}
        totalCount={filteredEmails.length}
        isAllSelected={selection.isAllSelected}
        onSelectAll={selection.selectAll}
        onClearSelection={selection.clearSelection}
        loading={bulkLoading}
        actions={[
          { label: 'Archive', icon: <Archive className={styles.nu_h4} />, onClick: () => handleBulkAction({ archived: true }, 'Archived') },
          { label: 'Delete', icon: <Trash2 className={styles.nu_h4} />, onClick: () => handleBulkAction({ deleted: true }, 'Deleted'), variant: 'destructive' },
          { label: 'Read', icon: <BookOpen className={styles.nu_h4} />, onClick: () => handleBulkReadState(true) },
          { label: 'Unread', icon: <BookX className={styles.nu_h4} />, onClick: () => handleBulkReadState(false) },
          { label: 'Spam', icon: <Shield className={styles.nu_h4} />, onClick: () => handleBulkAction({ spam: true }, 'Marked as spam') },
          { label: 'Star', icon: <Star className={styles.nu_h4} />, onClick: () => handleBulkAction({ starred: true }, 'Starred') },
        ]}
      />

      {/* Email List */}
      <Card className={styles.nu_flex1}>
        <CardContent className={styles.nu_p0}>
          <div className={styles.nu_flex5}>
            {/* Select All Header */}
            {!isLoading && filteredEmails.length > 0 && (
              <div className={styles.nu_flex6}>
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
                <LoadingSpinner size="md" text="Loading your emails..." />
              </div>
            )}
            {!isLoading && filteredEmails.length === 0 && (
              <EmptyState
                icon={<Mail className={styles.nu_h16} />}
                title={searchQuery ? 'No matching emails' : 'Your inbox is empty'}
                description={
                  searchQuery
                    ? 'Try adjusting your search terms to find what you\'re looking for.'
                    : 'New emails will appear here when they arrive. Check back later or compose a new message to get started.'
                }
                action={
                  !searchQuery
                    ? {
                        label: 'Compose Email',
                        onClick: () => window.location.href = '/dashboard/compose'
                      }
                    : undefined
                }
              />
            )}
            {filteredEmails.map((email, index) => (
              <div
                key={email.id}
                className={cn(
                  'group relative border-b border-border/30 last:border-b-0 transition-colors duration-150',
                  'hover:bg-muted/50',
                  !email.read && 'bg-primary/[0.03] border-l-2 border-l-primary',
                  selection.isSelected(email.id) && 'bg-primary/10'
                )}
              >
                <div className={styles.nu_flex7}>
                  <div className={styles.nu_flex8} onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selection.isSelected(email.id)}
                      onCheckedChange={() => selection.toggleSelect(email.id)}
                      aria-label={`Select email from ${email.sender}`}
                    />
                  </div>
                  <button
                    onClick={() => handleEmailClick(email)}
                    className={styles.nu_flex12}
                  >
                    <div className={styles.nu_flex9}>
                      {/* Left side - Email content */}
                      <div className={styles.nu_flex13}>
                        <div className={styles.nu_flex10}>
                          {!email.read && (
                            <div className={styles.nu_h15} />
                          )}
                          <div className={styles.nu_flex11}>
                            <div className={styles.nu_h6}>
                              <span className={styles.nu_textXs2}>
                                {email.sender.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className={cn(
                              'font-medium text-sm truncate',
                              !email.read ? 'font-semibold text-foreground' : 'text-foreground/80'
                            )}>
                              {email.sender}
                            </span>
                          </div>
                        </div>

                        <div className={styles.nu_spaceY1}>
                          <h4 className={cn(
                            'text-sm line-clamp-1',
                            !email.read ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'
                          )}>
                            {email.subject || '(No Subject)'}
                          </h4>
                          <p className={styles.nu_textXs3}>
                            {getEmailPreviewText(email.body)}
                          </p>
                        </div>
                      </div>

                      {/* Right side - Meta info */}
                      <div className={styles.nu_flex12b}>
                        <div className={styles.nu_flex13b}>
                          <span className={cn(
                            'text-xs font-medium',
                            !email.read ? 'text-foreground' : 'text-muted-foreground'
                          )}>
                            {new Date(email.sentAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: new Date(email.sentAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                            })}
                          </span>
                          <Clock className={styles.nu_h32} />
                        </div>

                        {/* Quick actions - visible on hover */}
                        <div className={styles.nu_flex14}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={styles.nu_h62}
                            onClick={(e) => handleQuickAction(e, email.id, 'archive')}
                          >
                            <Archive className={styles.nu_h33} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={styles.nu_h63}
                            onClick={(e) => handleQuickAction(e, email.id, 'delete')}
                          >
                            <Trash2 className={styles.nu_h33} />
                          </Button>
                        </div>
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
