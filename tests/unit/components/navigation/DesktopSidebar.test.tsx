import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import { DesktopSidebar } from '@/components/navigation/DesktopSidebar'

describe('DesktopSidebar', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/feed')
  })

  it('рендерит основные пункты навигации', () => {
    render(<DesktopSidebar />)
    expect(screen.getByText('Domov')).toBeInTheDocument()
    expect(screen.getByText('Objave')).toBeInTheDocument()
    expect(screen.getByText('Iskanje')).toBeInTheDocument()
    expect(screen.getByText('Profil')).toBeInTheDocument()
  })

  it('не показывает секцию "Administracija" без isAdmin', () => {
    render(<DesktopSidebar />)
    expect(screen.queryByText('Administracija')).not.toBeInTheDocument()
  })

  it('не показывает секцию "Administracija" при isAdmin=false', () => {
    render(<DesktopSidebar isAdmin={false} />)
    expect(screen.queryByText('Administracija')).not.toBeInTheDocument()
  })

  it('показывает секцию "Administracija" при isAdmin=true', () => {
    render(<DesktopSidebar isAdmin={true} />)
    expect(screen.getByText('Administracija')).toBeInTheDocument()
  })

  it('при isAdmin=true показывает 3 admin-ссылки', () => {
    render(<DesktopSidebar isAdmin={true} />)
    expect(screen.getByText('Nova objava')).toBeInTheDocument()
    expect(screen.getByText('Kategorije')).toBeInTheDocument()
    expect(screen.getByText('Nastavitve')).toBeInTheDocument()
  })

  it('admin-ссылки ведут на правильные пути', () => {
    render(<DesktopSidebar isAdmin={true} />)
    expect(screen.getByRole('link', { name: 'Nova objava' })).toHaveAttribute('href', '/admin/posts/create')
    expect(screen.getByRole('link', { name: 'Upravljanje kategorij' })).toHaveAttribute('href', '/admin/categories')
    expect(screen.getByRole('link', { name: 'Nastavitve administracije' })).toHaveAttribute('href', '/admin/settings')
  })

  it('при isAdmin=true не показывает admin-ссылок не-admin пользователям (isAdmin=false)', () => {
    render(<DesktopSidebar isAdmin={false} />)
    expect(screen.queryByText('Nova objava')).not.toBeInTheDocument()
    expect(screen.queryByText('Kategorije')).not.toBeInTheDocument()
    expect(screen.queryByText('Nastavitve')).not.toBeInTheDocument()
  })
})
