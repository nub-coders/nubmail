"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

export default function VerifyEmailPage() {
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (verified) {
      setTimeout(() => router.push('/dashboard'), 1500);
    }
  }, [verified, router]);

  const handleSendCode = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-verification', { 
        method: 'POST', 
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } 
      });
      const data = await res.json();
      
      if (!res.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Failed to send verification code',
          variant: 'destructive'
        });
        return;
      }
      
      setCodeSent(true);
      toast({
        title: 'Code sent',
        description: 'Check your email for the verification code',
      });
    } catch (err) {
      console.error('Send verification failed', err);
      toast({
        title: 'Error',
        description: 'Failed to send verification code',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      toast({
        title: 'Invalid code',
        description: 'Please enter a 6-digit code',
        variant: 'destructive'
      });
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}` 
        },
        body: JSON.stringify({ code })
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: 'Verification failed',
          description: data.error || 'Invalid verification code',
          variant: 'destructive'
        });
        return;
      }

      setVerified(true);
      toast({
        title: 'Success',
        description: 'Email verified! Redirecting to dashboard...',
      });
    } catch (err) {
      console.error('Verify code failed', err);
      toast({
        title: 'Error',
        description: 'Failed to verify code',
        variant: 'destructive'
      });
    } finally {
      setVerifying(false);
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
          <CardDescription>
            {codeSent 
              ? 'Enter the 6-digit code sent to your email' 
              : 'We\'ll send a verification code to your email'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {verified ? (
            <div className="text-center text-sm text-green-600">Email verified! Redirecting to dashboard...</div>
          ) : codeSent ? (
            <form onSubmit={handleVerifyCode} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={verifying || code.length !== 6} className="w-full">
                {verifying ? 'Verifying...' : 'Verify Code'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleSendCode} 
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Sending...' : 'Resend Code'}
              </Button>
            </form>
          ) : (
            <div className="grid gap-4">
              <p className="text-sm text-muted-foreground">
                Click the button below to receive a verification code. The code will be valid for 10 minutes.
              </p>
              <Button onClick={handleSendCode} disabled={loading} className="w-full">
                {loading ? 'Sending...' : 'Send Verification Code'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
