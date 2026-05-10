import { Edit } from 'lucide-react';
import Link from 'next/link';

import { MainNav } from '@/components/main-nav';
import { PushRegistration } from '@/components/push-registration';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { UserNav } from '@/components/user-nav';
import { Button } from '@/components/ui/button';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
} from '@/components/ui/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <PushRegistration />
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex h-16 items-center px-4 border-b border-sidebar-border">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">
                NubMail
              </span>
              <span className="text-[11px] text-sidebar-foreground/50">
                Professional Email
              </span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2">
           <div className="p-3">
            <Button asChild className="w-full gradient-primary hover:opacity-90 text-white shadow-sm rounded-lg">
              <Link href="/dashboard/compose">
                <Edit className="mr-2 h-4 w-4" />
                Compose
              </Link>
            </Button>
          </div>
          <MainNav />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 bg-background/80 backdrop-blur-xl border-b border-border/40">
          <SidebarTrigger className="md:hidden text-muted-foreground hover:text-foreground transition-colors" />
          <div className="ml-auto">
            <UserNav />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6 lg:p-8 animate-fade-in">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
