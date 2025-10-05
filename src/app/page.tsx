"use client";

"use client";
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';

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

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, setToken } = useAuthClient();
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Sign in failed', description: data.error || 'Unable to sign in', variant: 'destructive' });
        return;
      }
      setToken(data.token);
      toast({ title: 'Signed in', description: 'Redirecting to dashboard...' });
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Login error', err);
      toast({ title: 'Sign in failed', description: 'Network error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Always render the login form server-side and client-side to avoid hydration mismatches.
  // Redirect to dashboard on the client when the user becomes available.
  React.useEffect(() => {
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
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>Enter your email below to login to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link href="#" className="ml-auto inline-block text-sm underline">Forgot your password?</Link>
              </div>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Signing in...' : 'Login'}</Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account? <Link href="/register" className="underline">Sign up</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
