"use client";
import styles from './page.module.css';

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
      return;
    }
    const tokenFromUrl = searchParams.get('token');
    if (!tokenFromUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenFromUrl }),
          credentials: 'include',
        });
        if (cancelled) return;
        if (res.ok) {
          setVerified(true);
        } else {
          const data = await res.json().catch(() => ({}));
          toast({ title: 'Verification failed', description: data?.error || 'Invalid or expired link', variant: 'destructive' });
        }
      } catch {
        if (!cancelled) {
          toast({ title: 'Verification failed', description: 'Network error', variant: 'destructive' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, toast]);

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
    <div className={styles.nu_flex}>
      <Card className={styles.nu_mxAuto}>
        <CardHeader className={styles.nu_textCenter}>
          <div className={styles.nu_mb2}>
            <Mail className={styles.nu_h8} />
            <h1 className={styles.nu_text2xl}>Verify your email</h1>
          </div>
          <CardTitle className={styles.nu_textLg}>Email verification required</CardTitle>
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
            <div className={styles.nu_textCenter2}>Email verified! Redirecting to dashboard...</div>
          ) : linkSent ? (
            <div className={styles.nu_grid}>
              <p className={styles.nu_textSm}>
                Open the email and click the verification link. If you cannot find it, check your spam folder.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handleSendLink}
                disabled={loading}
                className={styles.nu_wFull}
              >
                {loading ? 'Sending...' : 'Resend Verification Email'}
              </Button>
              <Button type="button" variant="ghost" onClick={handleLogout} className={styles.nu_wFull2}>
                Log out
              </Button>
            </div>
          ) : (
            <div className={styles.nu_grid}>
              <p className={styles.nu_textSm}>
                Click below to receive a one-click verification link. The link will be valid for 30 minutes.
              </p>
              <Button onClick={handleSendLink} disabled={loading} className={styles.nu_wFull}>
                {loading ? 'Sending...' : 'Send Verification Email'}
              </Button>
              <Button type="button" variant="ghost" onClick={handleLogout} className={styles.nu_wFull2}>
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
    <Suspense fallback={<div className={styles.nu_flex2}>Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
