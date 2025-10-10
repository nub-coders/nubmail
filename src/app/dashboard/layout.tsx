import { Mail, Edit } from 'lucide-react';
import Link from 'next/link';

import { MainNav } from '@/components/main-nav';
import { UserNav } from '@/components/user-nav';
import { Button } from '@/components/ui/button';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex h-16 items-center gap-3 px-4 border-b border-sidebar-border/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Mail className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-sidebar-foreground">
                NubMail
              </span>
              <span className="text-xs text-sidebar-foreground/60">
                Professional Email
              </span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2">
           <div className="p-4">
            <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
              <Link href="/dashboard/compose">
                <Edit className="mr-2 h-4 w-4" />
                Compose Email
              </Link>
            </Button>
          </div>
          <MainNav />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/50 bg-background/95 backdrop-blur-md px-4 sm:px-6 shadow-sm">
          <SidebarTrigger className="md:hidden hover:bg-muted/50 transition-colors" />
          <div className="ml-auto flex items-center gap-4">
            <UserNav />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6 animate-fade-in">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
