import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import styles from './empty-state.module.css';

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center py-12 px-4",
      className
    )}>
      {icon && (
        <div className={styles.nu_mb6}>
          {icon}
        </div>
      )}
      
      <div className={styles.nu_spaceY3}>
        <h3 className={styles.nu_textLg}>
          {title}
        </h3>
        
        {description && (
          <p className={styles.nu_textSm}>
            {description}
          </p>
        )}
      </div>
      
      {action && (
        <div className={styles.nu_mt6}>
          <Button onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  )
}