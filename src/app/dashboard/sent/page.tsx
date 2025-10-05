'use client';

import { useEffect, useState } from 'react';
import { Send, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
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

export default function SentPage() {
  const { user } = useAuthClient();
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchEmails = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        const res = await fetch('/api/emails?folder=sent', {
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

  if (!user) {
    return (
      <div className="py-8 text-center">You must be signed in to view sent emails.</div>
    );
  }

  const filteredEmails = emails.filter(email => 
    searchQuery === '' || 
    email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.recipients.some(r => r.toLowerCase().includes(searchQuery.toLowerCase())) ||
    email.body.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sent</h1>
          <p className="text-muted-foreground">
            {isLoading ? 'Loading...' : `${emails.length} sent messages`}
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search sent emails..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card className="flex-1">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 h-96 flex flex-col items-center justify-center text-center">
              <p>Loading sent emails...</p>
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="p-6 h-96 flex flex-col items-center justify-center text-center">
              <Send className="h-16 w-16 text-muted-foreground/50 mb-4"/>
              <h3 className="text-xl font-semibold">
                {searchQuery ? 'No matching emails' : 'No Sent Emails'}
              </h3>
              <p className="text-muted-foreground mt-2">
                {searchQuery ? 'Try a different search term.' : 'Emails you send will appear here.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredEmails.map((email) => (
                <div
                  key={email.id}
                  className="flex flex-col items-start gap-2 border-b p-4 text-sm"
                >
                  <div className="flex w-full items-center">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">
                        To: {email.recipients.join(', ')}
                      </div>
                    </div>
                    <div className="ml-auto text-xs text-muted-foreground">
                      {new Date(email.sentAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-xs font-medium">
                    {email.subject}
                  </div>
                  <div className="line-clamp-2 text-xs text-muted-foreground">
                    {email.body.replace(/<[^>]*>?/gm, '')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
