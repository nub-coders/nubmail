'use client';

import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface BulkAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'ghost';
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
    <div className="flex items-center justify-between gap-4 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>
        <span className="text-muted-foreground">|</span>
        {!isAllSelected ? (
          <button onClick={onSelectAll} className="text-sm text-primary hover:underline" disabled={loading}>
            Select all {totalCount}
          </button>
        ) : (
          <button onClick={onClearSelection} className="text-sm text-primary hover:underline" disabled={loading}>
            Deselect all
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
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
            <span className="ml-1.5">{action.label}</span>
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={onClearSelection} disabled={loading}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
