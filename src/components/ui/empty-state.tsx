import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
        <div className="mb-6 rounded-2xl bg-muted/50 p-6 text-muted-foreground/30">
          {icon}
        </div>
      )}
      
      <div className="space-y-3 max-w-md">
        <h3 className="text-lg font-medium text-foreground">
          {title}
        </h3>
        
        {description && (
          <p className="text-sm text-muted-foreground/80 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      
      {action && (
        <div className="mt-6">
          <Button onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  )
}