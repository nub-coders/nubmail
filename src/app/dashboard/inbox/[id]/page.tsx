'use client';
import styles from './page.module.css';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Mail, Clock, Star, Archive, Trash2, Reply, Forward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuthClient } from '@/lib/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { getSafeEmailHtml } from '@/lib/email-body';

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
  const { user , token} = useAuthClient();
  const { toast } = useToast();
  const [email, setEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const safeBodyHtml = getSafeEmailHtml(email?.body);

  useEffect(() => {
    const fetchEmail = async () => {
      if (!user || !params.id) return;

      setIsLoading(true);
      try {
        const res = await fetch('/api/emails?folder=inbox', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok) {
          const foundEmail = data.emails?.find((e: Email) => e.id === params.id);
          if (foundEmail) {
            setEmail(foundEmail);

            if (!foundEmail.read) {
              await fetch('/api/emails', {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ emailId: foundEmail.id, read: true })
              });
            }
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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ emailId: email.id, ...fields })
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
    const params = new URLSearchParams({
      mode: 'reply',
      to: email.sender,
      subject: email.subject?.startsWith('Re: ') ? email.subject : `Re: ${email.subject || ''}`,
      emailId: email.id,
    });
    router.push(`/dashboard/compose?${params.toString()}`);
  };

  const handleForward = () => {
    if (!email) return;
    const params = new URLSearchParams({
      mode: 'forward',
      subject: email.subject?.startsWith('Fwd: ') ? email.subject : `Fwd: ${email.subject || ''}`,
      emailId: email.id,
    });
    router.push(`/dashboard/compose?${params.toString()}`);
  };

  if (!user) {
    return (
      <div className={styles.nu_py8}>You must be signed in to view this email.</div>
    );
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
        <p className={styles.nu_textMutedForeground}>The email you're looking for doesn't exist or has been deleted.</p>
        <Button onClick={() => router.push('/dashboard/inbox')}>
          <ArrowLeft className={styles.nu_h4} />
          Back to Inbox
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.nu_flex3}>
      {/* Header */}
      <div className={styles.nu_flex4}>
        <div className={styles.nu_flex5}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/inbox')}
            className={styles.nu_hoverBgBackground80}
          >
            <ArrowLeft className={styles.nu_h4} />
            Back to Inbox
          </Button>
          <div className={styles.nu_h42} />
          <Badge variant={email.read ? "secondary" : "default"} className={styles.nu_textXs}>
            {email.read ? "Read" : "Unread"}
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className={styles.nu_flex6}>
          <Button variant="outline" size="sm" onClick={handleStar} disabled={actionLoading === 'star'}>
            <Star className={`h-4 w-4 mr-2 ${email.starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            {email.starred ? 'Unstar' : 'Star'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleArchive} disabled={actionLoading === 'archive'}>
            <Archive className={styles.nu_h4} />
            Archive
          </Button>
          <Button variant="outline" size="sm" className={styles.nu_textDestructive} onClick={handleDelete} disabled={actionLoading === 'delete'}>
            <Trash2 className={styles.nu_h4} />
            Delete
          </Button>
        </div>
      </div>

      {/* Email Details */}
      <div className={styles.nu_px6}>
        <div className={styles.nu_spaceY4}>
          <div>
            <h1 className={styles.nu_text2xl}>
              {email.subject || '(No Subject)'}
            </h1>
            <div className={styles.nu_flex7}>
              <span className={styles.nu_flex6}>
                <Clock className={styles.nu_h43} />
                {new Date(email.sentAt).toLocaleString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>

          <div className={styles.nu_grid}>
            <div>
              <label className={styles.nu_textXs2}>From</label>
              <div className={styles.nu_mt1}>
                <div className={styles.nu_h8}>
                  <span className={styles.nu_textSm}>
                    {email.sender.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className={styles.nu_fontMedium}>{email.sender}</span>
              </div>
            </div>

            <div>
              <label className={styles.nu_textXs2}>To</label>
              <div className={styles.nu_mt12}>
                <div className={styles.nu_flex8}>
                  {email.recipients.map((recipient, i) => (
                    <Badge key={i} variant="secondary" className={styles.nu_textXs}>
                      {recipient}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Content */}
      <div className={styles.nu_flex1}>
        <div className={styles.nu_maxWNone}>
          <div
            className={styles.nu_prose}
            dangerouslySetInnerHTML={{
              __html: safeBodyHtml
            }}
          />
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
