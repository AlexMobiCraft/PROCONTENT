'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

function getInitials(displayName: string | null, email: string | null): string {
  if (displayName && displayName.trim()) {
    return displayName
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  const safeEmail = email || '?'
  return safeEmail[0].toUpperCase()
}

function getStatusBadge(status: string | null): { label: string; active: boolean } {
  if (status === 'active' || status === 'trialing') return { label: 'Aktivna naročnina', active: true }
  if (status === 'canceled') return { label: 'Preklicana', active: false }
  if (status === 'past_due') return { label: 'Zahteva plačilo', active: false }
  if (status === 'unpaid') return { label: 'Neplačana', active: false }
  if (status === 'paused') return { label: 'Začasno prekinjena', active: false }
  return { label: 'Ni naročnine', active: false }
}

const achievements = [
  {
    label: 'Prva objava',
    description: 'Objavi svojo prvo vsebino v skupnosti',
    earned: false,
  },
  {
    label: 'Zvesti član',
    description: 'Aktivna naročnina 30 ali več dni',
    earned: false,
  },
  {
    label: 'Odprto srce',
    description: 'Komentiraj 10 objav v skupnosti',
    earned: false,
  },
]

interface ProfileRightPanelProps {
  email: string
  displayName: string | null
  subscriptionStatus: string | null
  'avatar_url'?: string | null
}

export function ProfileRightPanel({
  email,
  displayName,
  subscriptionStatus,
  avatar_url: avatarUrl,
}: ProfileRightPanelProps) {
  const initials = getInitials(displayName, email)
  const { label: statusLabel, active } = getStatusBadge(subscriptionStatus)

  return (
    <div className="flex flex-col overflow-y-auto">
      {/* Шапка панели — совпадает по высоте с шапкой центральной колонки */}
      <div className="flex h-[var(--header-height)] shrink-0 items-center border-b border-border px-6">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Kartica člana
        </p>
      </div>

      <div className="flex flex-col gap-6 px-6 py-6">
        {/* Аватар + имя + статус */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary overflow-hidden">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName || email}
                width={80}
                height={80}
                className="size-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div className="text-center">
            {displayName && (
              <p className="font-heading text-base font-semibold text-foreground">{displayName}</p>
            )}
            <p className="mt-0.5 text-sm text-muted-foreground">{email}</p>
          </div>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium',
              active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            )}
          >
            {statusLabel}
          </span>
        </div>

        {/* Достижения */}
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Dosežki
          </p>
          <ul className="space-y-2">
            {achievements.map((achievement) => (
              <li
                key={achievement.label}
                className={cn(
                  'flex items-start gap-3 rounded-md border border-border p-3 transition-opacity',
                  achievement.earned ? 'border-primary/30 bg-primary/5' : 'opacity-40'
                )}
              >
                {/* Иконка достижения */}
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
                  {achievement.earned ? (
                    <svg
                      className="size-5 text-primary"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                  ) : (
                    <svg
                      className="size-5 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                      />
                    </svg>
                  )}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{achievement.label}</p>
                  <p className="text-xs text-muted-foreground">{achievement.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
