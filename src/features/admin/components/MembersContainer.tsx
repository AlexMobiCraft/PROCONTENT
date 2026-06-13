'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { toggleMemberAccess } from '../api/members'
import { createVipUser, suspendVip, resumeVip, deleteVip } from '../api/vip'
import type { MemberProfile, VipCreateValues } from '../types'
import { MembersTable } from './MembersTable'
import { VipCreateForm } from './VipCreateForm'

interface MembersContainerProps {
  initialMembers: MemberProfile[]
}

export function MembersContainer({ initialMembers }: MembersContainerProps) {
  const router = useRouter()
  const [members, setMembers] = useState<MemberProfile[]>(initialMembers)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Синхронизация с серверными данными после router.refresh() (источник истины).
  useEffect(() => {
    setMembers(initialMembers)
  }, [initialMembers])

  async function handleToggle(userId: string, grantAccess: boolean) {
    const oldMembers = members
    const newStatus = grantAccess ? 'active' : 'canceled'

    setBusyId(userId)
    setMembers((prev) =>
      prev.map((m) => (m.id === userId ? { ...m, subscription_status: newStatus } : m))
    )

    try {
      await toggleMemberAccess(userId, grantAccess)
    } catch (err) {
      setMembers(oldMembers)
      toast.error(err instanceof Error ? err.message : 'Prišlo je do napake')
    } finally {
      setBusyId(null)
    }
  }

  async function handleCreate(values: VipCreateValues): Promise<{ existing: boolean }> {
    // Ошибки пробрасываем в форму (она показывает toast). После успеха —
    // router.refresh() подтягивает каноничные данные нового/обновлённого профиля.
    const result = await createVipUser(values)
    router.refresh()
    return { existing: result.existing }
  }

  async function handleSuspendVip(userId: string) {
    const oldMembers = members
    setBusyId(userId)
    setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, is_vip: false } : m)))

    try {
      await suspendVip(userId)
    } catch (err) {
      setMembers(oldMembers)
      toast.error(err instanceof Error ? err.message : 'Prišlo je do napake')
    } finally {
      setBusyId(null)
    }
  }

  async function handleResumeVip(userId: string) {
    const oldMembers = members
    setBusyId(userId)
    setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, is_vip: true } : m)))

    try {
      await resumeVip(userId)
    } catch (err) {
      setMembers(oldMembers)
      toast.error(err instanceof Error ? err.message : 'Prišlo je do napake')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeleteVip(userId: string) {
    const oldMembers = members
    setBusyId(userId)
    setMembers((prev) => prev.filter((m) => m.id !== userId))

    try {
      await deleteVip(userId)
      toast.success('Račun je bil izbrisan')
    } catch (err) {
      setMembers(oldMembers)
      toast.error(err instanceof Error ? err.message : 'Prišlo je do napake')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <VipCreateForm onCreate={handleCreate} />
      <MembersTable
        members={members}
        onToggle={handleToggle}
        onSuspendVip={handleSuspendVip}
        onResumeVip={handleResumeVip}
        onDeleteVip={handleDeleteVip}
        busyId={busyId}
      />
    </>
  )
}
