'use client'

import { cn } from '@/lib/utils'

export interface EmailPreferencesCardProps {
  id?: string
  emailNotificationsEnabled: boolean
  onToggle: (enabled: boolean) => void
  isLoading?: boolean
  isDisabled?: boolean
}

export function EmailPreferencesCard({
  id = 'email-preferences',
  emailNotificationsEnabled,
  onToggle,
  isLoading = false,
  isDisabled = false,
}: EmailPreferencesCardProps) {
  const disabled = isDisabled || isLoading

  return (
    <div className="space-y-2 border border-border p-6">
      <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
        E-poštna obvestila
      </p>
      <p className="text-sm text-muted-foreground">
        Prejemajte obvestila o novih objavah na vaš e-poštni naslov
      </p>

      <div className="flex min-h-[44px] items-center justify-between gap-4 pt-1">
        <label
          htmlFor={id}
          className={cn(
            'text-sm font-medium text-foreground',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          Obvestila o novih objavah
        </label>

        <button
          id={id}
          role="switch"
          aria-checked={emailNotificationsEnabled}
          aria-label="Obvestila o novih objavah"
          aria-busy={isLoading}
          disabled={disabled}
          onClick={() => onToggle(!emailNotificationsEnabled)}
          className={cn(
            'relative inline-flex min-h-[24px] min-w-[44px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            emailNotificationsEnabled ? 'bg-primary' : 'bg-muted',
            disabled && 'cursor-not-allowed opacity-50'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
              emailNotificationsEnabled ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
      </div>

      {isLoading && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Shranjevanje...
        </p>
      )}
    </div>
  )
}
