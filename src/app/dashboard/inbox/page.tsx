'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Mail, MailOpen, Clock, Archive, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
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
  const router = useRouter();
  const { user } = useAuthClient();
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');


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

  const handleEmailClick = (email: Email) => {
    router.push(`/dashboard/inbox/${email.id}`);
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
    <div className="flex flex-col gap-6 h-full">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Mail className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Loading messages...' : `${emails.length} messages`}
            </p>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                <MailOpen className="h-3 w-3 mr-1" />
                {unreadCount} unread
              </Badge>
            )}
          </div>
        </div>
        
        {/* Search and Actions */}
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search emails..."
              className="pl-10 bg-background/60 backdrop-blur-sm border-border/50 focus:bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Email List */}
      <Card className="flex-1 border-0 shadow-sm bg-card/50 backdrop-blur-sm">
        <CardContent className="p-0">
          <div className="flex flex-col">
            {isLoading && (
              <div className="py-12">
                <LoadingSpinner size="md" text="Loading your emails..." />
              </div>
            )}
            {!isLoading && filteredEmails.length === 0 && (
              <EmptyState
                icon={<Mail className="h-16 w-16" />}
                title={searchQuery ? 'No matching emails' : 'Your inbox is empty'}
                description={
                  searchQuery 
                    ? 'Try adjusting your search terms to find what you\'re looking for.'
                    : 'New emails will appear here when they arrive. Check back later or compose a new message to get started.'
                }
                action={
                  !searchQuery 
                    ? {
                        label: 'Compose Email',
                        onClick: () => window.location.href = '/dashboard/compose'
                      }
                    : undefined
                }
              />
            )}
            {filteredEmails.map((email, index) => (
              <div
                key={email.id}
                className={cn(
                  'group relative border-b border-border/50 last:border-b-0 transition-all-300 animate-slide-up hover-lift',
                  'hover:bg-muted/40 hover:border-border',
                  !email.read && 'bg-primary/8 border-l-4 border-l-primary shadow-sm'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <button
                  onClick={() => handleEmailClick(email)}
                  className="w-full p-4 text-left focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-inset"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left side - Email content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        {!email.read && (
                          <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 animate-pulse" />
                        )}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn(
                            'font-medium text-sm truncate',
                            !email.read ? 'font-semibold text-foreground' : 'text-foreground/80'
                          )}>
                            {email.sender}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <h4 className={cn(
                          'text-sm line-clamp-1',
                          !email.read ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'
                        )}>
                          {email.subject || '(No Subject)'}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {email.body.replace(/<[^>]*>?/gm, '').trim() || 'No content preview available'}
                        </p>
                      </div>
                    </div>

                    {/* Right side - Meta info */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-xs font-medium',
                          !email.read ? 'text-foreground' : 'text-muted-foreground'
                        )}>
                          {new Date(email.sentAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: new Date(email.sentAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                          })}
                        </span>
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      </div>
                      
                      {/* Quick actions - visible on hover */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-primary/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Add archive functionality
                          }}
                        >
                          <Archive className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-destructive/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Add delete functionality
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
