"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function VerifyEmailPage() {
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const search = useSearchParams();
  const verified = search?.get('verified');

  useEffect(() => {
    if (verified) {
      // show a brief success and redirect to login
      setTimeout(() => router.push('/'), 1500);
    }
  }, [verified, router]);

  const handleSend = async () => {
    setLoading(true);
    setLink(null);
    try {
      const res = await fetch('/api/auth/send-verification', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
      const data = await res.json();
      if (!res.ok) {
        setLink(null);
        return;
      }
      setLink(data.verificationUrl || null);
    } catch (err) {
      console.error('Send verification failed', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Mail className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Verify your email</h1>
          </div>
          <CardTitle className="text-lg">Email verification required</CardTitle>
          <CardDescription>Please verify your email to continue. A verification link will be sent to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {verified ? (
            <div className="text-center text-sm text-green-600">Email verified! Redirecting to login...</div>
          ) : (
            <div className="grid gap-4">
              <div className="text-sm">Click the button below to generate a verification link. In production this link would be emailed to you.</div>
              <Button onClick={handleSend} disabled={loading} className="w-full">{loading ? 'Sending...' : 'Send verification link'}</Button>
              {link && (
                <div className="text-sm break-all">
                  Verification link (development): <a className="underline text-primary" href={link}>{link}</a>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
