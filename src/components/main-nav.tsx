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
  UserCog,
  Server,
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
    <nav className={cn('flex flex-col', className)}>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={isActive('/dashboard')}
            tooltip="Dashboard"
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
          >
            <Link href="/dashboard/accounts">
              <Users />
              <span>Accounts</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      
      <SidebarMenu className="mt-4">
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={isActive('/dashboard/inbox')}
            tooltip="Inbox"
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
            isActive={isActive('/dashboard/spam')}
            tooltip="Spam"
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
          >
            <Link href="/dashboard/trash">
              <Trash2 />
              <span>Trash</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      
      {isAdmin && (
        <SidebarMenu className="mt-4">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/admin')}
              tooltip="Admin Dashboard"
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
              isActive={isActive('/dashboard/admin/users')}
              tooltip="Manage Users"
            >
              <Link href="/dashboard/admin/users">
                <UserCog />
                <span>Manage Users</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/admin/domains')}
              tooltip="Manage Domains"
            >
              <Link href="/dashboard/admin/domains">
                <Globe />
                <span>Manage Domains</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      )}
    </nav>
  );
}
