'use client'

import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-none border font-sans text-xs font-medium tracking-[0.2em] uppercase whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'border-primary bg-transparent text-foreground hover:bg-primary/10',
        outline:
          'border-border bg-transparent text-foreground hover:bg-muted',
        secondary:
          'border-secondary bg-secondary/10 text-secondary-foreground hover:bg-secondary/20',
        ghost:
          'border-transparent text-foreground hover:border-border hover:bg-muted',
        destructive:
          'border-destructive/50 text-destructive hover:bg-destructive/10',
        link: 'border-transparent text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-11 min-w-11 gap-1.5 px-8 py-3',
        xs: 'min-h-[44px] min-w-[44px] gap-1 px-4 py-2',
        sm: 'min-h-[44px] min-w-[44px] gap-1.5 px-6 py-2.5',
        lg: 'min-h-12 min-w-12 gap-2 px-10 py-3.5',
        icon: 'size-11',
        'icon-xs': 'size-[44px]',
        'icon-sm': 'size-[44px]',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
