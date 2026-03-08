'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LoginFormProps {
  onSubmit: (email: string) => void
  isLoading: boolean
  error: string | null
}

export function LoginForm({ onSubmit, isLoading, error }: LoginFormProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    onSubmit(email)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-foreground text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="your@email.com"
          disabled={isLoading}
          aria-describedby={error ? 'email-error' : undefined}
          aria-invalid={!!error}
          className={cn(
            'border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring/50 focus:border-ring min-h-[44px] rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none disabled:opacity-50',
            error &&
              'border-destructive focus:ring-destructive/20 focus:border-destructive'
          )}
        />
        {error && (
          <p id="email-error" role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Отправляем...' : 'Получить код'}
      </Button>

      <p className="text-muted-foreground text-center text-xs">
        Мы отправим ссылку на ваш email
      </p>
    </form>
  )
}
