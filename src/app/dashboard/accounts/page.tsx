import { MoreHorizontal, PlusCircle } from 'lucide-react';

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
  SheetClose
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DOMAINS_DATA, ACCOUNTS_DATA } from '@/lib/placeholder-data';
import { Separator } from '@/components/ui/separator';

function CreateAccountSheet({ domain }: { domain: string }) {
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
                        Create a new email address for the domain <strong>{domain}</strong>.
                    </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email-user" className="text-right">
                            Username
                        </Label>
                        <div className="col-span-3 flex items-center gap-2">
                             <Input id="email-user" placeholder="hello" className="w-full" />
                             <span className="text-muted-foreground">@{domain}</span>
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
                        <Input id="quota" type="number" defaultValue="5" className="col-span-3" />
                    </div>
                </div>
                <SheetFooter>
                    <SheetClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </SheetClose>
                    <SheetClose asChild>
                        <Button type="submit">Create Account</Button>
                    </SheetClose>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}

export default function AccountsPage() {
  const verifiedDomains = DOMAINS_DATA.filter(d => d.status === 'verified');

  return (
    <div className="flex flex-col gap-8">
       <div>
            <h1 className="text-3xl font-bold">Email Accounts</h1>
            <p className="text-muted-foreground">Manage email accounts for your verified domains.</p>
        </div>
      <Tabs defaultValue={verifiedDomains[0]?.domain || ''}>
        <TabsList>
          {verifiedDomains.map((domain) => (
            <TabsTrigger key={domain.domain} value={domain.domain}>
              {domain.domain}
            </TabsTrigger>
          ))}
        </TabsList>
        {verifiedDomains.map((domain) => (
          <TabsContent key={domain.domain} value={domain.domain}>
            <Card>
              <CardHeader className="flex flex-row items-center">
                 <div className="grid gap-2">
                    <CardTitle>Accounts for {domain.domain}</CardTitle>
                    <CardDescription>
                        List of all email accounts under this domain.
                    </CardDescription>
                 </div>
                <div className="ml-auto flex items-center gap-2">
                    <CreateAccountSheet domain={domain.domain} />
                </div>
              </CardHeader>
              <CardContent>
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
                    {(ACCOUNTS_DATA[domain.domain] || []).map((account) => (
                      <TableRow key={account.email}>
                        <TableCell className="font-medium">
                          {account.email}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Progress
                              value={
                                (account.quota.used / account.quota.total) * 100
                              }
                              className="h-2"
                            />
                            <span className="text-xs text-muted-foreground">
                              {account.quota.used}{account.quota.unit} of {account.quota.total}{account.quota.unit}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                           <Badge variant={account.status === 'active' ? 'secondary' : 'outline'} className={account.status === 'active' ? 'bg-green-500/20 text-green-700 border-green-500/30' : ''}>
                                {account.status}
                            </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                aria-haspopup="true"
                                size="icon"
                                variant="ghost"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Toggle menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem>Edit</DropdownMenuItem>
                              <DropdownMenuItem>Change Password</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
