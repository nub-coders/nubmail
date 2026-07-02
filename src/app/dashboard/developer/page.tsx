'use client';
import styles from './page.module.css';

import { useEffect, useState } from 'react';
import { Key, Plus, Trash2, Copy, Eye, EyeOff, CheckCircle, Mail, Globe, Send, BookOpen, UserPlus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Checkbox } from '@/components/ui/checkbox';
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
  permissions: string[];
  domainIds: string[];
  accountIds: string[];
  createdAt: string;
  lastUsed: string | null;
}

interface EmailAccount {
  id: string;
  email_address: string;
  has_imap_password: boolean;
  domainId?: string;
}

interface Domain {
  id: string;
  domainName: string;
  verificationStatus: string;
}

const PERMISSION_LABELS: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  send: { label: 'Send Emails', description: 'Send emails via API', icon: <Send className="h-4 w-4" /> },
  read: { label: 'Read Emails', description: 'Read inbox and sent emails via API', icon: <BookOpen className="h-4 w-4" /> },
  create_accounts: { label: 'Create Accounts', description: 'Create new email accounts via API', icon: <UserPlus className="h-4 w-4" /> },
};

export default function DeveloperPage() {
  const { user } = useAuthClient();
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingDomains, setIsLoadingDomains] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['send']);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [showRevealedKey, setShowRevealedKey] = useState(false);
  const [revealingKeyId, setRevealingKeyId] = useState<string | null>(null);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // IMAP/POP3 password setup
  const [selectedImapAccountId, setSelectedImapAccountId] = useState<string | null>(null);
  const [imapPassword, setImapPassword] = useState('');
  const [confirmImapPassword, setConfirmImapPassword] = useState('');
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [showImapPassword, setShowImapPassword] = useState(false);

  const apiHost = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : 'https://mails.nubcoder.com';

  const baseDomain = (() => {
    try {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'nubcoder.com';
      return hostname.replace(/^(mails?|webmail)\./, '');
    } catch {
      return 'nubcoder.com';
    }
  })();

  const fetchKeys = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/api-keys', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setKeys(data.keys || []);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load API keys' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmailAccounts = async () => {
    if (!user) return;
    setIsLoadingAccounts(true);
    try {
      const res = await fetch('/api/accounts', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        const mappedAccounts = data.accounts.map((account: any) => ({
          id: account.id,
          email_address: account.emailAddress,
          has_imap_password: account.hasImapPassword,
          domainId: account.domainId,
        }));
        setEmailAccounts(mappedAccounts);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load email accounts' });
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const fetchDomains = async () => {
    if (!user) return;
    setIsLoadingDomains(true);
    try {
      const res = await fetch('/api/domains', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setDomains((data.domains || []).filter((d: Domain) => d.verificationStatus === 'verified'));
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load domains' });
    } finally {
      setIsLoadingDomains(false);
    }
  };

  useEffect(() => {
    fetchKeys();
    fetchEmailAccounts();
    fetchDomains();
  }, [user]);

  const handleSetImapPassword = async () => {
    if (!selectedImapAccountId) return;

    if (!imapPassword || imapPassword.length < 12) {
      toast({ variant: 'destructive', title: 'Error', description: 'Password must be at least 12 characters' });
      return;
    }

    if (imapPassword !== confirmImapPassword) {
      toast({ variant: 'destructive', title: 'Error', description: 'Passwords do not match' });
      return;
    }

    setIsSettingPassword(true);
    try {
      const res = await fetch('/api/accounts/imap-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedImapAccountId, password: imapPassword })
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Success', description: 'IMAP/POP3 password set successfully' });
        setSelectedImapAccountId(null);
        setImapPassword('');
        setConfirmImapPassword('');
        fetchEmailAccounts();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: data.error || 'Failed to set password' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to set password' });
    } finally {
      setIsSettingPassword(false);
    }
  };

  const togglePermission = (perm: string) => {
    setSelectedPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const toggleDomain = (domainId: string) => {
    setSelectedDomainIds(prev =>
      prev.includes(domainId) ? prev.filter(d => d !== domainId) : [...prev, domainId]
    );
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccountIds(prev =>
      prev.includes(accountId) ? prev.filter(a => a !== accountId) : [...prev, accountId]
    );
  };

  const filteredAccounts = selectedDomainIds.length > 0
    ? emailAccounts.filter(a => a.domainId && selectedDomainIds.includes(a.domainId))
    : emailAccounts;

  const handleCreateKey = async () => {
    if (!keyName.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please enter a key name' });
      return;
    }
    if (selectedPermissions.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Select at least one permission' });
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/auth/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: keyName,
          permissions: selectedPermissions,
          domainIds: selectedDomainIds,
          accountIds: selectedAccountIds,
        })
      });
      const data = await res.json();
      if (res.ok) {
        setNewKey(data.key);
        setShowNewKey(true);
        setKeyName('');
        setSelectedPermissions(['send']);
        setSelectedDomainIds([]);
        setSelectedAccountIds([]);
        fetchKeys();
        toast({ title: 'Success', description: 'API key created successfully' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: data.error || 'Failed to create API key' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create API key' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/auth/api-keys?id=${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        fetchKeys();
        toast({ title: 'Success', description: 'API key deleted successfully' });
      } else {
        const data = await res.json();
        toast({ variant: 'destructive', title: 'Error', description: data.error || 'Failed to delete API key' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete API key' });
    } finally {
      setIsDeleting(false);
      setDeleteKeyId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'API key copied to clipboard' });
  };

  const handleRevealKey = async (id: string) => {
    setRevealingKeyId(id);
    try {
      const res = await fetch(`/api/auth/api-keys?id=${id}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setRevealedKey(data.key);
        setShowRevealedKey(true);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: data.error || 'Failed to load API key' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load API key' });
    } finally {
      setRevealingKeyId(null);
    }
  };

  const closeNewKeyDialog = () => {
    setNewKey(null);
    setShowNewKey(false);
    setIsCreateDialogOpen(false);
  };

  const getDomainName = (domainId: string) => domains.find(d => d.id === domainId)?.domainName || domainId;
  const getAccountEmail = (accountId: string) => emailAccounts.find(a => a.id === accountId)?.email_address || accountId;

  if (!user) {
    return (
      <div className={styles.nu_py8}>You must be signed in to access developer settings.</div>
    );
  }

  return (
    <div className={styles.nu_flex}>
      {/* Header */}
      <div className={styles.nu_flex2}>
        <div className={styles.nu_spaceY1}>
          <h1 className={styles.nu_text2xl}>Developer</h1>
          <p className={styles.nu_textSm}>
            API keys and IMAP/POP3 configuration for your email accounts
          </p>
        </div>
      </div>

      {/* Tabs for API and IMAP/POP3 */}
      <Tabs defaultValue="api" className={styles.nu_wFull}>
        <TabsList className={styles.nu_grid}>
          <TabsTrigger value="api" className={styles.nu_flex3}>
            <Key className={styles.nu_h4} />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="imap" className={styles.nu_flex3}>
            <Mail className={styles.nu_h4} />
            IMAP/POP3
          </TabsTrigger>
        </TabsList>

        {/* API Keys Tab */}
        <TabsContent value="api" className={styles.nu_spaceY6}>
          <Button onClick={() => setIsCreateDialogOpen(true)} className={styles.nu_mlAuto}>
            <Plus className={styles.nu_h42} />
            Create API Key
          </Button>

      {/* API Documentation Card */}
      <Card>
        <CardHeader>
          <CardTitle>API Documentation</CardTitle>
          <CardDescription>Use API keys to send emails, read emails, and create accounts programmatically</CardDescription>
        </CardHeader>
        <CardContent className={styles.nu_spaceY4}>
          <div>
            <h3 className={styles.nu_fontSemibold}>Authentication</h3>
            <code className={styles.nu_block}>
              X-Api-Key: nm_live_...
            </code>
          </div>
          <div>
            <h3 className={styles.nu_fontSemibold}>Send Email</h3>
            <code className={styles.nu_block2}>
{`POST /api/emails/send-api
Requires: send permission

{
  "from": "support@yourdomain.com",
  "to": "user@example.com",
  "subject": "Test Email",
  "text": "Plain text content",
  "html": "<p>HTML content</p>"
}`}
            </code>
          </div>
          <div>
            <h3 className={styles.nu_fontSemibold}>Read Emails</h3>
            <code className={styles.nu_block2}>
{`GET /api/emails/read-api?folder=inbox&limit=50
Requires: read permission

Folders: inbox, sent, trash`}
            </code>
          </div>
          <div>
            <h3 className={styles.nu_fontSemibold}>Create Email Account</h3>
            <code className={styles.nu_block2}>
{`POST /api/accounts/create-api
Requires: create_accounts permission

{
  "emailAddress": "new@yourdomain.com",
  "domainId": "uuid-of-verified-domain"
}`}
            </code>
          </div>
          <div>
            <h3 className={styles.nu_fontSemibold}>Example (curl)</h3>
            <code className={styles.nu_block3}>
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
            <div className={styles.nu_py82}>
              <LoadingSpinner size="md" text="Loading API keys..." />
            </div>
          ) : keys.length === 0 ? (
            <EmptyState
              icon={<Key className={styles.nu_h12} />}
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
                  <TableHead>Permissions</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className={styles.nu_textRight}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className={styles.nu_fontMedium}>{key.name}</TableCell>
                    <TableCell>
                      <div className={styles.nu_badgeWrap}>
                        {(key.permissions || ['send']).map(p => (
                          <Badge key={p} variant="secondary" className={styles.nu_badgeSmall}>
                            {PERMISSION_LABELS[p]?.label || p}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={styles.nu_badgeWrap}>
                        {key.domainIds.length === 0 && key.accountIds.length === 0 ? (
                          <span className={styles.nu_textSm}>All</span>
                        ) : (
                          <>
                            {key.domainIds.map(id => (
                              <Badge key={id} variant="outline" className={styles.nu_badgeSmall}>
                                <Globe className="h-3 w-3 mr-1" />
                                {getDomainName(id)}
                              </Badge>
                            ))}
                            {key.accountIds.map(id => (
                              <Badge key={id} variant="outline" className={styles.nu_badgeSmall}>
                                <Mail className="h-3 w-3 mr-1" />
                                {getAccountEmail(id)}
                              </Badge>
                            ))}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={styles.nu_textSm}>
                      {new Date(key.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className={styles.nu_textSm}>
                      {key.lastUsed ? new Date(key.lastUsed).toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell className={styles.nu_textRight}>
                      <div className={styles.nu_flex4}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevealKey(key.id)}
                          disabled={revealingKeyId === key.id}
                        >
                          {revealingKeyId === key.id ? 'Loading...' : 'View'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteKeyId(key.id)}
                        >
                          <Trash2 className={styles.nu_h43} />
                        </Button>
                      </div>
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
        <TabsContent value="imap" className={styles.nu_spaceY6}>
          <Card>
            <CardHeader>
              <CardTitle>IMAP/POP3 Configuration</CardTitle>
              <CardDescription>
                Connect your email accounts to mail clients like Gmail, Outlook, or Thunderbird
              </CardDescription>
            </CardHeader>
            <CardContent className={styles.nu_spaceY62}>
              <div>
                <h3 className={styles.nu_fontSemibold2}>Server Settings</h3>
                <div className={styles.nu_grid2}>
                  <div className={styles.nu_spaceY2}>
                    <Label className={styles.nu_textSm2}>IMAP Server</Label>
                    <code className={styles.nu_block}>imap.{baseDomain}</code>
                  </div>
                  <div className={styles.nu_spaceY2}>
                    <Label className={styles.nu_textSm2}>IMAP Ports</Label>
                    <code className={styles.nu_block}>993 (SSL/TLS)</code>
                  </div>
                  <div className={styles.nu_spaceY2}>
                    <Label className={styles.nu_textSm2}>POP3 Server</Label>
                    <code className={styles.nu_block}>pop3.{baseDomain}</code>
                  </div>
                  <div className={styles.nu_spaceY2}>
                    <Label className={styles.nu_textSm2}>POP3 Ports</Label>
                    <code className={styles.nu_block}>995 (SSL/TLS)</code>
                  </div>
                  <div className={styles.nu_spaceY2}>
                    <Label className={styles.nu_textSm2}>SMTP Server</Label>
                    <code className={styles.nu_block}>smtp.{baseDomain}</code>
                  </div>
                  <div className={styles.nu_spaceY2}>
                    <Label className={styles.nu_textSm2}>SMTP Ports</Label>
                    <code className={styles.nu_block}>587 (STARTTLS)</code>
                  </div>
                </div>
              </div>

              <div>
                <h3 className={styles.nu_fontSemibold2}>Email Accounts</h3>
                <p className={styles.nu_textSm3}>
                  Set up IMAP/POP3 passwords for your email accounts
                </p>
                {isLoadingAccounts ? (
                  <div className={styles.nu_py82}>
                    <LoadingSpinner size="md" text="Loading accounts..." />
                  </div>
                ) : emailAccounts.length === 0 ? (
                  <div className={styles.nu_textCenter}>
                    <p>No email accounts found. Create an email account first in the Accounts page.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email Address</TableHead>
                        <TableHead>IMAP/POP3 Status</TableHead>
                        <TableHead className={styles.nu_textRight}>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailAccounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell className={styles.nu_fontMedium}>{account.email_address}</TableCell>
                          <TableCell>
                            {account.has_imap_password ? (
                              <Badge variant="default" className={styles.nu_bgGreen500}>
                                <CheckCircle className={styles.nu_h3} />
                                Configured
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Not Configured</Badge>
                            )}
                          </TableCell>
                          <TableCell className={styles.nu_textRight}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedImapAccountId(account.id)}
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
                <h3 className={styles.nu_fontSemibold2}>Authentication</h3>
                <div className={styles.nu_spaceY2}>
                  <p className={styles.nu_textSm}>
                    Use your <strong>email account address</strong> as the username and the password set for that specific email account (not your portal login password).
                  </p>
                  <div className={styles.nu_bgPrimary5}>
                    <p className={styles.nu_textSm4}>
                      <strong>Note:</strong> Each email account you create can have its own IMAP/POP3 password. Set the password for your email account above, then use those credentials in your mail client.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className={styles.nu_fontSemibold2}>Setup Example (Gmail App)</h3>
                <ol className={styles.nu_listDecimal}>
                  <li>Open Gmail app → Profile → Add another account → Other</li>
                  <li>Enter your email address (e.g., support@yourdomain.com)</li>
                  <li>Select IMAP</li>
                  <li>Enter incoming server: <strong>imap.{baseDomain}</strong>, Port: <strong>993</strong>, Security: <strong>SSL/TLS</strong></li>
                  <li>Enter outgoing server: <strong>smtp.{baseDomain}</strong>, Port: <strong>587</strong>, Security: <strong>STARTTLS</strong></li>
                  <li>Enter your email account password for both incoming and outgoing</li>
                  <li>Complete setup</li>
                </ol>
              </div>

              <div>
                <h3 className={styles.nu_fontSemibold2}>Supported Features</h3>
                <ul className={styles.nu_spaceY22}>
                  <li className={styles.nu_flex3}>
                    <CheckCircle className={styles.nu_h44} />
                    Real-time email synchronization
                  </li>
                  <li className={styles.nu_flex3}>
                    <CheckCircle className={styles.nu_h44} />
                    Multiple device access with IMAP
                  </li>
                  <li className={styles.nu_flex3}>
                    <CheckCircle className={styles.nu_h44} />
                    Automatic email account authentication
                  </li>
                  <li className={styles.nu_flex3}>
                    <CheckCircle className={styles.nu_h44} />
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
        <DialogContent className={styles.nu_dialogWide}>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Configure permissions and scope for your new API key.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.nu_createForm}>
            {/* Key Name */}
            <div className={styles.nu_spaceY2}>
              <Label htmlFor="keyName">Key Name</Label>
              <Input
                id="keyName"
                placeholder="e.g., Production Server, Marketing Automation"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
              />
            </div>

            {/* Permissions */}
            <div className={styles.nu_spaceY2}>
              <Label>Permissions</Label>
              <div className={styles.nu_permGrid}>
                {Object.entries(PERMISSION_LABELS).map(([key, { label, description, icon }]) => (
                  <label key={key} className={styles.nu_permItem}>
                    <Checkbox
                      checked={selectedPermissions.includes(key)}
                      onCheckedChange={() => togglePermission(key)}
                    />
                    <div className={styles.nu_permLabel}>
                      <div className={styles.nu_flex3}>
                        {icon}
                        <span className={styles.nu_fontMedium}>{label}</span>
                      </div>
                      <span className={styles.nu_permDesc}>{description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Domain Scope */}
            <div className={styles.nu_spaceY2}>
              <Label>Domain Scope <span className={styles.nu_permDesc}>(leave empty for all domains)</span></Label>
              {isLoadingDomains ? (
                <LoadingSpinner size="sm" text="Loading domains..." />
              ) : domains.length === 0 ? (
                <p className={styles.nu_permDesc}>No verified domains found.</p>
              ) : (
                <div className={styles.nu_scopeList}>
                  {domains.map((domain) => (
                    <label key={domain.id} className={styles.nu_scopeItem}>
                      <Checkbox
                        checked={selectedDomainIds.includes(domain.id)}
                        onCheckedChange={() => toggleDomain(domain.id)}
                      />
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span>{domain.domainName}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Account Scope */}
            <div className={styles.nu_spaceY2}>
              <Label>Email Account Scope <span className={styles.nu_permDesc}>(leave empty for all accounts)</span></Label>
              {isLoadingAccounts ? (
                <LoadingSpinner size="sm" text="Loading accounts..." />
              ) : filteredAccounts.length === 0 ? (
                <p className={styles.nu_permDesc}>
                  {selectedDomainIds.length > 0
                    ? 'No accounts found for the selected domains.'
                    : 'No email accounts found.'}
                </p>
              ) : (
                <div className={styles.nu_scopeList}>
                  {filteredAccounts.map((account) => (
                    <label key={account.id} className={styles.nu_scopeItem}>
                      <Checkbox
                        checked={selectedAccountIds.includes(account.id)}
                        onCheckedChange={() => toggleAccount(account.id)}
                      />
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{account.email_address}</span>
                    </label>
                  ))}
                </div>
              )}
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
            <DialogTitle className={styles.nu_flex3}>
              <CheckCircle className={styles.nu_h5} />
              API Key Created
            </DialogTitle>
            <DialogDescription>
              Copy your API key now. You can also re-open it later from the API keys list.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.nu_spaceY42}>
            <div className={styles.nu_spaceY2}>
              <Label>Your API Key</Label>
              <div className={styles.nu_flex5}>
                <div className={styles.nu_flex1}>
                  <Input
                    readOnly
                    value={newKey || ''}
                    type={showNewKey ? 'text' : 'password'}
                    className={styles.nu_fontMono}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className={styles.nu_absolute}
                    onClick={() => setShowNewKey(!showNewKey)}
                  >
                    {showNewKey ? (
                      <EyeOff className={styles.nu_h4} />
                    ) : (
                      <Eye className={styles.nu_h4} />
                    )}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => newKey && copyToClipboard(newKey)}
                >
                  <Copy className={styles.nu_h4} />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={closeNewKeyDialog}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal API Key Dialog */}
      <Dialog
        open={!!revealedKey}
        onOpenChange={(open) => {
          if (!open) {
            setRevealedKey(null);
            setShowRevealedKey(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={styles.nu_flex3}>
              <Key className={styles.nu_h52} />
              API Key
            </DialogTitle>
            <DialogDescription>
              You can view and copy this key again from the dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className={styles.nu_spaceY42}>
            <div className={styles.nu_spaceY2}>
              <Label>Your API Key</Label>
              <div className={styles.nu_flex5}>
                <div className={styles.nu_flex1}>
                  <Input
                    readOnly
                    value={revealedKey || ''}
                    type={showRevealedKey ? 'text' : 'password'}
                    className={styles.nu_fontMono}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className={styles.nu_absolute}
                    onClick={() => setShowRevealedKey(!showRevealedKey)}
                  >
                    {showRevealedKey ? (
                      <EyeOff className={styles.nu_h4} />
                    ) : (
                      <Eye className={styles.nu_h4} />
                    )}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => revealedKey && copyToClipboard(revealedKey)}
                >
                  <Copy className={styles.nu_h4} />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealedKey(null)}>Done</Button>
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
              className={styles.nu_bgDestructive}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Set IMAP Password Dialog */}
      <Dialog
        open={!!selectedImapAccountId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedImapAccountId(null);
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
              <strong>{emailAccounts.find(a => a.id === selectedImapAccountId)?.email_address}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className={styles.nu_spaceY42}>
            <div className={styles.nu_spaceY2}>
              <Label htmlFor="imap-password">Password</Label>
              <div className={styles.nu_relative}>
                <Input
                  id="imap-password"
                  type={showImapPassword ? 'text' : 'password'}
                  value={imapPassword}
                  onChange={(e) => setImapPassword(e.target.value)}
                  placeholder="Enter IMAP/POP3 password"
                  className={styles.nu_pr10}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.nu_absolute}
                  onClick={() => setShowImapPassword(!showImapPassword)}
                >
                  {showImapPassword ? (
                    <EyeOff className={styles.nu_h4} />
                  ) : (
                    <Eye className={styles.nu_h4} />
                  )}
                </Button>
              </div>
            </div>
            <div className={styles.nu_spaceY2}>
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmImapPassword}
                onChange={(e) => setConfirmImapPassword(e.target.value)}
                placeholder="Confirm password"
              />
            </div>
            <div className={styles.nu_bgPrimary52}>
              <p className={styles.nu_textSm4}>
                This password will be used to authenticate IMAP/POP3 access in your mail client (like Gmail app, Outlook, Thunderbird, etc.). It's separate from your portal login password.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedImapAccountId(null);
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
