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

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { user, setToken } = useAuthClient();
  const router = useRouter();
  const { toast } = useToast();

  const passwordIsValid = (pw: string) => {
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    return re.test(pw);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    if (!passwordIsValid(password)) {
      const message = 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.';
      setErrorMessage(message);
      toast({ title: 'Invalid password', description: message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, fullName }) });
      let data: any = null;
      try {
        data = await res.json();
      } catch (e) {
      }
      if (!res.ok) {
        const message = (res.status === 409) ? 'An account with this email already exists.' : (data && data.error) ? data.error : 'Unable to register';
        setErrorMessage(message);
        toast({ title: 'Registration failed', description: message, variant: 'destructive' });
        return;
      }
      setToken(data?.token ?? null);
      toast({ title: 'Account created', description: 'Redirecting to dashboard...' });
      router.push('/dashboard');
    } catch (err: any) {
      const message = err?.message ?? 'Network error';
      setErrorMessage(message);
      toast({ title: 'Registration failed', description: message, variant: 'destructive' });
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
            Your domain, your email
          </h2>
          <p className={styles.nu_textWhite70}>
            Create professional email accounts on your own domains. Full API access, team management, and enterprise-grade deliverability.
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
            <h1 className={styles.nu_text2xl2}>Create your account</h1>
            <p className={styles.nu_textSm}>Get started with NubMail for free</p>
          </div>
          <form onSubmit={handleSubmit} method="post" action="/api/auth/register" className={styles.nu_grid} autoComplete="on">
            <div className={styles.nu_grid2}>
              <Label htmlFor="full-name">Full name</Label>
              <Input id="full-name" name="fullName" autoComplete="name" placeholder="Max Robinson" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className={styles.nu_grid2}>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" name="email" autoComplete="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className={styles.nu_grid2}>
              <Label htmlFor="password">Password</Label>
              <div className={styles.nu_relative2}>
                <Input id="password" type={showPassword ? "text" : "password"} name="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={styles.nu_pr10} />
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
              <p className={styles.nu_textXs}>At least 8 characters with uppercase, lowercase, number, and symbol.</p>
            </div>
            {errorMessage && (
              <div role="alert" aria-live="polite" className={styles.nu_textSm2}>
                {errorMessage}
              </div>
            )}
            <Button type="submit" className={styles.nu_wFull2} disabled={loading}>{loading ? 'Creating...' : 'Create account'}</Button>
          </form>
          <div className={styles.nu_mt6}>
            Already have an account? <Link href="/" className={styles.nu_textPrimary}>Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
