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

vi.mock('@/features/feed/components/VideoPlayerContainer', () => ({
  VideoPlayerContainer: ({
    videoId,
    src,
    poster,
    aspectRatio,
    priority,
  }: {
    videoId: string
    src: string
    poster?: string
    aspectRatio: string
    priority?: boolean
  }) => (
    <div
      data-testid="video-player-container"
      data-video-id={videoId}
      data-src={src}
      data-poster={poster}
      data-aspect={aspectRatio}
      data-priority={String(priority ?? false)}
    />
  ),
}))

vi.mock('@/components/feed/GalleryGrid', () => ({
  GalleryGrid: ({ media, priority }: { media: unknown[]; priority?: boolean }) => (
    <div
      data-testid="gallery-grid"
      data-count={media.length}
      data-priority={String(priority ?? false)}
    />
  ),
}))

const mockToastError = vi.hoisted(() => vi.fn())
const mockToastInfo = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: { error: mockToastError, info: mockToastInfo },
}))

const mockRpc = vi.hoisted(() => vi.fn())
const mockGetUser = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ rpc: mockRpc, auth: { getUser: mockGetUser } }),
}))

const mockBack = vi.hoisted(() => vi.fn())
const mockPush = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}))

const mockUpdatePost = vi.hoisted(() => vi.fn())

vi.mock('@/features/feed/store', () => ({
  useFeedStore: (selector: (state: { updatePost: typeof mockUpdatePost }) => unknown) =>
    selector({ updatePost: mockUpdatePost }),
}))

import { PostDetail } from '@/components/feed/PostDetail'
import type { PostDetail as PostDetailData, PostMedia } from '@/features/feed/types'

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
    is_liked: false,
    created_at: '2026-03-15T12:00:00Z',
    author: { name: 'Ana Ivanova', initials: 'AI' },
    ...overrides,
  }
}

