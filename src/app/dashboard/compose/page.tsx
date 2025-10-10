"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Paperclip, Send, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useAuthClient } from '@/lib/auth-provider';

export default function ComposePage() {
  const { user } = useAuthClient();
  const router = useRouter();
  const { toast } = useToast();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [from, setFrom] = useState('');
  const [accounts, setAccounts] = useState<{ id: string; emailAddress: string }[]>([]);

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

  const handleDiscard = () => {
    if (to || subject || body) {
      if (confirm('Are you sure you want to discard this message?')) {
        setTo('');
        setSubject('');
        setBody('');
      }
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
        body: JSON.stringify({ from, to, subject, text: body })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      toast({
        title: 'Email sent!',
        description: `Your message has been sent to ${to}`
      });

      setTo('');
      setSubject('');
      setBody('');

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
            <Send className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Compose Email</h1>
          </div>
          <p className="text-sm text-muted-foreground">Draft and send your new message</p>
        </div>
      </div>

      {/* Compose Form */}
      <Card className="flex-1 border-0 shadow-lg bg-card/50 backdrop-blur-sm">
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

            {/* Action Bar */}
            <div className="flex items-center justify-between gap-4 p-6 border-t bg-muted/10">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" type="button" disabled className="opacity-50">
                  <Paperclip className="h-4 w-4 mr-2" />
                  Attach
                  <span className="ml-1 text-xs text-muted-foreground">(Soon)</span>
                </Button>
              </div>
              
              <div className="flex items-center gap-3">
                <Button variant="ghost" type="button" onClick={handleDiscard} className="hover:bg-destructive/10 hover:text-destructive">
                  <Trash className="mr-2 h-4 w-4" />
                  Discard
                </Button>
                <Button 
                  type="submit" 
                  disabled={sending || !from || !to || !subject || !body}
                  className="min-w-[100px]"
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
