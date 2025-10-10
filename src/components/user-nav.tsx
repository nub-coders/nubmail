"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  LogOut,
  Mail,
  Settings,
  User,
} from 'lucide-react';
import Image from 'next/image';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useAuthClient } from '@/lib/auth-provider';

export function UserNav() {
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar');
  const { user, setToken } = useAuthClient();
  const router = useRouter();

  const handleLogout = () => {
    setToken(null);
    router.push('/');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-muted/50 transition-colors">
          <Avatar className="h-9 w-9 ring-2 ring-border/20 hover:ring-primary/30 transition-all">
            {userAvatar && (
               <Image
                  src={userAvatar.imageUrl}
                  alt={userAvatar.description}
                  width={40}
                  height={40}
                  data-ai-hint={userAvatar.imageHint}
                />
            )}
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {user?.email ? user.email.slice(0,2).toUpperCase() : 'NU'}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 animate-scale-in" align="end" forceMount>
        <DropdownMenuLabel className="font-normal p-4 bg-muted/30">
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12">
              {userAvatar && (
                <Image
                  src={userAvatar.imageUrl}
                  alt={userAvatar.description}
                  width={48}
                  height={48}
                  data-ai-hint={userAvatar.imageHint}
                />
              )}
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                {user?.email ? user.email.slice(0,2).toUpperCase() : 'NU'}
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
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Billing</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
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
