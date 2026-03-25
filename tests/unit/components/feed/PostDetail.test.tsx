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

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ rpc: mockRpc }),
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
    isLiked: false,
    created_at: '2026-03-15T12:00:00Z',
    author: { name: 'Ana Ivanova', initials: 'AI' },
    ...overrides,
  }
}

describe('PostDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Дефолтно: пользователь пришёл с той же origin (handleBack → router.back())
    Object.defineProperty(document, 'referrer', { get: () => 'http://localhost/feed', configurable: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Сбросить document.referrer до пустого дефолтного значения
    Object.defineProperty(document, 'referrer', { get: () => '', configurable: true })
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

  it('рендерит дату из created_at (клиент-сайд через useEffect)', async () => {
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('15. marca 2026')
    render(<PostDetail post={makePost({ created_at: '2026-03-15T12:00:00Z' })} />)
    await waitFor(() => expect(screen.getByText('15. marca 2026')).toBeInTheDocument())
  })

  it('рендерит категорию', () => {
    render(<PostDetail post={makePost({ category: 'UGC' })} />)
    expect(screen.getByText('UGC')).toBeInTheDocument()
  })

  // --- Кнопка "Назад" ---

  it('кнопка "Назад" вызывает router.back() при same-origin referrer (AC 3 — сохранение скролла)', async () => {
    // beforeEach устанавливает referrer = 'http://localhost/feed' (same origin)
    const user = userEvent.setup()
    render(<PostDetail post={makePost()} />)
    await user.click(screen.getByRole('button', { name: 'Nazaj na objave' }))
    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('кнопка "Назад" не является ссылкой (не сбрасывает скролл)', () => {
    render(<PostDetail post={makePost()} />)
    expect(screen.queryByRole('link', { name: /nazaj/i })).not.toBeInTheDocument()
  })

  it('router.push("/feed") при прямом входе — нет referrer (прямая ссылка / новая вкладка)', async () => {
    Object.defineProperty(document, 'referrer', { get: () => '', configurable: true })
    const user = userEvent.setup()
    render(<PostDetail post={makePost()} />)
    await user.click(screen.getByRole('button', { name: 'Nazaj na objave' }))
    expect(mockBack).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/feed')
  })

  it('router.push("/feed") при переходе с внешнего сайта (referrer другого origin)', async () => {
    // Случай: history.length > 1, но back() уведёт из приложения на внешний сайт
    Object.defineProperty(document, 'referrer', { get: () => 'https://google.com/search?q=procontent', configurable: true })
    const user = userEvent.setup()
    render(<PostDetail post={makePost()} />)
    await user.click(screen.getByRole('button', { name: 'Nazaj na objave' }))
    expect(mockBack).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/feed')
  })

  it('router.back() при same-origin referrer — без fallback (навигация внутри приложения)', async () => {
    Object.defineProperty(document, 'referrer', { get: () => 'http://localhost/feed', configurable: true })
    const user = userEvent.setup()
    render(<PostDetail post={makePost()} />)
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

  it('multi-video с 1 медиа: рендерит VideoPlayerContainer (не null)', () => {
    // Граничный случай: multi-video с media.length < 2 — должен рендерить плеер, а не null
    const post = makePost({
      type: 'multi-video',
      media: [{ id: 'v1', media_type: 'video', url: 'https://example.com/vid.mp4' }] as unknown as PostMedia[],
      mediaItem: { id: 'v1', url: 'https://example.com/vid.mp4', thumbnail_url: null } as unknown as PostMedia,
    })
    render(<PostDetail post={post} />)
    expect(screen.getByTestId('video-player-container')).toBeInTheDocument()
    expect(screen.queryByTestId('gallery-grid')).not.toBeInTheDocument()
  })

  it('gallery с 1 медиа: рендерит LazyMediaWrapper (не null)', () => {
    // Граничный случай: gallery с media.length < 2 — должен рендерить фото, а не null
    const post = makePost({
      type: 'gallery',
      media: [{ id: 'p1', media_type: 'image', url: 'https://example.com/img.jpg' }] as unknown as PostMedia[],
      mediaItem: { id: 'p1', url: 'https://example.com/img.jpg', thumbnail_url: null } as unknown as PostMedia,
    })
    render(<PostDetail post={post} />)
    expect(screen.getByTestId('lazy-media')).toBeInTheDocument()
    expect(screen.queryByTestId('gallery-grid')).not.toBeInTheDocument()
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

  it('аноним (currentUserId=null): показывает toast.info при клике лайка', async () => {
    const user = userEvent.setup()
    render(<PostDetail post={makePost({ isLiked: false })} currentUserId={null} />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))
    expect(mockToastInfo).toHaveBeenCalledWith('Za všečkanje se morate prijaviti')
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

  it('показывает toast при ошибке RPC лайка (уведомление пользователя)', async () => {
    mockRpc.mockRejectedValue(new Error('RPC failed'))
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ likes: 5, isLiked: false })} currentUserId="user-1" />)
    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Napaka pri všečkanju'))
  })

  it('синхронизирует состояние с ответом сервера (source of truth)', async () => {
    mockRpc.mockResolvedValue({ data: { is_liked: true, likes_count: 8 }, error: null })
    const user = userEvent.setup()

    render(<PostDetail post={makePost({ likes: 5, isLiked: false })} currentUserId="user-1" />)
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

    render(<PostDetail post={makePost({ id: 'post-1', likes: 5, isLiked: false })} currentUserId="user-1" />)
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

  // --- Hydration safety (Fix: useEffect + локальный timezone пользователя) ---

  it('дата: toLocaleDateString вызывается без принудительного UTC (локальный timezone пользователя)', async () => {
    const mockToLocaleDateString = vi
      .spyOn(Date.prototype, 'toLocaleDateString')
      .mockReturnValue('15. marca 2026')
    render(<PostDetail post={makePost({ created_at: '2026-03-15T12:00:00Z' })} />)
    await waitFor(() => {
      expect(mockToLocaleDateString).toHaveBeenCalledWith('sl-SI', expect.not.objectContaining({ timeZone: 'UTC' }))
      expect(screen.getByText('15. marca 2026')).toBeInTheDocument()
    })
  })

  it('дата рендерится через useEffect (локальный timezone — нет принудительного UTC)', async () => {
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('15. marca 2026')
    render(<PostDetail post={makePost({ created_at: '2026-03-15T12:00:00Z' })} />)
    // useEffect выполняется асинхронно после гидрации — корректный timezone пользователя
    await waitFor(() => expect(screen.getByText('15. marca 2026')).toBeInTheDocument())
  })
})
