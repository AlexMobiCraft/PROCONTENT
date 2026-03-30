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
}

const trialingMember: MemberProfile = {
  id: 'u2',
  email: 'maja@example.com',
  display_name: 'Maja',
  created_at: '2026-02-01T00:00:00Z',
  subscription_status: 'trialing',
  current_period_end: null,
  stripe_customer_id: null,
}

const inactiveMember: MemberProfile = {
  id: 'u3',
  email: 'petra@example.com',
  display_name: null,
  created_at: '2026-03-01T00:00:00Z',
  subscription_status: null,
  current_period_end: null,
  stripe_customer_id: null,
}

describe('MembersTable', () => {
  it('рендерит skeleton при isLoading=true', () => {
    render(
      <MembersTable members={[]} onToggle={vi.fn()} togglingId={null} isLoading={true} />
    )
    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()
    const skeletonCells = document.querySelectorAll('.animate-pulse')
    expect(skeletonCells.length).toBeGreaterThan(0)
  })

  it('показывает пустое состояние при пустом списке', () => {
    render(<MembersTable members={[]} onToggle={vi.fn()} togglingId={null} />)
    expect(screen.getByText('Ni registriranih udeleženk.')).toBeInTheDocument()
  })

  it('рендерит активного участника с badge "Aktivna" и кнопкой "Prekliči dostop"', () => {
    render(
      <MembersTable members={[activeMember]} onToggle={vi.fn()} togglingId={null} />
    )
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
    expect(screen.getByText('Aktivna')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Prekliči dostop/i })).toBeInTheDocument()
  })

  it('рендерит trialing участника как активного', () => {
    render(
      <MembersTable members={[trialingMember]} onToggle={vi.fn()} togglingId={null} />
    )
    expect(screen.getByText('Aktivna')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Prekliči dostop/i })).toBeInTheDocument()
  })

  it('рендерит неактивного участника с badge "Neaktivna" и кнопкой "Omogoči dostop"', () => {
    render(
      <MembersTable members={[inactiveMember]} onToggle={vi.fn()} togglingId={null} />
    )
    expect(screen.getByText('Neaktivna')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Omogoči dostop/i })).toBeInTheDocument()
  })

  it('вызывает onToggle с правильными аргументами при клике', async () => {
    const onToggle = vi.fn()
    render(<MembersTable members={[activeMember]} onToggle={onToggle} togglingId={null} />)
    await userEvent.click(screen.getByRole('button', { name: /Prekliči dostop/i }))
    expect(onToggle).toHaveBeenCalledWith('u1', false)
  })

  it('кнопка disabled и показывает spinner при togglingId === member.id', () => {
    render(
      <MembersTable members={[activeMember]} onToggle={vi.fn()} togglingId="u1" />
    )
    const btn = screen.getByRole('button', { name: /Prekliči dostop/i })
    expect(btn).toBeDisabled()
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('кнопка другого участника не disabled при togglingId другого', () => {
    render(
      <MembersTable
        members={[activeMember, inactiveMember]}
        onToggle={vi.fn()}
        togglingId="u3"
      />
    )
    const activeBtn = screen.getByRole('button', { name: /Prekliči dostop/i })
    expect(activeBtn).not.toBeDisabled()
    const inactiveBtn = screen.getByRole('button', { name: /Omogoči dostop/i })
    expect(inactiveBtn).toBeDisabled()
  })

  it('кнопки имеют min-h-[44px] и min-w-[44px] touch target', () => {
    render(
      <MembersTable members={[activeMember]} onToggle={vi.fn()} togglingId={null} />
    )
    const btn = screen.getByRole('button', { name: /Prekliči dostop/i })
    expect(btn.className).toContain('min-h-[44px]')
    expect(btn.className).toContain('min-w-[44px]')
  })
})
