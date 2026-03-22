import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/components/media/LazyMediaWrapper', () => ({
  LazyMediaWrapper: ({
    aspectRatio,
    type,
    priority,
  }: {
    aspectRatio: string
    type: string
    priority?: boolean
  }) => (
    <div
      data-testid="lazy-media"
      data-aspect={aspectRatio}
      data-type={type}
      data-priority={String(priority ?? false)}
    />
  ),
}))

const mockRpc = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ rpc: mockRpc }),
}))

const mockBack = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack }),
}))

const mockUpdatePost = vi.hoisted(() => vi.fn())

vi.mock('@/features/feed/store', () => ({
  useFeedStore: (selector: (state: { updatePost: typeof mockUpdatePost }) => unknown) =>
    selector({ updatePost: mockUpdatePost }),
}))

import { PostDetail } from '@/components/feed/PostDetail'
import type { PostDetail as PostDetailData } from '@/features/feed/types'

function makePost(overrides: Partial<PostDetailData> = {}): PostDetailData {
  return {
    id: 'post-1',
    title: 'Testna objava',
    excerpt: 'Kratek opis',
    content: 'Celotno besedilo',
    category: 'Stories',
    type: 'text',
    imageUrl: null,
    likes: 5,
    comments: 3,
    isLiked: false,
    created_at: '2026-03-15T12:00:00Z',
    author: { name: 'Ana Ivanova', initials: 'AI' },
    ...overrides,
  }
}