describe('PostDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // По умолчанию: сессия активна (для существующих тестов, проверяющих generic error toast)
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
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

  it('рендерит formattedDate синхронно без layout shift (Fix #3)', () => {
    render(<PostDetail post={makePost()} formattedDate="15. marca 2026" />)
    expect(screen.getByText('15. marca 2026')).toBeInTheDocument()
  })

  it('рендерит дату из created_at если formattedDate не передан (fallback)', () => {
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('15. marca 2026')
    render(<PostDetail post={makePost({ created_at: '2026-03-15T12:00:00Z' })} />)
    expect(screen.getByText('15. marca 2026')).toBeInTheDocument()
  })

  it('рендерит категорию', () => {
    render(<PostDetail post={makePost({ category: 'UGC' })} />)
    expect(screen.getByText('UGC')).toBeInTheDocument()
  })

  // --- Кнопка "Назад" (Fix #1: from prop вместо document.referrer) ---

  it('кнопка "Назад" вызывает router.back() при from="feed" (AC 3 — SPA-переход из ленты)', async () => {
    const user = userEvent.setup()
    render(<PostDetail post={makePost()} from="feed" />)
    await user.click(screen.getByRole('button', { name: 'Nazaj na objave' }))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('кнопка "Назад" не является ссылкой (не сбрасывает скролл)', () => {
    render(<PostDetail post={makePost()} />)
    expect(screen.queryByRole('link', { name: /nazaj/i })).not.toBeInTheDocument()
  })

  it('router.push("/feed") при прямом входе — нет from prop (прямая ссылка / новая вкладка)', async () => {
    const user = userEvent.setup()
    render(<PostDetail post={makePost()} />)
    await user.click(screen.getByRole('button', { name: 'Nazaj na objave' }))
    expect(mockBack).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/feed')
  })

  it('router.push("/feed") при from=undefined (внешний переход или прямая ссылка)', async () => {
    const user = userEvent.setup()
    render(<PostDetail post={makePost()} from={undefined} />)
    await user.click(screen.getByRole('button', { name: 'Nazaj na objave' }))
    expect(mockBack).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/feed')
  })

  it('router.back() при from="feed" — без push (SPA навигация из ленты)', async () => {
    const user = userEvent.setup()
    render(<PostDetail post={makePost()} from="feed" />)
    await user.click(screen.getByRole('button', { name: 'Nazaj na objave' }))
    expect(mockBack).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
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

  it('video: рендерит VideoPlayerContainer с aspectRatio 16/9', () => {
    const post = makePost({
      type: 'video',
      mediaItem: {
        id: 'v-1',
        url: 'https://example.com/vid.mp4',
        thumbnail_url: 'https://example.com/thumb.jpg',
      } as unknown as PostMedia,
    })
    render(<PostDetail post={post} />)
    const video = screen.getByTestId('video-player-container')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('data-video-id', 'v-1')
    expect(video).toHaveAttribute('data-src', 'https://example.com/vid.mp4')
    expect(video).toHaveAttribute('data-poster', 'https://example.com/thumb.jpg')
    expect(video).toHaveAttribute('data-aspect', '16/9')
    expect(video).toHaveAttribute('data-priority', 'true')
  })

  it('gallery: рендерит GalleryGrid при наличии 2+ медиа', () => {
    const post = makePost({
      type: 'gallery',
      media: [{ id: '1' }, { id: '2' }] as unknown as PostMedia[],
    })
    render(<PostDetail post={post} />)
    const grid = screen.getByTestId('gallery-grid')
    expect(grid).toBeInTheDocument()
    expect(grid).toHaveAttribute('data-count', '2')
    expect(grid).toHaveAttribute('data-priority', 'true')
  })

  it('multi-video: рендерит GalleryGrid при наличии 2+ видео', () => {
    const post = makePost({
      type: 'multi-video',
      media: [
        { id: 'v1', media_type: 'video' },
        { id: 'v2', media_type: 'video' },
      ] as unknown as PostMedia[],
    })
    render(<PostDetail post={post} />)
    expect(screen.getByTestId('gallery-grid')).toBeInTheDocument()
  })

  it('photo/video: не рендерит медиа если imageUrl=null', () => {
    render(<PostDetail post={makePost({ type: 'photo', imageUrl: null })} />)
    expect(screen.queryByTestId('lazy-media')).not.toBeInTheDocument()
  })

  it('multi-video с 1 медиа: не рендерит медиа (невозможное состояние по derivePostType)', () => {
    // Fix #4: multi-video/gallery с media.length < 2 — невозможно по инварианту derivePostType.
    // Упрощённый код не содержит dead code проверок для этих типов в блоке < 2.
    const post = makePost({
      type: 'multi-video',
      media: [{ id: 'v1', media_type: 'video', url: 'https://example.com/vid.mp4' }] as unknown as PostMedia[],
      mediaItem: { id: 'v1', url: 'https://example.com/vid.mp4', thumbnail_url: null } as unknown as PostMedia,
    })
    render(<PostDetail post={post} />)
    expect(screen.queryByTestId('video-player-container')).not.toBeInTheDocument()
    expect(screen.queryByTestId('gallery-grid')).not.toBeInTheDocument()
  })

  it('gallery с 1 медиа: не рендерит медиа (невозможное состояние по derivePostType)', () => {
    // Fix #4: dead code удалён — type='gallery' с media.length < 2 невозможен в production.
    const post = makePost({
      type: 'gallery',
      media: [{ id: 'p1', media_type: 'image', url: 'https://example.com/img.jpg' }] as unknown as PostMedia[],
      mediaItem: { id: 'p1', url: 'https://example.com/img.jpg', thumbnail_url: null } as unknown as PostMedia,
    })
    render(<PostDetail post={post} />)
    expect(screen.queryByTestId('lazy-media')).not.toBeInTheDocument()
    expect(screen.queryByTestId('gallery-grid')).not.toBeInTheDocument()
  })

  // --- Кнопка лайка ---

  it('кнопка лайка: начальное состояние isLiked=false (Všečkaj)', () => {
    render(<PostDetail post={makePost({ is_liked: false })} />)
    expect(screen.getByRole('button', { name: 'Všečkaj' })).toBeInTheDocument()
  })

  it('кнопка лайка: начальное состояние isLiked=true (Odstrani všeček)', () => {
    render(<PostDetail post={makePost({ is_liked: true })} />)
    expect(screen.getByRole('button', { name: 'Odstrani všeček' })).toBeInTheDocument()
  })

  it('показывает счётчик лайков', () => {
    render(<PostDetail post={makePost({ likes: 7 })} />)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  // --- Auth check ---

  it('аноним (currentUserId=null): клик лайка не вызывает RPC', async () => {
    const user = userEvent.setup()
    render(<PostDetail post={makePost({ is_liked: false })} currentUserId={null} />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('аноним (currentUserId=null): счётчик не меняется при клике', async () => {
    const user = userEvent.setup()
    render(<PostDetail post={makePost({ likes: 5, is_liked: false })} currentUserId={null} />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('аноним (currentUserId=null): показывает toast.info при клике лайка', async () => {
    const user = userEvent.setup()
    render(<PostDetail post={makePost({ is_liked: false })} currentUserId={null} />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))
    expect(mockToastInfo).toHaveBeenCalledWith('Za všečkanje se morate prijaviti')
  })

  // --- Оптимистичные обновления (auth required) ---

  it('оптимистичное обновление: счётчик увеличивается при клике', async () => {
    mockRpc.mockResolvedValue({ data: { is_liked: true, likes_count: 6 }, error: null })
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ likes: 5, is_liked: false })} currentUserId="user-1" />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))

    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('оптимистичное обновление: счётчик уменьшается при unlike', async () => {
    mockRpc.mockResolvedValue({ data: { is_liked: false, likes_count: 4 }, error: null })
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ likes: 5, is_liked: true })} currentUserId="user-1" />)
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

    render(<PostDetail post={makePost({ likes: 5, is_liked: false })} currentUserId="user-1" />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))

    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Všečkaj' })).toBeInTheDocument()
  })

  it('показывает toast при ошибке RPC лайка (уведомление пользователя)', async () => {
    mockRpc.mockRejectedValue(new Error('RPC failed'))
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ likes: 5, is_liked: false })} currentUserId="user-1" />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Napaka pri všečkanju'))
  })

  it('синхронизирует состояние с ответом сервера (source of truth)', async () => {
    mockRpc.mockResolvedValue({ data: { is_liked: true, likes_count: 8 }, error: null })
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ likes: 5, is_liked: false })} currentUserId="user-1" />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))

    await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument())
  })

  // --- Store sync ---

  it('оптимистично обновляет Zustand store ДО RPC-ответа', async () => {
    // RPC зависнет — разрешим вручную
    let resolveRpc!: (v: unknown) => void
    mockRpc.mockReturnValue(new Promise((r) => { resolveRpc = r }))
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ id: 'post-1', likes: 5 })} currentUserId="user-1" />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))

    // Store обновлён оптимистично ДО завершения RPC
    expect(mockUpdatePost).toHaveBeenCalledWith('post-1', { likes_count: 6, is_liked: true })

    // Завершаем RPC — store синхронизируется с сервером
    resolveRpc({ data: { is_liked: true, likes_count: 6 }, error: null })
    await waitFor(() =>
      expect(mockUpdatePost).toHaveBeenCalledTimes(2)
    )
  })

  it('после успешного лайка синхронизирует store с ответом сервера', async () => {
    mockRpc.mockResolvedValue({ data: { is_liked: true, likes_count: 8 }, error: null })
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ id: 'post-1', likes: 5 })} currentUserId="user-1" />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))

    await waitFor(() =>
      expect(mockUpdatePost).toHaveBeenCalledWith('post-1', { likes_count: 8, is_liked: true })
    )
  })

  it('rollback при ошибке: store откатывается к исходному состоянию', async () => {
    mockRpc.mockRejectedValue(new Error('RPC failed'))
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ id: 'post-1', likes: 5, is_liked: false })} currentUserId="user-1" />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))

    // Сначала оптимистичный вызов
    expect(mockUpdatePost).toHaveBeenCalledWith('post-1', { likes_count: 6, is_liked: true })

    // После ошибки — откат
    await waitFor(() =>
      expect(mockUpdatePost).toHaveBeenCalledWith('post-1', { likes_count: 5, is_liked: false })
    )
  })

  // --- Счётчик комментариев ---

  it('показывает счётчик комментариев', () => {
    render(<PostDetail post={makePost({ comments: 12 })} />)
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  // --- Дата: formattedDate prop (Fix #3 — нет layout shift) ---

  it('дата: formattedDate из RSC рендерится синхронно (нет useEffect, нет layout shift)', () => {
    render(<PostDetail post={makePost()} formattedDate="15. marca 2026" />)
    // Синхронный рендер — без waitFor
    expect(screen.getByText('15. marca 2026')).toBeInTheDocument()
  })

  it('дата: fallback через toLocaleDateString если formattedDate не передан', () => {
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('15. marca 2026')
    render(<PostDetail post={makePost({ created_at: '2026-03-15T12:00:00Z' })} />)
    expect(screen.getByText('15. marca 2026')).toBeInTheDocument()
  })

  // --- Аватар автора ---

  it('показывает img аватара если author.avatar_url задан', () => {
    render(
      <PostDetail
        post={makePost({ author: { name: 'Ana Ivanova', initials: 'AI', avatar_url: 'https://example.com/avatar.jpg' } })}
      />
    )
    const img = screen.getByRole('img', { name: 'Ana Ivanova' })
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg')
  })

  it('показывает инициалы если author.avatar_url не задан', () => {
    render(<PostDetail post={makePost({ author: { name: 'Ana Ivanova', initials: 'AI' } })} />)
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Ana Ivanova' })).not.toBeInTheDocument()
  })

  it('показывает инициалы если author.avatar_url=null', () => {
    render(
      <PostDetail
        post={makePost({ author: { name: 'Ana Ivanova', initials: 'AI', avatar_url: null } })}
      />
    )
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  // --- Семантика даты: <time dateTime> ---

  it('рендерит дату в элементе <time> с атрибутом dateTime (семантика a11y)', () => {
    render(
      <PostDetail
        post={makePost({ created_at: '2026-03-15T12:00:00Z' })}
        formattedDate="15. marca 2026"
      />
    )
    const timeEl = screen.getByText('15. marca 2026').closest('time')
    expect(timeEl).toBeInTheDocument()
    expect(timeEl).toHaveAttribute('dateTime', '2026-03-15T12:00:00Z')
  })

  // --- Auth check при ошибке RPC лайка ---

  it('при ошибке RPC: если сессия истекла (getUser=null) — показывает toast о просроченной сессии', async () => {
    mockRpc.mockRejectedValue(new Error('JWT expired'))
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ likes: 5, is_liked: false })} currentUserId="user-1" />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('Vaša seja je potekla. Prijavite se znova.')
    )
  })

  it('при ошибке RPC: если сессия активна (getUser=user) — показывает общий toast ошибки', async () => {
    mockRpc.mockRejectedValue(new Error('Network error'))
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ likes: 5, is_liked: false })} currentUserId="user-1" />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('Napaka pri všečkanju')
    )
  })
})
