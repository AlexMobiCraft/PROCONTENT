import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import ProfileLoading from '@/app/(app)/profile/loading'

describe('ProfileLoading', () => {
  it('рендерится без ошибок', () => {
    expect(() => render(<ProfileLoading />)).not.toThrow()
  })

  it('содержит main-элемент', () => {
    render(<ProfileLoading />)
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('содержит animate-pulse элементы (skeleton-анимация)', () => {
    const { container } = render(<ProfileLoading />)
    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it('содержит 5 bordered section (2 основных блока + 3 achievement-карточки)', () => {
    const { container } = render(<ProfileLoading />)
    const borderedSections = container.querySelectorAll('.border.border-border')
    expect(borderedSections.length).toBe(5)
  })
})
