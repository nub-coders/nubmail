'use client';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { useAuthClient } from '@/lib/auth-provider';

export default function InboxPage() {
  const { user } = useAuthClient();

  if (!user) {
    return (
      <div className="py-8 text-center">You must be signed in to view your inbox.</div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inbox</h1>
          <p className="text-muted-foreground">Inbox view is not yet migrated from Firebase. Please check back later.</p>
        </div>
      </div>
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
          />
        </div>
      </div>

      <Card className="flex-1">
        <CardContent className="p-0">
          <div className="flex flex-col">
            {isLoading && <div className="p-4 text-center">Loading emails...</div>}
            {!isLoading && (!emails || emails.length === 0) && (
                 <div className="p-4 text-center text-muted-foreground">Your inbox is empty.</div>
            )}
            {(emails || []).map((email: any) => (
              <Link
                key={email.id}
                href="#"
                className={cn(
                  'flex flex-col items-start gap-2 border-b p-4 text-left text-sm transition-all hover:bg-secondary',
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
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
