"use client";

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
    <div className="flex min-h-screen">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10 max-w-md px-8 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Mail className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold">NubMail</span>
          </div>
          <h2 className="text-3xl font-bold leading-tight mb-4">
            Professional email for your custom domains
          </h2>
          <p className="text-white/70 text-lg leading-relaxed">
            Send, receive, and manage emails with your own domain. Built-in SMTP, DKIM signing, and API access included.
          </p>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-8 bg-background">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center justify-center gap-2">
            <Mail className="h-7 w-7 text-primary" />
            <span className="text-2xl font-bold">NubMail</span>
          </div>
          <div className="space-y-2 mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Enter your credentials to sign in</p>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="ml-auto inline-block text-sm text-muted-foreground hover:text-foreground transition-colors">Forgot password?</Link>
              </div>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            {errorMessage && (
              <div role="alert" aria-live="polite" className="text-sm text-destructive">
                {errorMessage}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account? <Link href="/register" className="text-primary hover:underline font-medium">Sign up</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
