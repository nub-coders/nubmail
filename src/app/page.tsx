"use client";
import styles from './page.module.css';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuthClient } from '@/lib/auth-provider';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { user, setToken, isLoading: authLoading } = useAuthClient();
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      let data: any = null;
      try {
        data = await res.json();
      } catch (e) {
        console.warn('Failed to parse JSON response', e);
      }
      if (!res.ok) {
        const message = 'Invalid email or password. Please try again.';
        setErrorMessage(message);
        toast({ title: 'Sign in failed', description: message, variant: 'destructive' });
        return;
      }

      toast({ title: 'Signing in...', description: 'Please wait...' });
      await setToken(data?.token ?? null);
      toast({ title: 'Signed in', description: 'Redirecting to dashboard...' });
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Login error', err);
      const message = err?.message ?? 'Network error';
      setErrorMessage(message);
      toast({ title: 'Sign in failed', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) router.push('/dashboard');
  }, [user, router]);

  return (
    <div className={styles.nu_flex}>
      {/* Left panel - Branding */}
      <div className={styles.nu_hidden}>
        <div className={styles.nu_absolute} style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className={styles.nu_relative}>
          <div className={styles.nu_flex2}>
            <div className={styles.nu_h12}>
              <Mail className={styles.nu_h6} />
            </div>
            <span className={styles.nu_text2xl}>NubMail</span>
          </div>
          <h2 className={styles.nu_text3xl}>
            Professional email for your custom domains
          </h2>
          <p className={styles.nu_textWhite70}>
            Send, receive, and manage emails with your own domain. Built-in SMTP, DKIM signing, and API access included.
          </p>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className={styles.nu_flex3}>
        <div className={styles.nu_wFull}>
          <div className={styles.nu_mb8}>
            <Mail className={styles.nu_h7} />
            <span className={styles.nu_text2xl}>NubMail</span>
          </div>
          <div className={styles.nu_spaceY2}>
            <h1 className={styles.nu_text2xl2}>Welcome back</h1>
            <p className={styles.nu_textSm}>Enter your credentials to sign in</p>
          </div>
          <form onSubmit={handleSubmit} method="post" action="/api/auth/login" className={styles.nu_grid} autoComplete="on">
            <div className={styles.nu_grid2}>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" name="email" autoComplete="username" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className={styles.nu_grid2}>
              <div className={styles.nu_flex4}>
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className={styles.nu_mlAuto}>Forgot password?</Link>
              </div>
              <div className={styles.nu_relative2}>
                <Input id="password" type={showPassword ? "text" : "password"} name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={styles.nu_pr10} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={styles.nu_absolute2}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className={styles.nu_h4} />
                  ) : (
                    <Eye className={styles.nu_h4} />
                  )}
                </Button>
              </div>
            </div>
            {errorMessage && (
              <div role="alert" aria-live="polite" className={styles.nu_textSm2}>
                {errorMessage}
              </div>
            )}
            <Button type="submit" className={styles.nu_wFull2} disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</Button>
          </form>
          <div className={styles.nu_mt6}>
            Don&apos;t have an account? <Link href="/register" className={styles.nu_textPrimary}>Sign up</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
