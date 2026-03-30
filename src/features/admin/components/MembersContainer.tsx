'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { toggleMemberAccess } from '../api/members'
import type { MemberProfile } from '../types'
import { MembersTable } from './MembersTable'

interface MembersContainerProps {
  initialMembers: MemberProfile[]
}

export function MembersContainer({ initialMembers }: MembersContainerProps) {
  const [members, setMembers] = useState<MemberProfile[]>(initialMembers)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function handleToggle(userId: string, grantAccess: boolean) {
    const oldMembers = members
    const newStatus = grantAccess ? 'active' : 'canceled'

    setTogglingId(userId)
    setMembers((prev) =>
      prev.map((m) => (m.id === userId ? { ...m, subscription_status: newStatus } : m))
    )

    try {
      await toggleMemberAccess(userId, grantAccess)
    } catch (err) {
      setMembers(oldMembers)
      const message = err instanceof Error ? err.message : 'Prišlo je do napake'
      toast.error(message)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <MembersTable members={members} onToggle={handleToggle} togglingId={togglingId} />
  )
}
