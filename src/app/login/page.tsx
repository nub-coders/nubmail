"use client";

import styles from './page.module.css';
import Link from 'next/link';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthClient } from '@/lib/auth-provider';

const ERROR_MESSAGES: Record<string, string> = {
  credentials: 'Invalid email or password.',
  missing: 'Please enter both email and password.',
  invalid: 'Invalid request. Please try again.',
  server: 'Server error. Please try again later.',
};

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, setUser } = useAuthClient();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (user) window.location.href = '/dashboard';
  }, [user]);

  useEffect(() => {
    const urlError = searchParams.get('error');
    if (urlError) {
      setError(ERROR_MESSAGES[urlError] || 'An error occurred. Please try again.');
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Invalid email or password.');
        return;
      }

      const data = await res.json();
      if (data?.user) setUser(data.user);
      window.location.href = '/dashboard';
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.nu_flex}>
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

          <form
            method="post"
            action="/api/auth/login"
            onSubmit={handleSubmit}
            className={styles.nu_grid}
            autoComplete="on"
          >
            <div className={styles.nu_grid2}>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                name="email"
                autoComplete="username"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className={styles.nu_grid2}>
              <div className={styles.nu_flex4}>
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className={styles.nu_mlAuto}>
                  Forgot password?
                </Link>
              </div>
              <div className={styles.nu_relative2}>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.nu_pr10}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={styles.nu_absolute2}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className={styles.nu_h4} /> : <Eye className={styles.nu_h4} />}
                </Button>
              </div>
            </div>

            {error && (
              <div role="alert" aria-live="polite" className={styles.nu_textSm2}>
                {error}
              </div>
            )}

            <Button type="submit" className={styles.nu_wFull2} disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className={styles.nu_mt6}>
            Don&apos;t have an account?{' '}
            <Link href="/register" className={styles.nu_textPrimary}>
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
