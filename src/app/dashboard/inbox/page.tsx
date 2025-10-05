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
          <p className="text-muted-foreground">Inbox functionality will be available soon.</p>
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
            <div className="p-4 text-center text-muted-foreground">Your inbox is empty.</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
