'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Bell, AlertTriangle, Mail, CheckCircle, XCircle } from 'lucide-react';
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
  const { user, setToken } = useAuthClient();
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
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setToken(null);
      router.push('/');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete account', variant: 'destructive' });
      setDeleting(false);
    }
  };

  if (!user) {
    return <div className="py-8 text-center">You must be signed in to view settings.</div>;
  }

  if (isLoading) {
    return (
      <div className="py-12">
        <LoadingSpinner size="md" text="Loading settings..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Account
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium">Email</span>
            <span className="text-sm text-muted-foreground">{profile?.email}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium">Verified</span>
            {profile?.emailVerified ? (
              <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Not verified
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium">Member since</span>
            <span className="text-sm text-muted-foreground">
              {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '-'}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Configure how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">Email notifications</Label>
              <p className="text-xs text-muted-foreground">Receive email alerts for new messages</p>
            </div>
            <Switch
              id="email-notifications"
              checked={emailNotifications}
              onCheckedChange={handleNotificationToggle}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions that affect your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Delete account</p>
              <p className="text-xs text-muted-foreground">
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
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
