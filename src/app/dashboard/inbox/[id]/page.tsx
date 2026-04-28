'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Mail, Clock, Star, Archive, Trash2, Reply, Forward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuthClient } from '@/lib/auth-provider';
import { useToast } from '@/hooks/use-toast';
import DOMPurify from 'dompurify';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSafeEmailHtml(body: string | undefined): string {
  if (!body || !body.trim()) {
    return '<p class="text-muted-foreground italic">No content available</p>';
  }

  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(body);
  const htmlCandidate = looksLikeHtml ? body : escapeHtml(body).replace(/\n/g, '<br>');
  return DOMPurify.sanitize(htmlCandidate, { USE_PROFILES: { html: true } });
}

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
  const safeBodyHtml = getSafeEmailHtml(email?.body);

  useEffect(() => {
    const fetchEmail = async () => {
      if (!user || !params.id) return;

      setIsLoading(true);
      try {
        const res = await fetch('/api/emails?folder=inbox', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
                  Authorization: `Bearer ${localStorage.getItem('token')}`
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
          Authorization: `Bearer ${localStorage.getItem('token')}`
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
      <div className="py-8 text-center">You must be signed in to view this email.</div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="md" text="Loading email..." />
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Mail className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Email not found</h2>
        <p className="text-muted-foreground">The email you're looking for doesn't exist or has been deleted.</p>
        <Button onClick={() => router.push('/dashboard/inbox')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Inbox
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b bg-muted/30 rounded-lg">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/inbox')}
            className="hover:bg-background/80"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Inbox
          </Button>
          <div className="h-4 w-px bg-border" />
          <Badge variant={email.read ? "secondary" : "default"} className="text-xs">
            {email.read ? "Read" : "Unread"}
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleStar} disabled={actionLoading === 'star'}>
            <Star className={`h-4 w-4 mr-2 ${email.starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            {email.starred ? 'Unstar' : 'Star'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleArchive} disabled={actionLoading === 'archive'}>
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={actionLoading === 'delete'}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Email Details */}
      <div className="px-6 py-4 border-b bg-background rounded-lg">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold leading-tight mb-2">
              {email.subject || '(No Subject)'}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/20 rounded-lg">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">From</label>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {email.sender.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="font-medium">{email.sender}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To</label>
              <div className="mt-1">
                <div className="flex flex-wrap gap-2">
                  {email.recipients.map((recipient, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
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
      <div className="flex-1 overflow-auto px-6 py-6 bg-background rounded-lg">
        <div className="max-w-none">
          <div
            className="prose prose-sm dark:prose-invert max-w-none
                       prose-headings:text-foreground prose-p:text-foreground prose-p:leading-relaxed
                       prose-strong:text-foreground prose-em:text-foreground
                       prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:p-4 prose-blockquote:rounded-r-lg
                       prose-code:bg-muted prose-code:px-2 prose-code:py-1 prose-code:rounded-md prose-code:text-sm
                       prose-pre:bg-muted prose-pre:border
                       prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
            dangerouslySetInnerHTML={{
              __html: safeBodyHtml
            }}
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t bg-muted/20 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span>Reply to continue the conversation</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReply}>
              <Reply className="h-4 w-4 mr-2" />
              Reply
            </Button>
            <Button variant="outline" size="sm" onClick={handleForward}>
              <Forward className="h-4 w-4 mr-2" />
              Forward
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
