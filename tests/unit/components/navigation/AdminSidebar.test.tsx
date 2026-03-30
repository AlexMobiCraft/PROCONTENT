import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockPathname = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { AdminSidebar } from '@/components/navigation/AdminSidebar'

describe('AdminSidebar', () => {
  it('рендерит все 4 nav-пункта', () => {
    mockPathname.mockReturnValue('/posts/create')
    render(<AdminSidebar />)
    expect(screen.getByText('Nova objava')).toBeInTheDocument()
    expect(screen.getByText('Kategorije')).toBeInTheDocument()
    expect(screen.getByText('Udeleženke')).toBeInTheDocument()
    expect(screen.getByText('Nastavitve')).toBeInTheDocument()
  })

  it('рендерит ссылку возврата "Aplikacija"', () => {
    mockPathname.mockReturnValue('/posts/create')
    render(<AdminSidebar />)
    expect(screen.getByText('Aplikacija')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nazaj na aplikacijo' })).toHaveAttribute('href', '/feed')
  })

  it('активный пункт при pathname=/categories получает aria-current="page"', () => {
    mockPathname.mockReturnValue('/categories')
    render(<AdminSidebar />)
    const activeLink = screen.getByRole('link', { name: 'Upravljanje kategorij' })
    expect(activeLink).toHaveAttribute('aria-current', 'page')
  })

  it('неактивные пункты не имеют aria-current', () => {
    mockPathname.mockReturnValue('/categories')
    render(<AdminSidebar />)
    const novaLink = screen.getByRole('link', { name: 'Nova objava' })
    expect(novaLink).not.toHaveAttribute('aria-current')
  })

  it('активный пункт имеет класс bg-muted', () => {
    mockPathname.mockReturnValue('/settings')
    render(<AdminSidebar />)
    const activeLink = screen.getByRole('link', { name: 'Nastavitve administracije' })
    expect(activeLink.className).toContain('bg-muted')
  })

  it('активный пункт при pathname=/members получает aria-current="page"', () => {
    mockPathname.mockReturnValue('/members')
    render(<AdminSidebar />)
    const activeLink = screen.getByRole('link', { name: 'Upravljanje udeleženk' })
    expect(activeLink).toHaveAttribute('aria-current', 'page')
  })

  it('все nav-элементы имеют aria-label', () => {
    mockPathname.mockReturnValue('/posts/create')
    render(<AdminSidebar />)
    const links = screen.getAllByRole('link')
    links.forEach((link) => {
      expect(link).toHaveAttribute('aria-label')
    })
  })

  it('рендерит aside с aria-label', () => {
    mockPathname.mockReturnValue('/posts/create')
    render(<AdminSidebar />)
    expect(screen.getByRole('complementary', { name: 'Administratorska navigacija' })).toBeInTheDocument()
  })
})
