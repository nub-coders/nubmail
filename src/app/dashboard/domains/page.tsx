import { MoreHorizontal, PlusCircle, Globe, Dna, Copy } from 'lucide-react';

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DOMAINS_DATA } from '@/lib/placeholder-data';
import { Separator } from '@/components/ui/separator';

function DnsVerificationDialog() {
    const dnsRecords = [
        { type: "TXT", name: "@", value: "nubmail-verification=a1b2c3d4-e5f6-7890-1234-567890abcdef" },
        { type: "MX", name: "@", value: "mx.nub-coder.tech", priority: 10 },
        { type: "TXT", name: "nubmail._domainkey", value: "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC..." },
    ];
    return (
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Domain Verification Setup</DialogTitle>
                <DialogDescription>
                    To verify your domain, add the following DNS records to your domain's DNS settings.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                {dnsRecords.map((record, index) => (
                    <div key={index} className="space-y-2">
                        <Label className="font-semibold flex items-center gap-2"><Dna className="h-4 w-4" /> {record.type} Record</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] items-center gap-2 text-sm">
                            <span className="text-muted-foreground">Type:</span> <span>{record.type}</span>
                            <span className="text-muted-foreground">Name:</span> <code>{record.name}</code>
                            <span className="text-muted-foreground">Value:</span> 
                            <div className="flex items-center gap-2">
                                <code className="truncate ...">{record.value}</code>
                                <Button variant="ghost" size="icon" className="h-7 w-7"><Copy className="h-4 w-4"/></Button>
                            </div>
                            {record.priority && <> <span className="text-muted-foreground">Priority:</span> <span>{record.priority}</span></>}
                        </div>
                        {index < dnsRecords.length-1 && <Separator className="mt-4"/>}
                    </div>
                ))}
            </div>
            <DialogFooter>
                 <DialogTrigger asChild>
                    <Button variant="outline">Close</Button>
                </DialogTrigger>
                <Button>Verify DNS</Button>
            </DialogFooter>
        </DialogContent>
    )
}

export default function DomainsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold">Domain Management</h1>
            <p className="text-muted-foreground">Add and manage your custom domains.</p>
        </div>
        <Dialog>
            <DialogTrigger asChild>
                 <Button size="sm" className="ml-auto gap-1">
                    <PlusCircle className="h-4 w-4" />
                    Add Domain
                </Button>
            </DialogTrigger>
            <DialogContent>
                 <DialogHeader>
                    <DialogTitle>Add New Domain</DialogTitle>
                    <DialogDescription>
                        Enter the domain name you want to add.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="domain-name" className="text-right">
                            Domain
                        </Label>
                        <Input id="domain-name" placeholder="example.com" className="col-span-3" />
                    </div>
                </div>
                 <DialogFooter>
                    <DialogTrigger asChild>
                         <Button variant="outline">Cancel</Button>
                    </DialogTrigger>
                    <Button>Add Domain</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Domains</CardTitle>
          <CardDescription>
            An overview of all your registered domains and their verification status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DOMAINS_DATA.map((item) => (
                <TableRow key={item.domain}>
                  <TableCell className="font-medium flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground"/>{item.domain}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.status === 'verified'
                          ? 'default'
                          : item.status === 'pending'
                          ? 'secondary'
                          : 'destructive'
                      }
                      className={item.status === 'verified' ? 'bg-green-500/20 text-green-700 border-green-500/30' : ''}
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.createdAt}</TableCell>
                  <TableCell>
                    <Dialog>
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
                            <DialogTrigger asChild>
                                <DropdownMenuItem>View DNS Setup</DropdownMenuItem>
                            </DialogTrigger>
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                        </DropdownMenu>
                         <DnsVerificationDialog/>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
