'use client';

import { MoreHorizontal, PlusCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { collection, query, where } from 'firebase/firestore';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useCollection, useFirebase, useMemoFirebase, useUser } from '@/firebase';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { Domain } from '@/lib/types';

function CreateAccountSheet({ domain }: { domain: Domain }) {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const [username, setUsername] = useState('');

  const handleCreateAccount = () => {
    if (user && domain.id && username) {
      const email = `${username}@${domain.domainName}`;
      const accountsRef = collection(
        firestore,
        `/users/${user.uid}/domains/${domain.id}/emailAccounts`
      );
      addDocumentNonBlocking(accountsRef, {
        emailAddress: email,
        storageQuota: 5, // Default 5GB
        domainId: domain.id,
        // Assuming other fields like password hash would be handled securely
      });
      setUsername('');
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" className="ml-auto gap-1">
          <PlusCircle className="h-4 w-4" />
          Create Account
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Create New Email Account</SheetTitle>
          <SheetDescription>
            Create a new email address for the domain{' '}
            <strong>{domain.domainName}</strong>.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email-user" className="text-right">
              Username
            </Label>
            <div className="col-span-3 flex items-center gap-2">
              <Input
                id="email-user"
                placeholder="hello"
                className="w-full"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <span className="text-muted-foreground">@{domain.domainName}</span>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="password" className="text-right">
              Password
            </Label>
            <Input id="password" type="password" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quota" className="text-right">
              Quota (GB)
            </Label>
            <Input
              id="quota"
              type="number"
              defaultValue="5"
              className="col-span-3"
            />
          </div>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <SheetClose asChild>
            <Button type="submit" onClick={handleCreateAccount}>
              Create Account
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function AccountsList({ domain }: { domain: Domain }) {
  const { firestore } = useFirebase();
  const { user } = useUser();

  const accountsQuery = useMemoFirebase(() => {
    if (!user || !domain.id) return null;
    return collection(
      firestore,
      `/users/${user.uid}/domains/${domain.id}/emailAccounts`
    );
  }, [firestore, user, domain.id]);

  const { data: accounts, isLoading } = useCollection(accountsQuery);

  if (isLoading) {
    return <p>Loading accounts...</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email Address</TableHead>
          <TableHead>Quota Usage</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(accounts || []).map((account: any) => (
          <TableRow key={account.id}>
            <TableCell className="font-medium">{account.emailAddress}</TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <Progress
                  value={( (0) / (account.storageQuota || 5)) * 100}
                  className="h-2"
                />
                <span className="text-xs text-muted-foreground">
                  0 GB of {account.storageQuota || 5} GB
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={'secondary'} className={'bg-green-500/20 text-green-700 border-green-500/30'}>
                active
              </Badge>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button aria-haspopup="true" size="icon" variant="ghost">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Toggle menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                  <DropdownMenuItem>Change Password</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function AccountsPage() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('');

  const domainsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, `/users/${user.uid}/domains`),
      where('verificationStatus', '==', 'verified')
    );
  }, [firestore, user]);

  const { data: verifiedDomains, isLoading } = useCollection<Domain>(domainsQuery);

  const firstDomain = verifiedDomains?.[0];

  if (isLoading) {
    return <div>Loading domains...</div>;
  }

  if (!verifiedDomains || verifiedDomains.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold">Email Accounts</h1>
          <p className="text-muted-foreground">
            Manage email accounts for your verified domains.
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <p>You have no verified domains. Please add and verify a domain to create email accounts.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold">Email Accounts</h1>
        <p className="text-muted-foreground">
          Manage email accounts for your verified domains.
        </p>
      </div>
      <Tabs 
        defaultValue={firstDomain?.id} 
        value={activeTab || firstDomain?.id}
        onValueChange={setActiveTab}
      >
        <TabsList>
          {verifiedDomains.map((domain) => (
            <TabsTrigger key={domain.id} value={domain.id}>
              {domain.domainName}
            </TabsTrigger>
          ))}
        </TabsList>
        {verifiedDomains.map((domain) => (
          <TabsContent key={domain.id} value={domain.id}>
            <Card>
              <CardHeader className="flex flex-row items-center">
                <div className="grid gap-2">
                  <CardTitle>Accounts for {domain.domainName}</CardTitle>
                  <CardDescription>
                    List of all email accounts under this domain.
                  </CardDescription>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <CreateAccountSheet domain={domain} />
                </div>
              </CardHeader>
              <CardContent>
                <AccountsList domain={domain} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
