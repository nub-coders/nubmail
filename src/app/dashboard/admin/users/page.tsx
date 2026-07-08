"use client";
import styles from './page.module.css';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminUsersPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/admin/domains');
  }, [router]);

  return (
    <div className={styles.nu_flex}>
      <p className={styles.nu_textSm}>Redirecting to domain management...</p>
    </div>
  );
}
