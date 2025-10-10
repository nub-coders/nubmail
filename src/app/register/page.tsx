"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Eye, EyeOff } from 'lucide-react';

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
    // At least 8 chars, one uppercase, one lowercase, one digit, one special char
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
        // console.warn('Failed to parse JSON response', e);
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
      // console.error('Registration error', err);
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Mail className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">NubMail</h1>
          </div>
          <CardTitle className="text-2xl">Sign Up</CardTitle>
          <CardDescription>Enter your information to create an account</CardDescription>
        </CardHeader>
        <CardContent>
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
              <div className="text-sm text-muted-foreground">Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.</div>
            </div>
            {errorMessage && (
              <div role="alert" aria-live="polite" className="text-sm text-destructive">
                {errorMessage}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Creating...' : 'Create an account'}</Button>
          </form>
          <div className="mt-4 text-center text-sm">Already have an account? <Link href="/" className="underline">Login</Link></div>
        </CardContent>
      </Card>
    </div>
  );
}
