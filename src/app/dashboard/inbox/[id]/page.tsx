'use client';
import styles from './page.module.css';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Mail, Clock, Star, Archive, Trash2, Reply, Forward, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuthClient } from '@/lib/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { getSafeEmailHtml } from '@/lib/email-body';
import { EmailBodyFrame } from '@/components/email-body-frame';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Email {
  id: string;
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  sentAt: string;
  read: boolean;
  starred: boolean;
}

export default function EmailViewPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthClient();
  const { toast } = useToast();
  const [email, setEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Replace `cid:` references with our attachment API URL so images load for
  // messages stored in Maildir that reference inline attachments.
  const processedBody = (email?.body || '').replace(/cid:<?([^"' >]+)>?/gi, (m, p1) => {
    const cid = encodeURIComponent(p1.replace(/^<|>$/g, ''));
    return `/api/emails/attachment?emailId=${email?.id}&cid=${cid}`;
  });
  const safeBodyHtml = getSafeEmailHtml(processedBody);

  useEffect(() => {
    const fetchEmail = async () => {
      if (!user || !params.id) return;
      setIsLoading(true);
      try {
        const res = await fetch(`/api/emails/${encodeURIComponent(String(params.id))}`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (res.ok && data.email) {
          const foundEmail: Email = data.email;
          setEmail(foundEmail);
          if (!foundEmail.read) {
            await fetch('/api/emails', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                
              },
              body: JSON.stringify({ emailId: foundEmail.id, read: true }),
            });
          }
        }
      } catch (error) {
        console.error('Error fetching email:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEmail();
  }, [user, params.id]);

  const patchEmail = async (fields: Record<string, unknown>, actionName: string) => {
    if (!email) return;
    setActionLoading(actionName);
    try {
      const res = await fetch('/api/emails', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          
        },
        body: JSON.stringify({ emailId: email.id, ...fields }),
      });
      if (!res.ok) throw new Error('Failed to update email');
      return true;
    } catch {
      toast({ title: 'Error', description: `Failed to ${actionName} email`, variant: 'destructive' });
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const handleStar = async () => {
    if (!email) return;
    const newStarred = !email.starred;
    if (await patchEmail({ starred: newStarred }, 'star')) {
      setEmail({ ...email, starred: newStarred });
      toast({ title: newStarred ? 'Starred' : 'Unstarred', description: `Email ${newStarred ? 'starred' : 'unstarred'}` });
    }
  };

  const handleArchive = async () => {
    if (await patchEmail({ archived: true }, 'archive')) {
      toast({ title: 'Archived', description: 'Email moved to archive' });
      router.push('/dashboard/inbox');
    }
  };

  const handleDelete = async () => {
    if (await patchEmail({ deleted: true }, 'delete')) {
      toast({ title: 'Deleted', description: 'Email moved to trash' });
      router.push('/dashboard/inbox');
    }
  };

  const handleReply = () => {
    if (!email) return;
    const p = new URLSearchParams({
      mode: 'reply',
      to: email.sender,
      subject: email.subject?.startsWith('Re: ') ? email.subject : `Re: ${email.subject || ''}`,
      emailId: email.id,
    });
    router.push(`/dashboard/compose?${p.toString()}`);
  };

  const handleForward = () => {
    if (!email) return;
    const p = new URLSearchParams({
      mode: 'forward',
      subject: email.subject?.startsWith('Fwd: ') ? email.subject : `Fwd: ${email.subject || ''}`,
      emailId: email.id,
    });
    router.push(`/dashboard/compose?${p.toString()}`);
  };

  if (!user) {
    return <div className={styles.nu_py8}>You must be signed in to view this email.</div>;
  }

  if (isLoading) {
    return (
      <div className={styles.nu_flex}>
        <LoadingSpinner size="md" text="Loading email..." />
      </div>
    );
  }

  if (!email) {
    return (
      <div className={styles.nu_flex2}>
        <Mail className={styles.nu_h16} />
        <h2 className={styles.nu_textXl}>Email not found</h2>
        <p className={styles.nu_textMutedForeground}>
          The email you&apos;re looking for doesn&apos;t exist or has been deleted.
        </p>
        <Button onClick={() => router.push('/dashboard/inbox')}>Back to Inbox</Button>
      </div>
    );
  }

  return (
    <div className={styles.nu_flex3}>
      {/* Compact header: subject + inline meta + three-dot menu */}
      <div className={styles.nu_flex4}>
        <div className={styles.nu_headerLeft}>
          <h1 className={styles.nu_text2xl}>{email.subject || '(No Subject)'}</h1>
          <div className={styles.nu_metaRow}>
            <div className={styles.nu_senderAvatar}>
              <span className={styles.nu_avatarLetter}>{email.sender.charAt(0).toUpperCase()}</span>
            </div>
            <span className={styles.nu_senderName}>{email.sender}</span>
            <span className={styles.nu_metaSep}>→</span>
            <span className={styles.nu_recipientText}>{email.recipients.join(', ')}</span>
            <span className={styles.nu_metaSep}>·</span>
            <Clock className={styles.nu_clockIcon} />
            <span className={styles.nu_dateText}>
              {new Date(email.sentAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year:
                  new Date(email.sentAt).getFullYear() !== new Date().getFullYear()
                    ? 'numeric'
                    : undefined,
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* Three-dot menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={styles.nu_dotBtn} disabled={!!actionLoading}>
              <MoreVertical className={styles.nu_dotIcon} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleStar}>
              <Star className={`h-4 w-4 mr-2 ${email.starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              {email.starred ? 'Unstar' : 'Star'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleReply}>
              <Reply className="h-4 w-4 mr-2" />
              Reply
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleForward}>
              <Forward className="h-4 w-4 mr-2" />
              Forward
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleArchive}>
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Email Content */}
      <div className={styles.nu_flex1}>
        <div className={styles.nu_maxWNone}>
          <EmailBodyFrame html={safeBodyHtml} className={styles.nu_prose} />
        </div>
      </div>

      {/* Footer Actions */}
      <div className={styles.nu_px62}>
        <div className={styles.nu_flex9}>
          <div className={styles.nu_flex10}>
            <Mail className={styles.nu_h43} />
            <span>Reply to continue the conversation</span>
          </div>
          <div className={styles.nu_flex6}>
            <Button variant="outline" size="sm" onClick={handleReply}>
              <Reply className={styles.nu_h4} />
              Reply
            </Button>
            <Button variant="outline" size="sm" onClick={handleForward}>
              <Forward className={styles.nu_h4} />
              Forward
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
