"use client";
import styles from './page.module.css';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Paperclip, Send, Trash, Save, X, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuthClient } from '@/lib/auth-provider';

function ComposeForm() {
  const { user } = useAuthClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [from, setFrom] = useState('');
  const [accounts, setAccounts] = useState<{ id: string; emailAddress: string }[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; size: number; type: string; data: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_EXTENSIONS = new Set(['pdf', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip']);
  const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'text/plain',
    'text/csv',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream',
  ]);

  const mode = searchParams.get('mode');
  const emailId = searchParams.get('emailId');
  const paramDraftId = searchParams.get('draftId');

  useEffect(() => {
    const loadAccounts = async () => {
      if (!user) return;
      try {
        const res = await fetch('/api/accounts', { credentials: 'include' });
        const data = await res.json();
          if (res.ok && Array.isArray(data.accounts)) {
            setAccounts(data.accounts.map((a: any) => ({ id: a.id, emailAddress: a.emailAddress })));
            if (data.accounts[0]?.emailAddress) {
              setFrom((previous) => previous || data.accounts[0].emailAddress);
            }
          }
      } catch {}
    };
    loadAccounts();
  }, [user]);

  useEffect(() => {
    if (prefilled) return;

    if (paramDraftId) {
      const loadDraft = async () => {
        try {
          const res = await fetch('/api/drafts', {
            credentials: 'include'
          });
          const data = await res.json();
          if (res.ok) {
            const draft = data.drafts?.find((d: any) => d.id === paramDraftId);
            if (draft) {
              setDraftId(draft.id);
              if (draft.fromAddress) setFrom(draft.fromAddress);
              setTo(draft.toAddress || '');
              setSubject(draft.subject || '');
              setBody(draft.body || '');
              setPrefilled(true);
            }
          }
        } catch {}
      };
      loadDraft();
    } else if ((mode === 'reply' || mode === 'forward') && emailId) {
      const paramTo = searchParams.get('to');
      const paramSubject = searchParams.get('subject');

      const loadOriginalEmail = async () => {
        try {
          const res = await fetch('/api/emails?folder=inbox', {
            credentials: 'include'
          });
          const data = await res.json();
          if (res.ok) {
            const original = data.emails?.find((e: any) => e.id === emailId);
            if (original) {
              const plainBody = original.body?.replace(/<[^>]*>/g, '') || '';
              const date = new Date(original.sentAt).toLocaleString();
              const quotedText = `\n\n--- On ${date}, ${original.sender} wrote ---\n${plainBody}`;

              if (mode === 'reply') {
                setTo(paramTo || original.sender);
                setSubject(paramSubject || `Re: ${original.subject || ''}`);
                setBody(quotedText);
              } else {
                setTo('');
                setSubject(paramSubject || `Fwd: ${original.subject || ''}`);
                setBody(`\n\n--- Forwarded message ---\nFrom: ${original.sender}\nTo: ${original.recipients?.join(', ')}\nDate: ${date}\nSubject: ${original.subject || ''}\n\n${plainBody}`);
              }
              setPrefilled(true);
            }
          }
        } catch {}
      };
      loadOriginalEmail();
    }
  }, [mode, emailId, paramDraftId, prefilled, searchParams]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const currentSize = attachments.reduce((sum, a) => sum + a.size, 0);
    const newFiles = Array.from(files);
    let addedSize = 0;

    const readers = newFiles.map(file => {
      return new Promise<{ name: string; size: number; type: string; data: string } | null>((resolve) => {
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        const mimeType = (file.type || '').toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(extension) || (mimeType && !ALLOWED_MIME_TYPES.has(mimeType))) {
          toast({
            title: 'Unsupported attachment',
            description: `${file.name} is not an allowed file type.`,
            variant: 'destructive'
          });
          resolve(null);
          return;
        }

        if (currentSize + addedSize + file.size > MAX_TOTAL_SIZE) {
          toast({ title: 'Too large', description: `Total attachments cannot exceed 10 MB`, variant: 'destructive' });
          resolve(null);
          return;
        }
        addedSize += file.size;
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({ name: file.name, size: file.size, type: file.type || 'application/octet-stream', data: base64 });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then(results => {
      const valid = results.filter(Boolean) as { name: string; size: number; type: string; data: string }[];
      if (valid.length) setAttachments(prev => [...prev, ...valid]);
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDiscard = () => {
    if (to || subject || body || attachments.length > 0) {
      if (confirm('Are you sure you want to discard this message?')) {
        setTo('');
        setSubject('');
        setBody('');
        setAttachments([]);
      }
    }
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const payload = { fromAddress: from, toAddress: to, subject, body };
      let res;
      if (draftId) {
        res = await fetch('/api/drafts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: draftId, ...payload })
        });
      } else {
        res = await fetch('/api/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save draft');
      if (data.draft?.id) setDraftId(data.draft.id);
      toast({ title: 'Draft saved', description: 'Your draft has been saved' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save draft', variant: 'destructive' });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSend = async () => {
    if (!from || !to || !subject || !body) {
      toast({
        title: 'Missing fields',
        description: 'Please select a sender and fill in recipient, subject, and message',
        variant: 'destructive'
      });
      return;
    }

    if (!user) {
      toast({
        title: 'Not authenticated',
        description: 'Please sign in to send emails',
        variant: 'destructive'
      });
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          
        },
        body: JSON.stringify({
          from, to, subject, text: body,
          ...(attachments.length > 0 ? {
            attachments: attachments.map(a => ({
              filename: a.name,
              content: a.data,
              contentType: a.type,
            }))
          } : {})
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      if (draftId) {
        await fetch(`/api/drafts?id=${draftId}`, {
          method: 'DELETE',
          credentials: 'include'
        }).catch(() => {});
      }

      toast({
        title: 'Email sent!',
        description: `Your message has been sent to ${to}`
      });

      setTo('');
      setSubject('');
      setBody('');
      setAttachments([]);

      setTimeout(() => router.push('/dashboard/sent'), 1500);
    } catch (error: any) {
      toast({
        title: 'Failed to send',
        description: error.message || 'An error occurred while sending your email',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.nu_flex}>
      {/* Header */}
      <div className={styles.nu_flex2}>
        <div className={styles.nu_spaceY2}>
          <div className={styles.nu_flex3}>
            <h1 className={styles.nu_text2xl}>
              {mode === 'reply' ? 'Reply' : mode === 'forward' ? 'Forward' : draftId ? 'Edit Draft' : 'Compose Email'}
            </h1>
          </div>
          <p className={styles.nu_textSm}>
            {mode === 'reply' ? 'Reply to this message' : mode === 'forward' ? 'Forward this message' : 'Draft and send your new message'}
          </p>
        </div>
      </div>

      {/* Compose Form */}
      <Card className={styles.nu_flex1}>
        <CardContent className={styles.nu_p0}>
          <form className={styles.nu_flex4} onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
            {/* Email Header Fields */}
            <div className={styles.nu_spaceY1}>
              {/* From Field */}
              <div className={styles.nu_flex5}>
                <Label htmlFor="from" className={styles.nu_textSm2}>
                  From
                </Label>
                <Select value={from} onValueChange={setFrom}>
                  <SelectTrigger id="from" className={styles.nu_border0}>
                    <SelectValue placeholder="Choose sender..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.emailAddress}>
                        <div className={styles.nu_flex6}>
                          <div className={styles.nu_h6}>
                            <span className={styles.nu_textXs}>
                              {a.emailAddress.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          {a.emailAddress}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* To Field */}
              <div className={styles.nu_flex5}>
                <Label htmlFor="to" className={styles.nu_textSm2}>
                  To
                </Label>
                <Input
                  id="to"
                  type="email"
                  placeholder="recipient@example.com"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className={styles.nu_border0}
                  required
                />
              </div>

              {/* Subject Field */}
              <div className={styles.nu_flex5}>
                <Label htmlFor="subject" className={styles.nu_textSm2}>
                  Subject
                </Label>
                <Input
                  id="subject"
                  placeholder="Enter subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={styles.nu_border0}
                  required
                />
              </div>
            </div>

            {/* Message Body */}
            <div className={styles.nu_flex12}>
              <Textarea
                id="body"
                placeholder="Write your message here..."
                className={styles.nu_flex13}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className={styles.nu_flex7}>
                {attachments.map((file, i) => (
                  <div key={i} className={styles.nu_flex8}>
                    <File className={styles.nu_h3} />
                    <span className={styles.nu_truncate}>{file.name}</span>
                    <span className={styles.nu_textXs2}>({formatFileSize(file.size)})</span>
                    <button type="button" onClick={() => removeAttachment(i)} className={styles.nu_ml1}>
                      <X className={styles.nu_h32} />
                    </button>
                  </div>
                ))}
                <span className={styles.nu_textXs3}>
                  {formatFileSize(attachments.reduce((s, a) => s + a.size, 0))} / 10 MB
                </span>
              </div>
            )}

            {/* Action Bar */}
            <div className={styles.nu_flex9}>
              <div className={styles.nu_flex6}>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className={styles.nu_hidden}
                  onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
                />
                <Button variant="outline" size="sm" type="button" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className={styles.nu_h4} />
                  Attach
                </Button>
              </div>

              <div className={styles.nu_flex3}>
                <Button variant="ghost" type="button" onClick={handleDiscard} className={styles.nu_hoverBgDestructive10}>
                  <Trash className={styles.nu_mr2} />
                  Discard
                </Button>
                <Button variant="outline" type="button" onClick={handleSaveDraft} disabled={savingDraft}>
                  <Save className={styles.nu_mr2} />
                  {savingDraft ? 'Saving...' : 'Save Draft'}
                </Button>
                <Button
                  type="submit"
                  disabled={sending || !from || !to || !subject || !body}
                  className={styles.nu_minW100px}
                >
                  {sending ? (
                    <>
                      <div className={styles.nu_animateSpin}></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className={styles.nu_mr2} />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ComposePage() {
  return (
    <Suspense fallback={
      <div className={styles.nu_flex10}>
        <div className={styles.nu_animateSpin2}></div>
      </div>
    }>
      <ComposeForm />
    </Suspense>
  );
}
