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
            Your domain, your email
          </h2>
          <p className="text-white/70 text-lg leading-relaxed">
            Create professional email accounts on your own domains. Full API access, team management, and enterprise-grade deliverability.
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
            <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
            <p className="text-sm text-muted-foreground">Get started with NubMail for free</p>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input id="full-name" placeholder="Max Robinson" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
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
              <p className="text-xs text-muted-foreground">At least 8 characters with uppercase, lowercase, number, and symbol.</p>
            </div>
            {errorMessage && (
              <div role="alert" aria-live="polite" className="text-sm text-destructive">
                {errorMessage}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Creating...' : 'Create account'}</Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account? <Link href="/" className="text-primary hover:underline font-medium">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
