'use client';
import styles from './bulk-action-bar.module.css';

import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface BulkAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'secondary' | 'link';
}

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  isAllSelected: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  actions: BulkAction[];
  loading?: boolean;
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  isAllSelected,
  onSelectAll,
  onClearSelection,
  actions,
  loading,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className={styles.nu_flex}>
      <div className={styles.nu_flex2}>
        <span className={styles.nu_textSm}>
          {selectedCount} selected
        </span>
        <span className={styles.nu_textMutedForeground}>|</span>
        {!isAllSelected ? (
          <button onClick={onSelectAll} className={styles.nu_textSm2} disabled={loading}>
            Select all {totalCount}
          </button>
        ) : (
          <button onClick={onClearSelection} className={styles.nu_textSm2} disabled={loading}>
            Deselect all
          </button>
        )}
      </div>
      <div className={styles.nu_flex3}>
        {actions.map((action) => (
          <Button
            key={action.label}
            size="sm"
            variant={action.variant || 'outline'}
            onClick={action.onClick}
            disabled={loading}
            className={cn(action.variant === 'destructive' && 'hover:bg-destructive/90')}
          >
            {action.icon}
            <span className={styles.nu_ml15}>{action.label}</span>
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={onClearSelection} disabled={loading}>
          <X className={styles.nu_h4} />
        </Button>
      </div>
    </div>
  );
}
