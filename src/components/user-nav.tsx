"use client";
import styles from './user-nav.module.css';

import { useRouter } from 'next/navigation';
import {
  AlertCircle,
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

  const handleLogout = async () => {
    await setToken(null);
    router.push('/');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={styles.nu_relative}>
          <Avatar className={styles.nu_h8}>
            <AvatarFallback className={styles.nu_bgPrimary10}>
              {getInitial()}
            </AvatarFallback>
          </Avatar>
          {user && !user.emailVerified && (
            <span
              className={styles.nu_absolute}
              aria-label="Email verification pending"
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={`${styles.nu_w60} animate-scale-in`} align="end" forceMount>
        <DropdownMenuLabel className={styles.nu_fontNormal}>
          <div className={styles.nu_flex}>
            <Avatar className={styles.nu_h12}>
              <AvatarFallback className={styles.nu_bgPrimary102}>
                {getInitial()}
              </AvatarFallback>
            </Avatar>
            <div className={styles.nu_flex2}>
              <p className={styles.nu_textSm}>{user?.fullName ?? 'User'}</p>
              <p className={styles.nu_textXs}>
                {user?.email ?? 'Not signed in'}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
            <User className={styles.nu_mr2} />
            <span>Profile</span>
            {user && !user.emailVerified && <AlertCircle className={styles.nu_mlAuto} />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/dashboard/billing')}>
            <CreditCard className={styles.nu_mr2} />
            <span>Billing</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
            <Settings className={styles.nu_mr2} />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/dashboard/teams')}>
            <Mail className={styles.nu_mr2} />
            <span>New Team</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void handleLogout();
          }}
          className={styles.nu_cursorPointer}
        >
          <LogOut className={styles.nu_mr2} />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
