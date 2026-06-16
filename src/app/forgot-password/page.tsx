"use client";
import styles from './page.module.css';

import Link from 'next/link';
import { useState } from 'react';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Failed to send reset email',
          variant: 'destructive'
        });
        return;
      }

      setSent(true);
      toast({
        title: 'Reset email sent',
        description: 'Check your email for password reset instructions',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to send reset email',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.nu_flex}>
      <Card className={styles.nu_mxAuto}>
        <CardHeader className={styles.nu_textCenter}>
          <div className={styles.nu_mb2}>
            <Mail className={styles.nu_h8} />
            <h1 className={styles.nu_text2xl}>NubMail</h1>
          </div>
          <CardTitle className={styles.nu_text2xl2}>Forgot Password</CardTitle>
          <CardDescription>
            {sent 
              ? 'We\'ve sent you a password reset link' 
              : 'Enter your email to reset your password'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sent ? (
            <form onSubmit={handleSubmit} method="post" className={styles.nu_grid} autoComplete="on">
              <div className={styles.nu_grid2}>
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="m@example.com" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                />
              </div>
              <Button type="submit" className={styles.nu_wFull} disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
              <Link href="/" className={styles.nu_flex2}>
                <ArrowLeft className={styles.nu_h4} />
                Back to login
              </Link>
            </form>
          ) : (
            <div className={styles.nu_spaceY4}>
              <div className={styles.nu_roundedXl}>
                <p className={styles.nu_textSm}>
                  If an account exists with <strong>{email}</strong>, you will receive a password reset link shortly.
                </p>
              </div>
              <Link href="/" className={styles.nu_flex2}>
                <ArrowLeft className={styles.nu_h4} />
                Back to login
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
