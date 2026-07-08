'use client';
import styles from './page.module.css';

import { useEffect, useState } from 'react';
import { Shield, Calendar, Save, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuthClient } from '@/lib/auth-provider';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
}

export default function ProfilePage() {
  const { user, refresh } = useAuthClient();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);

  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const res = await fetch('/api/profile', {
          credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
          setProfile(data.user);
          setFullName(data.user.fullName || '');
        }
      } catch {} finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleSaveName = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile(prev => prev ? { ...prev, fullName: data.user.fullName } : null);
      if (data.token) await refresh();
      toast({ title: 'Saved', description: 'Display name updated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.token) await refresh();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Saved', description: 'Password changed successfully' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to change password', variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleResendVerification = async () => {
    setSendingVerification(true);
    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send verification email');
      toast({ title: 'Verification sent', description: 'Please check your email inbox for the verification link.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to send verification email', variant: 'destructive' });
    } finally {
      setSendingVerification(false);
    }
  };

  if (!user) {
    return <div className={styles.nu_py8}>You must be signed in to view your profile.</div>;
  }

  if (isLoading) {
    return (
      <div className={styles.nu_py12}>
        <LoadingSpinner size="md" text="Loading profile..." />
      </div>
    );
  }

  return (
    <div className={styles.nu_flex}>
      <div className={styles.nu_spaceY2}>
        <h1 className={styles.nu_text2xl}>Profile</h1>
        <p className={styles.nu_textSm}>Manage your account information</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Info</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className={styles.nu_spaceY4}>
          <div className={styles.nu_flex2}>
            <div className={styles.nu_h16}>
              <span className={styles.nu_text2xl2}>
                {(profile?.fullName || profile?.email || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className={styles.nu_spaceY1}>
              <div className={styles.nu_flex3}>
                <span className={styles.nu_fontSemibold}>{profile?.fullName || 'No display name'}</span>
                {profile?.isAdmin && (
                  <Badge variant="secondary" className={styles.nu_bgPrimary10}>
                    <Shield className={styles.nu_h3} />
                    Admin
                  </Badge>
                )}
              </div>
              <div className={styles.nu_flex3}>
                <p className={styles.nu_textSm}>{profile?.email}</p>
                {!profile?.emailVerified && (
                  <Button
                    type="button"
                    variant="link"
                    className={styles.nu_hAuto}
                    onClick={handleResendVerification}
                    disabled={sendingVerification}
                  >
                    {sendingVerification ? 'Sending...' : 'Resend'}
                  </Button>
                )}
              </div>
              <div className={styles.nu_pt1}>
                {profile?.emailVerified ? (
                  <Badge variant="secondary" className={styles.nu_bgGreen50010}>
                    <CheckCircle2 className={styles.nu_h3} />
                    Email verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" className={styles.nu_bgAmber50010}>
                    <AlertCircle className={styles.nu_h3} />
                    Email not verified
                  </Badge>
                )}
              </div>
              {profile?.createdAt && (
                <p className={styles.nu_textXs}>
                  <Calendar className={styles.nu_h32} />
                  Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display Name</CardTitle>
          <CardDescription>This is how your name appears in emails and the dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={styles.nu_flex4}>
            <div className={styles.nu_flex1}>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your display name"
              />
            </div>
            <Button onClick={handleSaveName} disabled={saving}>
              <Save className={styles.nu_h4} />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className={styles.nu_flex3}>
            <Lock className={styles.nu_h5} />
            Change Password
          </CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent className={styles.nu_spaceY4}>
          <div className={styles.nu_spaceY2}>
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>
          <div className={styles.nu_spaceY2}>
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 characters)"
            />
          </div>
          <div className={styles.nu_spaceY2}>
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
          >
            {changingPassword ? 'Changing...' : 'Change Password'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
