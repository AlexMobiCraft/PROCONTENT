import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { EmailPreferencesCard } from '@/features/profile/components/EmailPreferencesCard'

const defaultProps = {
  emailNotificationsEnabled: true,
  onToggle: vi.fn(),
}

describe('EmailPreferencesCard', () => {
  it('рендерит заголовок карточки', () => {
    render(<EmailPreferencesCard {...defaultProps} />)
    expect(screen.getByText('E-poštna obvestila')).toBeInTheDocument()
  })

  it('рендерит описание карточки', () => {
    render(<EmailPreferencesCard {...defaultProps} />)
    expect(
      screen.getByText(/Prejemajte obvestila o novih objavah/)
    ).toBeInTheDocument()
  })

  it('рендерит toggle с label', () => {
    render(<EmailPreferencesCard {...defaultProps} />)
    expect(screen.getByText('Obvestila o novih objavah')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('toggle aria-checked=true когда enabled=true', () => {
    render(<EmailPreferencesCard {...defaultProps} emailNotificationsEnabled={true} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('toggle aria-checked=false когда enabled=false', () => {
    render(<EmailPreferencesCard {...defaultProps} emailNotificationsEnabled={false} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('вызывает onToggle(false) при клике когда включён', () => {
    const onToggle = vi.fn()
    render(
      <EmailPreferencesCard {...defaultProps} emailNotificationsEnabled={true} onToggle={onToggle} />
    )
    fireEvent.click(screen.getByRole('switch'))
    expect(onToggle).toHaveBeenCalledWith(false)
  })

  it('вызывает onToggle(true) при клике когда выключен', () => {
    const onToggle = vi.fn()
    render(
      <EmailPreferencesCard {...defaultProps} emailNotificationsEnabled={false} onToggle={onToggle} />
    )
    fireEvent.click(screen.getByRole('switch'))
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('toggle disabled при isLoading=true', () => {
    render(<EmailPreferencesCard {...defaultProps} isLoading={true} />)
    expect(screen.getByRole('switch')).toBeDisabled()
  })

  it('toggle disabled при isDisabled=true', () => {
    render(<EmailPreferencesCard {...defaultProps} isDisabled={true} />)
    expect(screen.getByRole('switch')).toBeDisabled()
  })

  it('не вызывает onToggle при клике на disabled toggle', () => {
    const onToggle = vi.fn()
    render(<EmailPreferencesCard {...defaultProps} onToggle={onToggle} isDisabled={true} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('показывает индикатор загрузки при isLoading=true', () => {
    render(<EmailPreferencesCard {...defaultProps} isLoading={true} />)
    expect(screen.getByText('Shranjevanje...')).toBeInTheDocument()
  })

  it('не показывает индикатор загрузки при isLoading=false', () => {
    render(<EmailPreferencesCard {...defaultProps} isLoading={false} />)
    expect(screen.queryByText('Shranjevanje...')).not.toBeInTheDocument()
  })

  it('использует кастомный id для toggle', () => {
    render(<EmailPreferencesCard {...defaultProps} id="custom-toggle-id" />)
    expect(screen.getByRole('switch')).toHaveAttribute('id', 'custom-toggle-id')
  })

  it('использует дефолтный id="email-preferences" если не передан', () => {
    render(<EmailPreferencesCard {...defaultProps} />)
    expect(screen.getByRole('switch')).toHaveAttribute('id', 'email-preferences')
  })

  it('toggle имеет минимальный touch target (min-w-[44px])', () => {
    render(<EmailPreferencesCard {...defaultProps} />)
    const toggle = screen.getByRole('switch')
    expect(toggle.className).toContain('min-w-[44px]')
  })
})
