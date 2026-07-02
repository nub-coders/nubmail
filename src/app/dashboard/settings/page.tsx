'use client';
import styles from './page.module.css';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, AlertTriangle, Mail, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuthClient } from '@/lib/auth-provider';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthClient();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [emailNotifications, setEmailNotifications] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nubmail_email_notifications') !== 'false';
    }
    return true;
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const res = await fetch('/api/profile', {
          credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) setProfile(data.user);
      } catch {} finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleNotificationToggle = (enabled: boolean) => {
    setEmailNotifications(enabled);
    localStorage.setItem('nubmail_email_notifications', String(enabled));
    toast({ title: enabled ? 'Notifications enabled' : 'Notifications disabled' });
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      await logout();
      router.push('/login');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete account', variant: 'destructive' });
      setDeleting(false);
    }
  };

  if (!user) {
    return <div className={styles.nu_py8}>You must be signed in to view settings.</div>;
  }

  if (isLoading) {
    return (
      <div className={styles.nu_py12}>
        <LoadingSpinner size="md" text="Loading settings..." />
      </div>
    );
  }

  return (
    <div className={styles.nu_flex}>
      <div className={styles.nu_spaceY2}>
        <h1 className={styles.nu_text2xl}>Settings</h1>
        <p className={styles.nu_textSm}>Manage your account settings and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className={styles.nu_flex2}>
            <Mail className={styles.nu_h5} />
            Account
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className={styles.nu_spaceY3}>
          <div className={styles.nu_flex3}>
            <span className={styles.nu_textSm2}>Email</span>
            <span className={styles.nu_textSm}>{profile?.email}</span>
          </div>
          <div className={styles.nu_flex3}>
            <span className={styles.nu_textSm2}>Verified</span>
            {profile?.emailVerified ? (
              <Badge variant="secondary" className={styles.nu_bgGreen50010}>
                <CheckCircle className={styles.nu_h3} />
                Verified
              </Badge>
            ) : (
              <Badge variant="secondary" className={styles.nu_bgDestructive10}>
                <XCircle className={styles.nu_h3} />
                Not verified
              </Badge>
            )}
          </div>
          <div className={styles.nu_flex3}>
            <span className={styles.nu_textSm2}>Member since</span>
            <span className={styles.nu_textSm}>
              {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '-'}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className={styles.nu_flex2}>
            <Bell className={styles.nu_h5} />
            Notifications
          </CardTitle>
          <CardDescription>Configure how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={styles.nu_flex4}>
            <div className={styles.nu_spaceY05}>
              <Label htmlFor="email-notifications">Email notifications</Label>
              <p className={styles.nu_textXs}>Receive email alerts for new messages</p>
            </div>
            <Switch
              id="email-notifications"
              checked={emailNotifications}
              onCheckedChange={handleNotificationToggle}
            />
          </div>
        </CardContent>
      </Card>

      <Card className={styles.nu_borderDestructive50}>
        <CardHeader>
          <CardTitle className={styles.nu_flex5}>
            <AlertTriangle className={styles.nu_h5} />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions that affect your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={styles.nu_flex4}>
            <div className={styles.nu_spaceY05}>
              <p className={styles.nu_textSm2}>Delete account</p>
              <p className={styles.nu_textXs}>
                Permanently delete your account and all associated data including domains, email accounts, and messages.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={deleting}>
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account, all your domains, email accounts, messages, and drafts.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className={styles.nu_bgDestructive}
                  >
                    Delete Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
