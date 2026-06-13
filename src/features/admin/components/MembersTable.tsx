'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { MemberProfile } from '../types'

interface MembersTableProps {
  members: MemberProfile[]
  onToggle: (userId: string, grantAccess: boolean) => void
  onSuspendVip: (userId: string) => void
  onResumeVip: (userId: string) => void
  onDeleteVip: (userId: string) => void
  busyId: string | null
  isLoading?: boolean
}

function isActiveStatus(status: string | null): boolean {
  return status === 'active' || status === 'trialing'
}

const COLUMNS = ['E-pošta', 'Datum registracije', 'Status', 'Dejanje']

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

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30">
          <tr>
            {COLUMNS.map((col) => (
              <th key={col} className="px-4 py-3 text-left font-medium text-muted-foreground">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function MembersTable({
  members,
  onToggle,
  onSuspendVip,
  onResumeVip,
  onDeleteVip,
  busyId,
  isLoading,
}: MembersTableProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <TableShell>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </TableShell>
    )
  }

  if (members.length === 0) {
    return (
      <TableShell>
        <tr>
          <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
            Ni registriranih udeleženk.
          </td>
        </tr>
      </TableShell>
    )
  }

  return (
    <TableShell>
      {members.map((member) => {
        const active = isActiveStatus(member.subscription_status)
        const isBusy = busyId === member.id
        const isConfirmingDelete = confirmDeleteId === member.id
        const hasStripeSub = member.stripe_subscription_id !== null

        return (
          <tr key={member.id} className="border-b border-border last:border-0">
            <td className="px-4 py-3 font-medium">{member.email}</td>
            <td className="px-4 py-3 text-muted-foreground">
              {new Date(member.created_at).toLocaleDateString('sl-SI')}
            </td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {active ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                    Aktivna
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    Neaktivna
                  </span>
                )}
                {member.is_vip && (
                  <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                    VIP
                  </span>
                )}
              </div>
            </td>
            <td className="px-4 py-3">
              {isConfirmingDelete ? (
                <div className="flex flex-col gap-2">
                  {hasStripeSub && (
                    <p className="text-xs text-muted-foreground" role="alert">
                      Brisanje računa NE prekliče naročnine v Stripe.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteVip(member.id)
                        setConfirmDeleteId(null)
                      }}
                      disabled={isBusy}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Potrdi izbris
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={isBusy}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Prekliči
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onToggle(member.id, !active)}
                    disabled={isBusy}
                    aria-label={
                      active
                        ? `Prekliči dostop za ${member.email}`
                        : `Omogoči dostop za ${member.email}`
                    }
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isBusy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : active ? (
                      'Prekliči dostop'
                    ) : (
                      'Omogoči dostop'
                    )}
                  </button>

                  {member.is_vip ? (
                    <button
                      type="button"
                      onClick={() => onSuspendVip(member.id)}
                      disabled={isBusy}
                      aria-label={`Prekliči VIP za ${member.email}`}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-primary px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Prekliči VIP
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onResumeVip(member.id)}
                      disabled={isBusy}
                      aria-label={`Dodeli VIP za ${member.email}`}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-primary px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Dodeli VIP
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(member.id)}
                    disabled={isBusy}
                    aria-label={`Izbriši račun za ${member.email}`}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-destructive px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Izbriši
                  </button>
                </div>
              )}
            </td>
          </tr>
        )
      })}
    </TableShell>
  )
}
