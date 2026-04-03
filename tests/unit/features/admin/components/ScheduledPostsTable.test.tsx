import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ScheduledPostsTable } from '@/features/admin/components/ScheduledPostsTable'
import type { ScheduledPost } from '@/features/admin/types'

const post1: ScheduledPost = {
  id: 'p1',
  title: 'Prva objava',
  category: 'insight',
  status: 'scheduled',
  scheduled_at: '2026-06-15T10:00:00Z',
  created_at: '2026-04-01T00:00:00Z',
}

const post2: ScheduledPost = {
  id: 'p2',
  title: 'Druga objava',
  category: 'story',
  status: 'scheduled',
  scheduled_at: '2026-07-01T08:00:00Z',
  created_at: '2026-04-02T00:00:00Z',
}

const defaultProps = {
  posts: [post1],
  isLoading: false,
  actingIds: [],
  onCancel: vi.fn(),
  onEdit: vi.fn(),
  onPublishNow: vi.fn(),
}

describe('ScheduledPostsTable', () => {
  it('рендерит skeleton при isLoading=true', () => {
    render(<ScheduledPostsTable {...defaultProps} posts={[]} isLoading={true} />)
    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()
    const skeletonCells = document.querySelectorAll('.animate-pulse')
    expect(skeletonCells.length).toBeGreaterThan(0)
  })

  it('показывает empty state при пустом списке постов', () => {
    render(<ScheduledPostsTable {...defaultProps} posts={[]} />)
    expect(screen.getByText('Ni načrtovanih objav.')).toBeInTheDocument()
  })

  it('рендерит строки постов с заголовком и категорией', () => {
    render(<ScheduledPostsTable {...defaultProps} posts={[post1, post2]} />)
    expect(screen.getByText('Prva objava')).toBeInTheDocument()
    expect(screen.getByText('insight')).toBeInTheDocument()
    expect(screen.getByText('Druga objava')).toBeInTheDocument()
    expect(screen.getByText('story')).toBeInTheDocument()
  })

  it('рендерит кнопки Edit, Objavi zdaj, Prekliči objavo для каждого поста', () => {
    render(<ScheduledPostsTable {...defaultProps} posts={[post1]} />)
    expect(screen.getByRole('button', { name: /Uredi objavo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Objavi zdaj/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Prekliči objavo/i })).toBeInTheDocument()
  })

  it('вызывает onEdit с id поста при нажатии кнопки редактирования', async () => {
    const onEdit = vi.fn()
    render(<ScheduledPostsTable {...defaultProps} onEdit={onEdit} />)
    await userEvent.click(screen.getByRole('button', { name: /Uredi objavo/i }))
    expect(onEdit).toHaveBeenCalledWith('p1')
  })

  it('вызывает onPublishNow с id поста при нажатии Objavi zdaj', async () => {
    const onPublishNow = vi.fn()
    render(<ScheduledPostsTable {...defaultProps} onPublishNow={onPublishNow} />)
    await userEvent.click(screen.getByRole('button', { name: /Objavi zdaj/i }))
    expect(onPublishNow).toHaveBeenCalledWith('p1')
  })

  it('вызывает onCancel с id поста при нажатии Prekliči objavo', async () => {
    const onCancel = vi.fn()
    render(<ScheduledPostsTable {...defaultProps} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: /Prekliči objavo/i }))
    expect(onCancel).toHaveBeenCalledWith('p1')
  })

  it('кнопки disabled при id в actingIds', () => {
    render(<ScheduledPostsTable {...defaultProps} actingIds={['p1']} />)
    expect(screen.getByRole('button', { name: /Uredi objavo/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Objavi zdaj|Objavljanje/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Prekliči|Preklic/i })).toBeDisabled()
  })

  it('показывает loading-текст на кнопках при id в actingIds', () => {
    render(<ScheduledPostsTable {...defaultProps} actingIds={['p1']} />)
    expect(screen.getByText('Objavljanje...')).toBeInTheDocument()
    expect(screen.getByText('Preklic...')).toBeInTheDocument()
  })

  it('кнопки другого поста не disabled при другом id в actingIds', () => {
    render(<ScheduledPostsTable {...defaultProps} posts={[post1, post2]} actingIds={['p2']} />)
    const editBtns = screen.getAllByRole('button', { name: /Uredi objavo/i })
    expect(editBtns[0]).not.toBeDisabled()
    expect(editBtns[1]).toBeDisabled()
  })

  it('поддерживает несколько одновременных actingIds', () => {
    render(<ScheduledPostsTable {...defaultProps} posts={[post1, post2]} actingIds={['p1', 'p2']} />)
    const editBtns = screen.getAllByRole('button', { name: /Uredi objavo/i })
    expect(editBtns[0]).toBeDisabled()
    expect(editBtns[1]).toBeDisabled()
    expect(screen.getAllByText('Objavljanje...')).toHaveLength(2)
  })

  it('кнопки имеют min-h-[44px] touch target', () => {
    render(<ScheduledPostsTable {...defaultProps} />)
    const cancelBtn = screen.getByRole('button', { name: /Prekliči objavo/i })
    expect(cancelBtn.className).toContain('min-h-[44px]')
    expect(cancelBtn.className).toContain('min-w-[44px]')
  })

  it('обёртка таблицы имеет overflow-x-auto', () => {
    render(<ScheduledPostsTable {...defaultProps} />)
    const wrapper = document.querySelector('.overflow-x-auto')
    expect(wrapper).toBeInTheDocument()
  })

  it('рендерит заголовок Naslov, Kategorija, Načrtovano za, Dejanja', () => {
    render(<ScheduledPostsTable {...defaultProps} />)
    expect(screen.getByText('Naslov')).toBeInTheDocument()
    expect(screen.getByText('Kategorija')).toBeInTheDocument()
    expect(screen.getByText('Načrtovano za')).toBeInTheDocument()
    expect(screen.getByText('Dejanja')).toBeInTheDocument()
  })
})
