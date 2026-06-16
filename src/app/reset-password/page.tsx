"use client";
import styles from './page.module.css';

import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Eye, EyeOff, ArrowLeft } from 'lucide-react';
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

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const token = searchParams.get('token');

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setVerifying(false);
        setValidToken(false);
        toast({
          title: 'Invalid link',
          description: 'No reset token provided',
          variant: 'destructive'
        });
        return;
      }

      try {
        const res = await fetch('/api/auth/verify-reset-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        const data = await res.json();

        if (!res.ok) {
          setValidToken(false);
          toast({
            title: 'Invalid or expired link',
            description: data.error || 'This reset link is no longer valid',
            variant: 'destructive'
          });
        } else {
          setValidToken(true);
        }
      } catch (err) {
        setValidToken(false);
        toast({
          title: 'Error',
          description: 'Failed to verify reset link',
          variant: 'destructive'
        });
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token, toast]);

  const passwordIsValid = (pw: string) => {
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    return re.test(pw);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordIsValid(password)) {
      toast({
        title: 'Invalid password',
        description: 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol',
        variant: 'destructive'
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords match',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: 'Reset failed',
          description: data.error || 'Failed to reset password',
          variant: 'destructive'
        });
        return;
      }

      setResetSuccess(true);
      toast({
        title: 'Password reset successful',
        description: 'You can now login with your new password',
      });

      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to reset password',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className={styles.nu_flex}>
        <Card className={styles.nu_mxAuto}>
          <CardContent className={styles.nu_pt6}>
            <div className={styles.nu_flex2}>
              <div className={styles.nu_animateSpin}></div>
            </div>
            <p className={styles.nu_textCenter}>Verifying reset link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!validToken) {
    return (
      <div className={styles.nu_flex}>
        <Card className={styles.nu_mxAuto}>
          <CardHeader className={styles.nu_textCenter2}>
            <div className={styles.nu_mb2}>
              <Mail className={styles.nu_h8} />
              <h1 className={styles.nu_text2xl}>NubMail</h1>
            </div>
            <CardTitle className={styles.nu_text2xl2}>Invalid Reset Link</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={styles.nu_spaceY4}>
              <Link href="/forgot-password">
                <Button className={styles.nu_wFull}>Request New Reset Link</Button>
              </Link>
              <Link href="/" className={styles.nu_flex3}>
                <ArrowLeft className={styles.nu_h4} />
                Back to login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resetSuccess) {
    return (
      <div className={styles.nu_flex}>
        <Card className={styles.nu_mxAuto}>
          <CardHeader className={styles.nu_textCenter2}>
            <div className={styles.nu_mb2}>
              <Mail className={styles.nu_h8} />
              <h1 className={styles.nu_text2xl}>NubMail</h1>
            </div>
            <CardTitle className={styles.nu_text2xl2}>Password Reset Complete</CardTitle>
            <CardDescription>
              Your password has been successfully reset
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={styles.nu_roundedXl}>
              <p className={styles.nu_textSm}>
                Redirecting to login...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.nu_flex4}>
      <Card className={styles.nu_mxAuto2}>
        <CardHeader className={styles.nu_textCenter2}>
          <div className={styles.nu_mb2}>
            <Mail className={styles.nu_h8} />
            <h1 className={styles.nu_text3xl}>NubMail</h1>
          </div>
          <CardTitle className={styles.nu_text2xl2}>Reset Password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} method="post" className={styles.nu_grid} autoComplete="on">
            <div className={styles.nu_grid2}>
              <Label htmlFor="password">New Password</Label>
              <div className={styles.nu_relative}>
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="new-password"
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.nu_pr10}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={styles.nu_absolute}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className={styles.nu_h42} />
                  ) : (
                    <Eye className={styles.nu_h42} />
                  )}
                </Button>
              </div>
              <p className={styles.nu_textXs}>
                At least 8 characters with uppercase, lowercase, number, and symbol
              </p>
            </div>
            <div className={styles.nu_grid2}>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className={styles.nu_relative}>
                <Input 
                  id="confirmPassword" 
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  autoComplete="new-password"
                  required 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={styles.nu_pr10}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={styles.nu_absolute}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className={styles.nu_h42} />
                  ) : (
                    <Eye className={styles.nu_h42} />
                  )}
                </Button>
              </div>
            </div>
            <Button type="submit" className={styles.nu_wFull} disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </Button>
            <Link href="/" className={styles.nu_flex3}>
              <ArrowLeft className={styles.nu_h4} />
              Back to login
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className={styles.nu_flex}>
        <Card className={styles.nu_mxAuto}>
          <CardContent className={styles.nu_pt6}>
            <div className={styles.nu_flex2}>
              <div className={styles.nu_animateSpin}></div>
            </div>
            <p className={styles.nu_textCenter}>Loading...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