describe('PostDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // --- Базовый рендер ---

  it('рендерит заголовок поста', () => {
    render(<PostDetail post={makePost()} />)
    expect(screen.getByRole('heading', { name: 'Testna objava' })).toBeInTheDocument()
  })

  it('рендерит имя автора', () => {
    render(<PostDetail post={makePost()} />)
    expect(screen.getByText('Ana Ivanova')).toBeInTheDocument()
  })

  it('рендерит дату из created_at (клиент-сайд форматирование)', () => {
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('15. marca 2026')
    render(<PostDetail post={makePost({ created_at: '2026-03-15T12:00:00Z' })} />)
    expect(screen.getByText('15. marca 2026')).toBeInTheDocument()
  })

  it('рендерит категорию', () => {
    render(<PostDetail post={makePost({ category: 'UGC' })} />)
    expect(screen.getByText('UGC')).toBeInTheDocument()
  })

  // --- Кнопка "Назад" ---

  it('кнопка "Назад" вызывает router.back() (AC 3 — сохранение скролла)', async () => {
    const user = userEvent.setup()
    render(<PostDetail post={makePost()} />)
    await user.click(screen.getByRole('button', { name: 'Nazaj na objave' }))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('кнопка "Назад" не является ссылкой (не сбрасывает скролл)', () => {
    render(<PostDetail post={makePost()} />)
    expect(screen.queryByRole('link', { name: /nazaj/i })).not.toBeInTheDocument()
  })

  // --- Рендер по типу контента ---

  it('text: рендерит content без медиа', () => {
    render(<PostDetail post={makePost({ type: 'text', content: 'Celotno besedilo' })} />)
    expect(screen.getByText('Celotno besedilo')).toBeInTheDocument()
    expect(screen.queryByTestId('lazy-media')).not.toBeInTheDocument()
  })

  it('text: рендерит excerpt если content=null', () => {
    render(<PostDetail post={makePost({ type: 'text', content: null, excerpt: 'Kratek opis' })} />)
    expect(screen.getByText('Kratek opis')).toBeInTheDocument()
  })

  it('photo: рендерит LazyMediaWrapper с aspectRatio 4/5', () => {
    render(
      <PostDetail post={makePost({ type: 'photo', imageUrl: 'https://example.com/img.jpg' })} />
    )
    const media = screen.getByTestId('lazy-media')
    expect(media).toBeInTheDocument()
    expect(media).toHaveAttribute('data-aspect', '4/5')
  })

  it('photo: LazyMediaWrapper получает priority=true (LCP оптимизация)', () => {
    render(
      <PostDetail post={makePost({ type: 'photo', imageUrl: 'https://example.com/img.jpg' })} />
    )
    expect(screen.getByTestId('lazy-media')).toHaveAttribute('data-priority', 'true')
  })

  it('video: рендерит LazyMediaWrapper с aspectRatio 16/9', () => {
    render(
      <PostDetail post={makePost({ type: 'video', imageUrl: 'https://example.com/vid.jpg' })} />
    )
    expect(screen.getByTestId('lazy-media')).toHaveAttribute('data-aspect', '16/9')
  })

  it('photo/video: не рендерит медиа если imageUrl=null', () => {
    render(<PostDetail post={makePost({ type: 'photo', imageUrl: null })} />)
    expect(screen.queryByTestId('lazy-media')).not.toBeInTheDocument()
  })

  // --- Кнопка лайка ---

  it('кнопка лайка: начальное состояние isLiked=false (Všečkaj)', () => {
    render(<PostDetail post={makePost({ isLiked: false })} />)
    expect(screen.getByRole('button', { name: 'Všečkaj' })).toBeInTheDocument()
  })

  it('кнопка лайка: начальное состояние isLiked=true (Odstrani všeček)', () => {
    render(<PostDetail post={makePost({ isLiked: true })} />)
    expect(screen.getByRole('button', { name: 'Odstrani všeček' })).toBeInTheDocument()
  })

  it('показывает счётчик лайков', () => {
    render(<PostDetail post={makePost({ likes: 7 })} />)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  // --- Auth check ---

  it('аноним (currentUserId=null): клик лайка не вызывает RPC', async () => {
    const user = userEvent.setup()
    render(<PostDetail post={makePost({ isLiked: false })} currentUserId={null} />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('аноним (currentUserId=null): счётчик не меняется при клике', async () => {
    const user = userEvent.setup()
    render(<PostDetail post={makePost({ likes: 5, isLiked: false })} currentUserId={null} />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  // --- Оптимистичные обновления (auth required) ---

  it('оптимистичное обновление: счётчик увеличивается при клике', async () => {
    mockRpc.mockResolvedValue({ data: { is_liked: true, likes_count: 6 }, error: null })
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ likes: 5, isLiked: false })} currentUserId="user-1" />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))

    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('оптимистичное обновление: счётчик уменьшается при unlike', async () => {
    mockRpc.mockResolvedValue({ data: { is_liked: false, likes_count: 4 }, error: null })
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ likes: 5, isLiked: true })} currentUserId="user-1" />)
    await user.click(screen.getByRole('button', { name: 'Odstrani všeček' }))

    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('вызывает rpc toggle_like с корректным post.id', async () => {
    mockRpc.mockResolvedValue({ data: { is_liked: true, likes_count: 6 }, error: null })
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ id: 'post-xyz', likes: 5 })} currentUserId="user-1" />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))

    expect(mockRpc).toHaveBeenCalledWith('toggle_like', { p_post_id: 'post-xyz' })
  })

  it('rollback при ошибке RPC — возвращает исходный счётчик', async () => {
    mockRpc.mockRejectedValue(new Error('RPC failed'))
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ likes: 5, isLiked: false })} currentUserId="user-1" />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))

    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Všečkaj' })).toBeInTheDocument()
  })

  it('синхронизирует состояние с ответом сервера (source of truth)', async () => {
    mockRpc.mockResolvedValue({ data: { is_liked: true, likes_count: 8 }, error: null })
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ likes: 5, isLiked: false })} currentUserId="user-1" />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))

    await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument())
  })

  // --- Store sync ---

  it('после успешного лайка обновляет Zustand store', async () => {
    mockRpc.mockResolvedValue({ data: { is_liked: true, likes_count: 6 }, error: null })
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ id: 'post-1', likes: 5 })} currentUserId="user-1" />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))

    await waitFor(() =>
      expect(mockUpdatePost).toHaveBeenCalledWith('post-1', { likes_count: 6, is_liked: true })
    )
  })

  it('rollback при ошибке: store НЕ обновляется', async () => {
    mockRpc.mockRejectedValue(new Error('RPC failed'))
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ id: 'post-1', likes: 5 })} currentUserId="user-1" />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))

    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument())
    expect(mockUpdatePost).not.toHaveBeenCalled()
  })

  // --- Счётчик комментариев ---

  it('показывает счётчик комментариев', () => {
    render(<PostDetail post={makePost({ comments: 12 })} />)
    expect(screen.getByText('12')).toBeInTheDocument()
  })
})
