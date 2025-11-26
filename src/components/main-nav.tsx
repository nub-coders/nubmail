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
  Key,
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
          <h4 className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
            Management
          </h4>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard')}
              tooltip="Dashboard"
              className="group hover:bg-sidebar-accent/80 transition-colors"
            >
              <Link href="/dashboard">
                <LayoutDashboard className="group-hover:scale-110 transition-transform" />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/domains')}
              tooltip="Domains"
              className="group hover:bg-sidebar-accent/80 transition-colors"
            >
              <Link href="/dashboard/domains">
                <Globe className="group-hover:scale-110 transition-transform" />
                <span>Domains</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/accounts')}
              tooltip="Accounts"
              className="group hover:bg-sidebar-accent/80 transition-colors"
            >
              <Link href="/dashboard/accounts">
                <Users className="group-hover:scale-110 transition-transform" />
                <span>Accounts</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/developer')}
              tooltip="Developer"
              className="group hover:bg-sidebar-accent/80 transition-colors"
            >
              <Link href="/dashboard/developer">
                <Key className="group-hover:scale-110 transition-transform" />
                <span>Developer</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>
      
      {/* Mail Section */}
      <div>
        <div className="px-3 mb-3">
          <h4 className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
            Mail
          </h4>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/inbox')}
              tooltip="Inbox"
              className="group hover:bg-sidebar-accent/80 transition-colors"
            >
              <Link href="/dashboard/inbox">
                <Inbox className="group-hover:scale-110 transition-transform" />
                <span>Inbox</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/sent')}
              tooltip="Sent"
              className="group hover:bg-sidebar-accent/80 transition-colors"
            >
              <Link href="/dashboard/sent">
                <Send className="group-hover:scale-110 transition-transform" />
              <span>Sent</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={isActive('/dashboard/drafts')}
            tooltip="Drafts"
            className="group hover:bg-sidebar-accent/80 transition-colors"
          >
            <Link href="/dashboard/drafts">
              <FileText className="group-hover:scale-110 transition-transform" />
              <span>Drafts</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={isActive('/dashboard/spam')}
            tooltip="Spam"
            className="group hover:bg-sidebar-accent/80 transition-colors"
          >
            <Link href="/dashboard/spam">
              <Shield className="group-hover:scale-110 transition-transform" />
              <span>Spam</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
         <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={isActive('/dashboard/trash')}
            tooltip="Trash"
            className="group hover:bg-sidebar-accent/80 transition-colors"
          >
            <Link href="/dashboard/trash">
              <Trash2 className="group-hover:scale-110 transition-transform" />
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
            <h4 className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
              Administration
            </h4>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive('/dashboard/admin')}
                tooltip="Admin Dashboard"
                className="group hover:bg-sidebar-accent/80 transition-colors"
              >
                <Link href="/dashboard/admin">
                  <ShieldCheck className="group-hover:scale-110 transition-transform" />
                  <span>Admin</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive('/dashboard/admin/users')}
                tooltip="Manage Users"
                className="group hover:bg-sidebar-accent/80 transition-colors"
              >
                <Link href="/dashboard/admin/users">
                  <UserCog className="group-hover:scale-110 transition-transform" />
                  <span>Manage Users</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive('/dashboard/admin/domains')}
                tooltip="Manage Domains"
                className="group hover:bg-sidebar-accent/80 transition-colors"
              >
                <Link href="/dashboard/admin/domains">
                  <Globe className="group-hover:scale-110 transition-transform" />
                  <span>Manage Domains</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive('/dashboard/admin/server-dns')}
                tooltip="Server DNS"
                className="group hover:bg-sidebar-accent/80 transition-colors"
              >
                <Link href="/dashboard/admin/server-dns">
                  <Server className="group-hover:scale-110 transition-transform" />
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
