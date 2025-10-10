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
        <div className="mb-6 text-muted-foreground/40">
          {icon}
        </div>
      )}
      
      <div className="space-y-3 max-w-md">
        <h3 className="text-xl font-semibold text-foreground">
          {title}
        </h3>
        
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      
      {action && (
        <div className="mt-6">
          <Button onClick={action.onClick} className="shadow-sm">
            {action.label}
          </Button>
        </div>
      )}
    </div>
  )
}