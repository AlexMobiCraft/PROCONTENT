import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Мок next/image — рендерим нативный img
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    fill,
    priority,
    ...props
  }: { src: string; alt: string; fill?: boolean; priority?: boolean; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-fill={fill} data-priority={priority} {...props} />
  ),
}))

// Мок next/link — рендерим нативный anchor
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { HeroSection } from '@/features/landing/components/HeroSection'

describe('HeroSection', () => {
  it('рендерится без ошибок', () => {
    render(<HeroSection />)

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('содержит h1 с текстом PROCONTENT', () => {
    render(<HeroSection />)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
    expect(heading.textContent).toContain('PROCONTENT')
  })

  it('отображает фоновое изображение с корректным alt-текстом', () => {
    render(<HeroSection />)

    const img = screen.getByAltText('Создательница контента за работой')
    expect(img).toBeInTheDocument()
  })

  it('ссылка "Вступить в клуб" ведёт на #pricing', () => {
    render(<HeroSection />)

    const link = screen.getByRole('link', { name: 'Вступить в клуб' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '#pricing')
  })

  it('ссылка "Посмотреть превью" ведёт на #preview', () => {
    render(<HeroSection />)

    const link = screen.getByRole('link', { name: 'Посмотреть превью' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '#preview')
  })

  it('ссылки имеют touch target min-h-[44px]', () => {
    render(<HeroSection />)

    const joinLink = screen.getByRole('link', { name: 'Вступить в клуб' })
    const previewLink = screen.getByRole('link', { name: 'Посмотреть превью' })

    expect(joinLink.className).toContain('min-h-[44px]')
    expect(previewLink.className).toContain('min-h-[44px]')
  })

  it('отображает логотип "PROCONTENT"', () => {
    render(<HeroSection />)

    // Логотип — span с текстом PROCONTENT вверху секции
    const logoElements = screen.getAllByText('PROCONTENT')
    expect(logoElements.length).toBeGreaterThanOrEqual(1)
  })

  it('содержит описание комьюнити', () => {
    render(<HeroSection />)

    expect(
      screen.getByText(/создательниц\s*контента в Словении/i)
    ).toBeInTheDocument()
  })
})
