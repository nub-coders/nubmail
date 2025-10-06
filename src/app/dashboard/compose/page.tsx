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
      console.error('Send email error:', error);
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
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold">Compose Email</h1>
        <p className="text-muted-foreground">Draft and send your new message.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New Message</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
            <div className="grid gap-2">
              <Label htmlFor="from">From</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger id="from">
                  <SelectValue placeholder="Choose a sender" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.emailAddress}>{a.emailAddress}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="to">To</Label>
              <Input 
                id="to" 
                type="email" 
                placeholder="recipient@example.com" 
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subject">Subject</Label>
              <Input 
                id="subject" 
                placeholder="Your subject line" 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="body">Message</Label>
              <Textarea 
                id="body" 
                placeholder="Write your message here..." 
                className="min-h-[300px]" 
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" type="button" disabled>
                  <Paperclip className="h-4 w-4" />
                  <span className="sr-only">Attach file</span>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" type="button" onClick={handleDiscard}>
                  <Trash className="mr-2 h-4 w-4" />
                  Discard
                </Button>
                <Button type="submit" disabled={sending}>
                  <Send className="mr-2 h-4 w-4" />
                  {sending ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
