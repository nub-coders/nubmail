"use client";

import { useRouter } from 'next/navigation';
import {
  CreditCard,
  LogOut,
  Mail,
  Settings,
  User,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthClient } from '@/lib/auth-provider';

export function UserNav() {
  const { user, setToken } = useAuthClient();
  const router = useRouter();

  const getInitial = () => {
    if (user?.fullName) return user.fullName.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return 'N';
  };

  const handleLogout = () => {
    setToken(null);
    router.push('/');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:bg-muted/50 transition-colors">
          <Avatar className="h-8 w-8 ring-1 ring-border/30 hover:ring-border/60 transition-all duration-150">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {getInitial()}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60 animate-scale-in shadow-elevated" align="end" forceMount>
        <DropdownMenuLabel className="font-normal p-3 bg-muted/20">
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                {getInitial()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-semibold leading-none">{user?.fullName ?? 'User'}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user?.email ?? 'Not signed in'}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/dashboard/billing')}>
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Billing</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/dashboard/teams')}>
            <Mail className="mr-2 h-4 w-4" />
            <span>New Team</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <button onClick={handleLogout} className="w-full text-left">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
