'use client';

import { useEffect, useState } from 'react';
import { Key, Plus, Trash2, Copy, Eye, EyeOff, CheckCircle, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuthClient } from '@/lib/auth-provider';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ApiKey {
  id: string;
  name: string;
  createdAt: string;
  lastUsed: string | null;
}

interface EmailAccount {
  id: string;
  email_address: string;
  has_imap_password: boolean;
}

export default function DeveloperPage() {
  const { user } = useAuthClient();
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // IMAP/POP3 password setup
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [imapPassword, setImapPassword] = useState('');
  const [confirmImapPassword, setConfirmImapPassword] = useState('');
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [showImapPassword, setShowImapPassword] = useState(false);
  
  // Get the current host dynamically
  const apiHost = typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.host}` 
    : 'https://mails.nubcoder.com';

  const fetchKeys = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/api-keys', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok) {
        setKeys(data.keys || []);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load API keys'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmailAccounts = async () => {
    if (!user) return;
    setIsLoadingAccounts(true);
    try {
      const res = await fetch('/api/accounts', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (res.ok) {
        // Map API response to local interface
        const mappedAccounts = data.accounts.map((account: any) => ({
          id: account.id,
          email_address: account.emailAddress,
          has_imap_password: account.hasImapPassword
        }));
        setEmailAccounts(mappedAccounts);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load email accounts'
      });
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  useEffect(() => {
    fetchKeys();
    fetchEmailAccounts();
  }, [user]);

  const handleSetImapPassword = async () => {
    if (!selectedAccountId) return;
    
    if (!imapPassword || imapPassword.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Password must be at least 8 characters'
      });
      return;
    }

    if (imapPassword !== confirmImapPassword) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Passwords do not match'
      });
      return;
    }

    setIsSettingPassword(true);
    try {
      const res = await fetch('/api/accounts/imap-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          accountId: selectedAccountId,
          password: imapPassword 
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: 'Success',
          description: 'IMAP/POP3 password set successfully'
        });
        setSelectedAccountId(null);
        setImapPassword('');
        setConfirmImapPassword('');
        fetchEmailAccounts();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: data.error || 'Failed to set password'
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to set password'
      });
    } finally {
      setIsSettingPassword(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [user]);

  const handleCreateKey = async () => {
    if (!keyName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a key name'
      });
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/auth/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name: keyName })
      });
      const data = await res.json();
      if (res.ok) {
        setNewKey(data.key);
        setShowNewKey(true);
        setKeyName('');
        fetchKeys();
        toast({
          title: 'Success',
          description: 'API key created successfully'
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: data.error || 'Failed to create API key'
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create API key'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/auth/api-keys?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        fetchKeys();
        toast({
          title: 'Success',
          description: 'API key deleted successfully'
        });
      } else {
        const data = await res.json();
        toast({
          variant: 'destructive',
          title: 'Error',
          description: data.error || 'Failed to delete API key'
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete API key'
      });
    } finally {
      setIsDeleting(false);
      setDeleteKeyId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'API key copied to clipboard'
    });
  };

  const closeNewKeyDialog = () => {
    setNewKey(null);
    setShowNewKey(false);
    setIsCreateDialogOpen(false);
  };

  if (!user) {
    return (
      <div className="py-8 text-center">You must be signed in to access developer settings.</div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Developer</h1>
          <p className="text-sm text-muted-foreground">
            API keys and IMAP/POP3 configuration for your email accounts
          </p>
        </div>
      </div>

      {/* Tabs for API and IMAP/POP3 */}
      <Tabs defaultValue="api" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="imap" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            IMAP/POP3
          </TabsTrigger>
        </TabsList>

        {/* API Keys Tab */}
        <TabsContent value="api" className="space-y-6 mt-6">
          <Button onClick={() => setIsCreateDialogOpen(true)} className="ml-auto flex">
            <Plus className="h-4 w-4 mr-2" />
            Create API Key
          </Button>

      {/* API Documentation Card */}
      <Card>
        <CardHeader>
          <CardTitle>API Documentation</CardTitle>
          <CardDescription>Use API keys to send emails programmatically</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Endpoint</h3>
            <code className="block bg-muted p-3 rounded text-sm">
              POST /api/emails/send-api
            </code>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Headers</h3>
            <code className="block bg-muted p-3 rounded text-sm">
              X-Api-Key: nm_live_...{'\n'}
              Content-Type: application/json
            </code>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Request Body</h3>
            <code className="block bg-muted p-3 rounded text-sm whitespace-pre">
{`{
  "from": "support@yourdomain.com",
  "to": "user@example.com",
  "subject": "Test Email",
  "text": "Plain text content",
  "html": "<p>HTML content</p>"
}`}
            </code>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Example (curl)</h3>
            <code className="block bg-muted p-3 rounded text-sm whitespace-pre-wrap break-all">
{`curl -X POST ${apiHost}/api/emails/send-api \\
  -H "X-Api-Key: nm_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"from":"support@yourdomain.com","to":"user@example.com","subject":"Test","text":"Hello"}'`}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* API Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>
            {keys.length} {keys.length === 1 ? 'key' : 'keys'} created
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8">
              <LoadingSpinner size="md" text="Loading API keys..." />
            </div>
          ) : keys.length === 0 ? (
            <EmptyState
              icon={<Key className="h-12 w-12" />}
              title="No API keys yet"
              description="Create your first API key to start sending emails programmatically"
              action={{
                label: 'Create API Key',
                onClick: () => setIsCreateDialogOpen(true)
              }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.lastUsed ? new Date(key.lastUsed).toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteKeyId(key.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {/* IMAP/POP3 Tab */}
        <TabsContent value="imap" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>IMAP/POP3 Configuration</CardTitle>
              <CardDescription>
                Connect your email accounts to mail clients like Gmail, Outlook, or Thunderbird
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Server Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">IMAP Server</Label>
                    <code className="block bg-muted p-3 rounded text-sm">imap.{apiHost.replace(/^https?:\/\/(mails\.)?/, '')}</code>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">IMAP Ports</Label>
                    <code className="block bg-muted p-3 rounded text-sm">993 (SSL/TLS)</code>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">POP3 Server</Label>
                    <code className="block bg-muted p-3 rounded text-sm">pop3.{apiHost.replace(/^https?:\/\/(mails\.)?/, '')}</code>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">POP3 Ports</Label>
                    <code className="block bg-muted p-3 rounded text-sm">995 (SSL/TLS)</code>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">SMTP Server</Label>
                    <code className="block bg-muted p-3 rounded text-sm">smtp.{apiHost.replace(/^https?:\/\/(mails\.)?/, '')}</code>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">SMTP Ports</Label>
                    <code className="block bg-muted p-3 rounded text-sm">587 (STARTTLS)</code>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Email Accounts</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Set up IMAP/POP3 passwords for your email accounts
                </p>
                {isLoadingAccounts ? (
                  <div className="py-8">
                    <LoadingSpinner size="md" text="Loading accounts..." />
                  </div>
                ) : emailAccounts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No email accounts found. Create an email account first in the Accounts page.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email Address</TableHead>
                        <TableHead>IMAP/POP3 Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailAccounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell className="font-medium">{account.email_address}</TableCell>
                          <TableCell>
                            {account.has_imap_password ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Configured
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Not Configured</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedAccountId(account.id)}
                            >
                              {account.has_imap_password ? 'Change Password' : 'Set Password'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-3">Authentication</h3>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Use your <strong>email account address</strong> as the username and the password set for that specific email account (not your portal login password).
                  </p>
                  <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 mt-3">
                    <p className="text-sm text-foreground/80">
                      <strong>Note:</strong> Each email account you create can have its own IMAP/POP3 password. Set the password for your email account above, then use those credentials in your mail client.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Setup Example (Gmail App)</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Open Gmail app → Profile → Add another account → Other</li>
                  <li>Enter your email address (e.g., support@yourdomain.com)</li>
                  <li>Select IMAP</li>
                  <li>Enter incoming server: <strong>imap.{apiHost.replace(/^https?:\/\/(mails\.)?/, '')}</strong>, Port: <strong>993</strong>, Security: <strong>SSL/TLS</strong></li>
                  <li>Enter outgoing server: <strong>smtp.{apiHost.replace(/^https?:\/\/(mails\.)?/, '')}</strong>, Port: <strong>587</strong>, Security: <strong>STARTTLS</strong></li>
                  <li>Enter your email account password for both incoming and outgoing</li>
                  <li>Complete setup</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Supported Features</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Real-time email synchronization
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Multiple device access with IMAP
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Automatic email account authentication
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Compatible with all major email clients
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create API Key Dialog */}
      <Dialog open={isCreateDialogOpen && !newKey} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Give your API key a descriptive name to help identify it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="keyName">Key Name</Label>
              <Input
                id="keyName"
                placeholder="e.g., Production Server, Marketing Automation"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreating) {
                    handleCreateKey();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateKey} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Key Created Dialog */}
      <Dialog open={!!newKey} onOpenChange={(open) => !open && closeNewKeyDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              API Key Created
            </DialogTitle>
            <DialogDescription>
              Copy your API key now. For security reasons, you won't be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Your API Key</Label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    readOnly
                    value={newKey || ''}
                    type={showNewKey ? 'text' : 'password'}
                    className="font-mono text-sm pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowNewKey(!showNewKey)}
                  >
                    {showNewKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => newKey && copyToClipboard(newKey)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
              <p className="text-sm text-foreground/80">
                <strong>Important:</strong> Store this key securely. You won't be able to view it again.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={closeNewKeyDialog}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteKeyId} onOpenChange={(open) => !open && setDeleteKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this API key? Any applications using this key will no longer be able to send emails. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteKeyId && handleDeleteKey(deleteKeyId)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Set IMAP Password Dialog */}
      <Dialog 
        open={!!selectedAccountId} 
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAccountId(null);
            setImapPassword('');
            setConfirmImapPassword('');
            setShowImapPassword(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set IMAP/POP3 Password</DialogTitle>
            <DialogDescription>
              Set a password for IMAP/POP3 access to{' '}
              <strong>{emailAccounts.find(a => a.id === selectedAccountId)?.email_address}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="imap-password">Password</Label>
              <div className="relative">
                <Input
                  id="imap-password"
                  type={showImapPassword ? 'text' : 'password'}
                  value={imapPassword}
                  onChange={(e) => setImapPassword(e.target.value)}
                  placeholder="Enter IMAP/POP3 password"
                  className="pr-10"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowImapPassword(!showImapPassword)}
                >
                  {showImapPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmImapPassword}
                onChange={(e) => setConfirmImapPassword(e.target.value)}
                placeholder="Confirm password"
              />
            </div>
            <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
              <p className="text-sm text-foreground/80">
                This password will be used to authenticate IMAP/POP3 access in your mail client (like Gmail app, Outlook, Thunderbird, etc.). It's separate from your portal login password.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedAccountId(null);
                setImapPassword('');
                setConfirmImapPassword('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSetImapPassword} disabled={isSettingPassword}>
              {isSettingPassword ? 'Setting...' : 'Set Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
