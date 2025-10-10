'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, X, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { useAuthClient } from '@/lib/auth-provider';

interface Email {
  id: string;
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  sentAt: string;
  read: boolean;
}

export default function InboxPage() {
  const { user } = useAuthClient();
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isEmailOpen, setIsEmailOpen] = useState(false);


  const fetchEmails = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/emails?folder=inbox', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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

  useEffect(() => {
    fetchEmails();
  }, [user]);

  const handleMarkAsRead = async (emailId: string) => {
    try {
      await fetch('/api/emails', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ emailId, read: true })
      });
      // Refetch emails from backend to ensure UI matches DB
      await fetchEmails();
    } catch (error) {
    }
  };

  const handleEmailClick = (email: Email) => {
    setSelectedEmail(email);
    setIsEmailOpen(true);
    if (!email.read) {
      handleMarkAsRead(email.id);
    }
  };

  if (!user) {
    return (
      <div className="py-8 text-center">You must be signed in to view your inbox.</div>
    );
  }

  const unreadCount = emails.filter(e => !e.read).length;
  
  const filteredEmails = emails.filter(email => 
    searchQuery === '' || 
    email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.body.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inbox</h1>
          <p className="text-muted-foreground">
            {isLoading ? 'Loading messages...' : `You have ${unreadCount} unread messages.`}
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search emails..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card className="flex-1">
        <CardContent className="p-0">
          <div className="flex flex-col">
            {isLoading && <div className="p-4 text-center">Loading emails...</div>}
            {!isLoading && filteredEmails.length === 0 && (
              <div className="p-4 text-center text-muted-foreground">
                {searchQuery ? 'No emails match your search.' : 'Your inbox is empty.'}
              </div>
            )}
            {filteredEmails.map((email) => (
              <button
                key={email.id}
                onClick={() => handleEmailClick(email)}
                className={cn(
                  'flex flex-col items-start gap-2 border-b p-4 text-left text-sm transition-all hover:bg-secondary w-full cursor-pointer',
                  !email.read && 'bg-secondary/50'
                )}
              >
                <div className="flex w-full items-center">
                  <div className="flex items-center gap-2">
                    {!email.read && (
                      <span className="flex h-2 w-2 rounded-full bg-primary" />
                    )}
                    <div
                      className={cn(
                        'font-semibold',
                        !email.read && 'font-bold'
                      )}
                    >
                      {email.sender}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'ml-auto text-xs',
                      !email.read
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {new Date(email.sentAt).toLocaleDateString()}
                  </div>
                </div>
                <div
                  className={cn('text-xs font-medium', !email.read && 'font-bold')}
                >
                  {email.subject || '(No Subject)'}
                </div>
                <div className="line-clamp-2 text-xs text-muted-foreground">
                  {email.body.replace(/<[^>]*>?/gm, '')}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email Viewer Dialog */}
      <Dialog open={isEmailOpen} onOpenChange={setIsEmailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Button
                variant="ghost" 
                size="sm"
                onClick={() => setIsEmailOpen(false)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Inbox
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {selectedEmail && (
            <div className="flex flex-col gap-4 overflow-hidden">
              <div className="space-y-2 border-b pb-4">
                <h2 className="text-xl font-semibold">
                  {selectedEmail.subject || '(No Subject)'}
                </h2>
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
                    __html: selectedEmail.body || selectedEmail.body?.replace(/\n/g, '<br>') || 'No content'
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
