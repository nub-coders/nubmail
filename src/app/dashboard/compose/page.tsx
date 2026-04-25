"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Paperclip, Send, Trash, Save, X, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
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

  const mode = searchParams.get('mode');
  const emailId = searchParams.get('emailId');
  const paramDraftId = searchParams.get('draftId');

  useEffect(() => {
    const loadAccounts = async () => {
      if (!user) return;
      try {
        const res = await fetch('/api/accounts', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        const data = await res.json();
        if (res.ok && Array.isArray(data.accounts)) {
          setAccounts(data.accounts.map((a: any) => ({ id: a.id, emailAddress: a.emailAddress })));
          if (!from && data.accounts[0]?.emailAddress) setFrom(data.accounts[0].emailAddress);
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
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ id: draftId, ...payload })
        });
      } else {
        res = await fetch('/api/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
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
          Authorization: `Bearer ${localStorage.getItem('token')}`
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
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
    <div className="flex flex-col gap-6 h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {mode === 'reply' ? 'Reply' : mode === 'forward' ? 'Forward' : draftId ? 'Edit Draft' : 'Compose Email'}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === 'reply' ? 'Reply to this message' : mode === 'forward' ? 'Forward this message' : 'Draft and send your new message'}
          </p>
        </div>
      </div>

      {/* Compose Form */}
      <Card className="flex-1 border border-border/40 shadow-card bg-card">
        <CardContent className="p-0">
          <form className="flex flex-col h-full" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
            {/* Email Header Fields */}
            <div className="space-y-1 p-6 border-b bg-muted/20">
              {/* From Field */}
              <div className="flex items-center gap-4">
                <Label htmlFor="from" className="text-sm font-medium text-muted-foreground w-16 flex-shrink-0">
                  From
                </Label>
                <Select value={from} onValueChange={setFrom}>
                  <SelectTrigger id="from" className="border-0 bg-transparent hover:bg-muted/50 focus:bg-background">
                    <SelectValue placeholder="Choose sender..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.emailAddress}>
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
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
              <div className="flex items-center gap-4">
                <Label htmlFor="to" className="text-sm font-medium text-muted-foreground w-16 flex-shrink-0">
                  To
                </Label>
                <Input
                  id="to"
                  type="email"
                  placeholder="recipient@example.com"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="border-0 bg-transparent hover:bg-muted/50 focus:bg-background"
                  required
                />
              </div>

              {/* Subject Field */}
              <div className="flex items-center gap-4">
                <Label htmlFor="subject" className="text-sm font-medium text-muted-foreground w-16 flex-shrink-0">
                  Subject
                </Label>
                <Input
                  id="subject"
                  placeholder="Enter subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="border-0 bg-transparent hover:bg-muted/50 focus:bg-background"
                  required
                />
              </div>
            </div>

            {/* Message Body */}
            <div className="flex-1 flex flex-col">
              <Textarea
                id="body"
                placeholder="Write your message here..."
                className="flex-1 border-0 bg-transparent resize-none focus:ring-0 text-base leading-relaxed p-6 min-h-[400px]"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-6 py-3 border-t bg-muted/10">
                {attachments.map((file, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-sm">
                    <File className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate max-w-[150px]">{file.name}</span>
                    <span className="text-xs text-muted-foreground">({formatFileSize(file.size)})</span>
                    <button type="button" onClick={() => removeAttachment(i)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <span className="text-xs text-muted-foreground self-center ml-2">
                  {formatFileSize(attachments.reduce((s, a) => s + a.size, 0))} / 10 MB
                </span>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between gap-4 p-6 border-t bg-muted/10">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
                />
                <Button variant="outline" size="sm" type="button" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="h-4 w-4 mr-2" />
                  Attach
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="ghost" type="button" onClick={handleDiscard} className="hover:bg-destructive/10 hover:text-destructive">
                  <Trash className="mr-2 h-4 w-4" />
                  Discard
                </Button>
                <Button variant="outline" type="button" onClick={handleSaveDraft} disabled={savingDraft}>
                  <Save className="mr-2 h-4 w-4" />
                  {savingDraft ? 'Saving...' : 'Save Draft'}
                </Button>
                <Button
                  type="submit"
                  disabled={sending || !from || !to || !subject || !body}
                  className="min-w-[100px] gradient-primary hover:opacity-90 text-white"
                >
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <ComposeForm />
    </Suspense>
  );
}
