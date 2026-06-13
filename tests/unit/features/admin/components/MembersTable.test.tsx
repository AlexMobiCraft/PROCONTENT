import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MembersTable } from '@/features/admin/components/MembersTable'
import type { MemberProfile } from '@/features/admin/types'

const activeMember: MemberProfile = {
  id: 'u1',
  email: 'ana@example.com',
  display_name: 'Ana',
  created_at: '2026-01-01T00:00:00Z',
  subscription_status: 'active',
  current_period_end: null,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  is_vip: false,
}

const trialingMember: MemberProfile = {
  id: 'u2',
  email: 'maja@example.com',
  display_name: 'Maja',
  created_at: '2026-02-01T00:00:00Z',
  subscription_status: 'trialing',
  current_period_end: null,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  is_vip: false,
}

const inactiveMember: MemberProfile = {
  id: 'u3',
  email: 'petra@example.com',
  display_name: null,
  created_at: '2026-03-01T00:00:00Z',
  subscription_status: null,
  current_period_end: null,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  is_vip: false,
}

const vipMember: MemberProfile = {
  id: 'u4',
  email: 'vip@example.com',
  display_name: 'Vip',
  created_at: '2026-04-01T00:00:00Z',
  subscription_status: 'inactive',
  current_period_end: null,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  is_vip: true,
}

type TableProps = Partial<React.ComponentProps<typeof MembersTable>>

function renderTable(props: TableProps = {}) {
  return render(
    <MembersTable
      members={props.members ?? []}
      onToggle={props.onToggle ?? vi.fn()}
      onSuspendVip={props.onSuspendVip ?? vi.fn()}
      onResumeVip={props.onResumeVip ?? vi.fn()}
      onDeleteVip={props.onDeleteVip ?? vi.fn()}
      busyId={props.busyId ?? null}
      isLoading={props.isLoading}
    />
  )
}

describe('MembersTable', () => {
  it('рендерит skeleton при isLoading=true', () => {
    renderTable({ isLoading: true })
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('показывает пустое состояние при пустом списке', () => {
    renderTable({ members: [] })
    expect(screen.getByText('Ni registriranih udeleženk.')).toBeInTheDocument()
  })

  it('рендерит активного участника с badge "Aktivna" и кнопкой "Prekliči dostop"', () => {
    renderTable({ members: [activeMember] })
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
    expect(screen.getByText('Aktivna')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Prekliči dostop/i })).toBeInTheDocument()
  })

  it('рендерит trialing участника как активного', () => {
    renderTable({ members: [trialingMember] })
    expect(screen.getByText('Aktivna')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Prekliči dostop/i })).toBeInTheDocument()
  })

  it('рендерит неактивного участника с badge "Neaktivna" и кнопкой "Omogoči dostop"', () => {
    renderTable({ members: [inactiveMember] })
    expect(screen.getByText('Neaktivna')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Omogoči dostop/i })).toBeInTheDocument()
  })

  it('вызывает onToggle с правильными аргументами при клике', async () => {
    const onToggle = vi.fn()
    renderTable({ members: [activeMember], onToggle })
    await userEvent.click(screen.getByRole('button', { name: /Prekliči dostop/i }))
    expect(onToggle).toHaveBeenCalledWith('u1', false)
  })

  it('кнопка disabled и показывает spinner при busyId === member.id', () => {
    renderTable({ members: [activeMember], busyId: 'u1' })
    const btn = screen.getByRole('button', { name: /Prekliči dostop/i })
    expect(btn).toBeDisabled()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('кнопка другого участника не disabled при busyId другого', () => {
    renderTable({ members: [activeMember, inactiveMember], busyId: 'u3' })
    expect(screen.getByRole('button', { name: /Prekliči dostop/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /Omogoči dostop/i })).toBeDisabled()
  })

  it('кнопки имеют min-h-[44px] и min-w-[44px] touch target', () => {
    renderTable({ members: [activeMember] })
    const btn = screen.getByRole('button', { name: /Prekliči dostop/i })
    expect(btn.className).toContain('min-h-[44px]')
    expect(btn.className).toContain('min-w-[44px]')
  })

  // --- VIP ---
  it('показывает бейдж VIP и кнопку "Prekliči VIP" для VIP-участника', () => {
    renderTable({ members: [vipMember] })
    expect(screen.getByText('VIP')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Prekliči VIP/i })).toBeInTheDocument()
  })

  it('показывает "Dodeli VIP" для не-VIP участника', () => {
    renderTable({ members: [activeMember] })
    expect(screen.getByRole('button', { name: /Dodeli VIP/i })).toBeInTheDocument()
  })

  it('вызывает onSuspendVip при клике "Prekliči VIP"', async () => {
    const onSuspendVip = vi.fn()
    renderTable({ members: [vipMember], onSuspendVip })
    await userEvent.click(screen.getByRole('button', { name: /Prekliči VIP/i }))
    expect(onSuspendVip).toHaveBeenCalledWith('u4')
  })

  it('вызывает onResumeVip при клике "Dodeli VIP"', async () => {
    const onResumeVip = vi.fn()
    renderTable({ members: [inactiveMember], onResumeVip })
    await userEvent.click(screen.getByRole('button', { name: /Dodeli VIP/i }))
    expect(onResumeVip).toHaveBeenCalledWith('u3')
  })

  it('удаление требует подтверждения (inline confirm) перед onDeleteVip', async () => {
    const onDeleteVip = vi.fn()
    renderTable({ members: [activeMember], onDeleteVip })

    await userEvent.click(screen.getByRole('button', { name: /Izbriši račun/i }))
    expect(onDeleteVip).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /Potrdi izbris/i }))
    expect(onDeleteVip).toHaveBeenCalledWith('u1')
  })
})
