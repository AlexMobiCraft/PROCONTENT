import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateCategory = vi.fn()
const mockDeleteCategory = vi.fn()

vi.mock('@/features/admin/api/categories', () => ({
  createCategory: (...args: unknown[]) => mockCreateCategory(...args),
  deleteCategory: (...args: unknown[]) => mockDeleteCategory(...args),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { CategoryManager } from '@/features/admin/components/CategoryManager'
import type { Category } from '@/features/admin/api/categories'
import { toast } from 'sonner'

const mockCategories: Category[] = [
  { id: '1', name: 'Drugo', slug: 'drugo', created_at: '2026-01-01T00:00:00Z' },
  { id: '2', name: 'Stories', slug: 'stories', created_at: '2026-01-01T00:00:00Z' },
]

describe('CategoryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('отображает список категорий', () => {
    render(<CategoryManager initialCategories={mockCategories} />)
    expect(screen.getByText('Drugo')).toBeInTheDocument()
    expect(screen.getByText('Stories')).toBeInTheDocument()
    expect(screen.getByText('slug: drugo')).toBeInTheDocument()
    expect(screen.getByText('slug: stories')).toBeInTheDocument()
  })

  it('отображает пустое состояние если нет категорий', () => {
    render(<CategoryManager initialCategories={[]} />)
    expect(screen.getByText('Ni kategorij')).toBeInTheDocument()
  })

  it('показывает инлайн ошибку при пустом имени', async () => {
    const user = userEvent.setup()
    render(<CategoryManager initialCategories={[]} />)

    await user.click(screen.getByRole('button', { name: 'Dodaj' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Ime kategorije je obvezno')
    expect(mockCreateCategory).not.toHaveBeenCalled()
  })

  it('создаёт категорию и добавляет в список', async () => {
    const user = userEvent.setup()
    const newCat: Category = { id: '3', name: 'Novost', slug: 'novost', created_at: '2026-01-02T00:00:00Z' }
    mockCreateCategory.mockResolvedValue(newCat)

    render(<CategoryManager initialCategories={[...mockCategories]} />)

    await user.type(screen.getByLabelText('Ime kategorije'), 'Novost')
    await user.click(screen.getByRole('button', { name: 'Dodaj' }))

    await waitFor(() => {
      expect(screen.getByText('Novost')).toBeInTheDocument()
    })
    expect(mockCreateCategory).toHaveBeenCalledWith('Novost', 'novost')
    expect(toast.success).toHaveBeenCalledWith('Kategorija je bila dodana')
    expect(screen.getByLabelText('Ime kategorije')).toHaveValue('')
  })

  it('показывает инлайн ошибку при дубликате', async () => {
    const user = userEvent.setup()
    mockCreateCategory.mockRejectedValue(new Error('Kategorija s tem imenom že obstaja'))

    render(<CategoryManager initialCategories={[...mockCategories]} />)

    await user.type(screen.getByLabelText('Ime kategorije'), 'Stories')
    await user.click(screen.getByRole('button', { name: 'Dodaj' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Kategorija s tem imenom že obstaja')
    })
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('показывает toast при прочих ошибках создания', async () => {
    const user = userEvent.setup()
    mockCreateCategory.mockRejectedValue(new Error('Network error'))

    render(<CategoryManager initialCategories={[...mockCategories]} />)

    await user.type(screen.getByLabelText('Ime kategorije'), 'Test')
    await user.click(screen.getByRole('button', { name: 'Dodaj' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Network error')
    })
  })

  it('удаляет категорию и убирает из списка', async () => {
    const user = userEvent.setup()
    mockDeleteCategory.mockResolvedValue(undefined)

    render(<CategoryManager initialCategories={[...mockCategories]} />)

    await user.click(screen.getByRole('button', { name: 'Izbriši kategorijo Drugo' }))

    await waitFor(() => {
      expect(screen.queryByText('Drugo')).not.toBeInTheDocument()
    })
    expect(mockDeleteCategory).toHaveBeenCalledWith('1')
    expect(toast.success).toHaveBeenCalledWith('Kategorija je bila izbrisana')
  })

  it('показывает toast при ошибке удаления', async () => {
    const user = userEvent.setup()
    mockDeleteCategory.mockRejectedValue(
      new Error('Kategorije ni mogoče izbrisati, ker jo uporabljajo objave')
    )

    render(<CategoryManager initialCategories={[...mockCategories]} />)

    await user.click(screen.getByRole('button', { name: 'Izbriši kategorijo Drugo' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Kategorije ni mogoče izbrisati, ker jo uporabljajo objave'
      )
    })
    // Категория остаётся в списке
    expect(screen.getByText('Drugo')).toBeInTheDocument()
  })

  it('автогенерирует slug из имени', async () => {
    const user = userEvent.setup()
    const newCat: Category = { id: '4', name: 'Estetski kadri', slug: 'estetski-kadri', created_at: '2026-01-01T00:00:00Z' }
    mockCreateCategory.mockResolvedValue(newCat)

    render(<CategoryManager initialCategories={[]} />)

    await user.type(screen.getByLabelText('Ime kategorije'), 'Estetski kadri')
    await user.click(screen.getByRole('button', { name: 'Dodaj' }))

    await waitFor(() => {
      expect(mockCreateCategory).toHaveBeenCalledWith('Estetski kadri', 'estetski-kadri')
    })
  })
})
