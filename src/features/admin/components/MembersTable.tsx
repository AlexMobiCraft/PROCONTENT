'use client'

import type { MemberProfile } from '../types'

interface MembersTableProps {
  members: MemberProfile[]
  onToggle: (userId: string, grantAccess: boolean) => void
  togglingId: string | null
  isLoading?: boolean
}

function isActiveStatus(status: string | null): boolean {
  return status === 'active' || status === 'trialing'
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border">
      <td className="px-4 py-3">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-9 w-32 animate-pulse rounded bg-muted" />
      </td>
    </tr>
  )
}

export function MembersTable({ members, onToggle, togglingId, isLoading }: MembersTableProps) {
  if (isLoading) {
    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">E-pošta</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Datum registracije</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dejanje</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">E-pošta</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Datum registracije</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dejanje</th>
          </tr>
        </thead>
        <tbody>
          {members.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                Ni registriranih udeleženk.
              </td>
            </tr>
          ) : (
            members.map((member) => {
              const active = isActiveStatus(member.subscription_status)
              const isToggling = togglingId === member.id
              return (
                <tr key={member.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{member.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(member.created_at).toLocaleDateString('sl-SI')}
                  </td>
                  <td className="px-4 py-3">
                    {active ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        Aktivna
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        Neaktivna
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onToggle(member.id, !active)}
                      disabled={isToggling}
                      aria-label={active ? `Prekliči dostop za ${member.email}` : `Omogoči dostop za ${member.email}`}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isToggling ? (
                        <svg
                          className="size-4 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                      ) : active ? (
                        'Prekliči dostop'
                      ) : (
                        'Omogoči dostop'
                      )}
                    </button>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
