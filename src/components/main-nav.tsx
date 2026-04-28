'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  Globe,
  Inbox,
  LayoutDashboard,
  Send,
  Shield,
  Trash2,
  Users,
  ShieldCheck,
  Server,
  Key,
  Archive,
} from 'lucide-react';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { useAuthClient } from '@/lib/auth-provider';

export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user } = useAuthClient();
  const isAdmin = !!user?.isAdmin;

  const isActive = (path: string) => pathname === path;

  return (
    <nav className={cn('flex flex-col space-y-6', className)}>
      {/* Management Section */}
      <div>
        <div className="px-3 mb-3">
          <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
            Management
          </h4>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard')}
              tooltip="Dashboard"
              className="hover:bg-sidebar-accent transition-colors duration-150"
            >
              <Link href="/dashboard">
                <LayoutDashboard />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/domains')}
              tooltip="Domains"
              className="hover:bg-sidebar-accent transition-colors duration-150"
            >
              <Link href="/dashboard/domains">
                <Globe />
                <span>Domains</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/accounts')}
              tooltip="Accounts"
              className="hover:bg-sidebar-accent transition-colors duration-150"
            >
              <Link href="/dashboard/accounts">
                <Users />
                <span>Accounts</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/developer')}
              tooltip="Developer"
              className="hover:bg-sidebar-accent transition-colors duration-150"
            >
              <Link href="/dashboard/developer">
                <Key />
                <span>Developer</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
      
      {/* Mail Section */}
      <div>
        <div className="px-3 mb-3">
          <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
            Mail
          </h4>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/inbox')}
              tooltip="Inbox"
              className="hover:bg-sidebar-accent transition-colors duration-150"
            >
              <Link href="/dashboard/inbox">
                <Inbox />
                <span>Inbox</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/sent')}
              tooltip="Sent"
              className="hover:bg-sidebar-accent transition-colors duration-150"
            >
              <Link href="/dashboard/sent">
                <Send />
              <span>Sent</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={isActive('/dashboard/drafts')}
            tooltip="Drafts"
            className="hover:bg-sidebar-accent transition-colors duration-150"
          >
            <Link href="/dashboard/drafts">
              <FileText />
              <span>Drafts</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={isActive('/dashboard/archive')}
            tooltip="Archive"
            className="hover:bg-sidebar-accent transition-colors duration-150"
          >
            <Link href="/dashboard/archive">
              <Archive />
              <span>Archive</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={isActive('/dashboard/spam')}
            tooltip="Spam"
            className="hover:bg-sidebar-accent transition-colors duration-150"
          >
            <Link href="/dashboard/spam">
              <Shield />
              <span>Spam</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
         <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={isActive('/dashboard/trash')}
            tooltip="Trash"
            className="hover:bg-sidebar-accent transition-colors duration-150"
          >
            <Link href="/dashboard/trash">
              <Trash2 />
              <span>Trash</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        </SidebarMenu>
      </div>
      
      {/* Admin Section */}
      {isAdmin && (
        <div>
          <div className="px-3 mb-3">
            <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
              Administration
            </h4>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive('/dashboard/admin')}
                tooltip="Admin Dashboard"
                className="hover:bg-sidebar-accent transition-colors duration-150"
              >
                <Link href="/dashboard/admin">
                  <ShieldCheck />
                  <span>Admin</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive('/dashboard/admin/domains')}
                tooltip="Domains"
                className="hover:bg-sidebar-accent transition-colors duration-150"
              >
                <Link href="/dashboard/admin/domains">
                  <Globe />
                  <span>Domains</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive('/dashboard/admin/server-dns')}
                tooltip="Server DNS"
                className="hover:bg-sidebar-accent transition-colors duration-150"
              >
                <Link href="/dashboard/admin/server-dns">
                  <Server />
                  <span>Server DNS</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      )}
    </nav>
  );
}
