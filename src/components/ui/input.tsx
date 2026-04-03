import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex w-full rounded-lg border border-border bg-muted/50 px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:border-primary focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50 min-h-[44px]',
        className
      )}
      {...props}
    />
  )
}

export { Input }
