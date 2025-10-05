'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
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

  useEffect(() => {
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
        console.error('Failed to fetch emails:', error);
      } finally {
        setIsLoading(false);
      }
    };

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

      setEmails(prev => prev.map(e => 
        e.id === emailId ? { ...e, read: true } : e
      ));
    } catch (error) {
      console.error('Failed to mark email as read:', error);
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
                onClick={() => !email.read && handleMarkAsRead(email.id)}
                className={cn(
                  'flex flex-col items-start gap-2 border-b p-4 text-left text-sm transition-all hover:bg-secondary w-full',
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
                  {email.subject}
                </div>
                <div className="line-clamp-2 text-xs text-muted-foreground">
                  {email.body.replace(/<[^>]*>?/gm, '')}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
