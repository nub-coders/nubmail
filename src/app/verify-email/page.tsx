"use client";

import { Suspense, useEffect, useState } from 'react';
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
import { useToast } from '@/components/ui/use-toast';
import { useAuthClient } from '@/lib/auth-provider';

function VerifyEmailContent() {
  const [linkSent, setLinkSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { setToken } = useAuthClient();

  useEffect(() => {
    if (searchParams.get('verified') === '1') {
      setVerified(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (verified) {
      setTimeout(() => router.push('/dashboard'), 1500);
    }
  }, [verified, router]);

  const handleSendLink = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Failed to send verification link',
          variant: 'destructive'
        });
        return;
      }

      setLinkSent(true);
      toast({
        title: 'Verification email sent',
        description: 'Check your inbox and click the verification link',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to send verification link',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await setToken(null);
      router.push('/');
    } catch (err) {
      toast({ title: 'Error', description: 'Could not log out', variant: 'destructive' });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <Card className="mx-auto w-full max-w-md shadow-elevated border-border/50">
        <CardHeader className="text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Mail className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Verify your email</h1>
          </div>
          <CardTitle className="text-lg">Email verification required</CardTitle>
          <CardDescription>
            {verified
              ? 'Your email is verified. Redirecting...'
              : linkSent
              ? 'We sent a verification link to your email'
              : 'We\'ll send a verification link to your email'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {verified ? (
            <div className="text-center text-sm text-green-600">Email verified! Redirecting to dashboard...</div>
          ) : linkSent ? (
            <div className="grid gap-4">
              <p className="text-sm text-muted-foreground">
                Open the email and click the verification link. If you cannot find it, check your spam folder.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handleSendLink}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Sending...' : 'Resend Verification Email'}
              </Button>
              <Button type="button" variant="ghost" onClick={handleLogout} className="w-full mt-2">
                Log out
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              <p className="text-sm text-muted-foreground">
                Click below to receive a one-click verification link. The link will be valid for 30 minutes.
              </p>
              <Button onClick={handleSendLink} disabled={loading} className="w-full">
                {loading ? 'Sending...' : 'Send Verification Email'}
              </Button>
              <Button type="button" variant="ghost" onClick={handleLogout} className="w-full mt-2">
                Log out
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center p-4">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
