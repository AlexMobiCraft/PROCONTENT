import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockRouterPush = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}))

vi.mock('@/components/media/LazyMediaWrapper', () => ({
  LazyMediaWrapper: ({
    priority,
    mediaItem,
  }: {
    priority?: boolean
    mediaItem?: { url: string }
  }) => (
    <div
      data-testid="lazy-media"
      data-priority={String(priority ?? false)}
      data-media-url={mediaItem?.url ?? ''}
    />
  ),
}))

vi.mock('@/features/feed/components/VideoPlayerContainer', () => ({
  VideoPlayerContainer: ({ videoId, src, aspectRatio }: { videoId?: string; src?: string; aspectRatio?: string }) => (
    <div data-testid="video-player" data-video-id={videoId} data-src={src} data-aspect-ratio={aspectRatio} />
  ),
}))

vi.mock('@/components/feed/GalleryGrid', () => ({
  GalleryGrid: ({ media, itemLinkHref }: { media: unknown[]; itemLinkHref?: string }) => (
    <div data-testid="gallery-grid" data-count={media.length} data-item-link-href={itemLinkHref ?? ''} />
  ),
  GalleryGridSkeleton: ({ count }: { count?: number }) => (
    <div data-testid="gallery-grid-skeleton" data-count={count ?? 0} />
  ),
}))

import { PostCard, PostCardSkeleton } from '@/components/feed/PostCard'
import type { PostCardData } from '@/components/feed/PostCard'

function makeCardData(overrides?: Partial<PostCardData>): PostCardData {
  return {
    id: '1',
    category: 'insight',
    title: 'Test post',
    excerpt: 'Description',
    date: '01.01.2026',
    likes: 0,
    comments: 0,
    author: { name: 'Avtorica', initials: 'A' },
    imageUrl: 'https://example.com/img.jpg',
    type: 'photo',
    ...overrides,
  }
}

describe('PostCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('likeCount обновляется при изменении prop post.likes (derived state sync)', () => {
    const { rerender } = render(<PostCard post={makeCardData({ likes: 5 })} />)
    expect(screen.getByText('5')).toBeInTheDocument()

    rerender(<PostCard post={makeCardData({ likes: 10 })} />)

    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.queryByText('5')).not.toBeInTheDocument()
  })

  it('передаёт priority=true в LazyMediaWrapper если задан (LCP)', () => {
    render(<PostCard post={makeCardData()} priority />)
    expect(screen.getByTestId('lazy-media')).toHaveAttribute('data-priority', 'true')
  })

  it('передаёт priority=false в LazyMediaWrapper по умолчанию', () => {
    render(<PostCard post={makeCardData()} />)
    expect(screen.getByTestId('lazy-media')).toHaveAttribute('data-priority', 'false')
  })

  it('не рендерит LazyMediaWrapper если imageUrl отсутствует', () => {
    render(<PostCard post={makeCardData({ imageUrl: undefined })} />)
    expect(screen.queryByTestId('lazy-media')).not.toBeInTheDocument()
  })

  it('кнопка лайка имеет aria-label без дублирования счётчика (a11y)', () => {
    render(<PostCard post={makeCardData({ likes: 7 })} />)
    // aria-label содержит только действие — счётчик рендерится в <span> и не дублируется AT
    expect(screen.getByRole('button', { name: 'Všečkaj' })).toBeInTheDocument()
  })

  it('вызывает onLikeToggle с postId при клике (нет локального state)', async () => {
    const onLikeToggle = vi.fn()
    const user = userEvent.setup()
    render(<PostCard post={makeCardData({ id: 'p1', likes: 3 })} onLikeToggle={onLikeToggle} />)

    await user.click(screen.getByRole('button', { name: 'Všečkaj' }))

    expect(onLikeToggle).toHaveBeenCalledOnce()
    expect(onLikeToggle).toHaveBeenCalledWith('p1')
  })

  it('кнопка лайка получает disabled=true при isPending для полноценной a11y-блокировки', () => {
    render(<PostCard post={makeCardData()} isPending />)
    expect(screen.getByRole('button', { name: 'Všečkaj' })).toBeDisabled()
  })

  it('вызывает onLikeToggle с postId при клике на уже лайкнутый пост (unlike)', async () => {
    const onLikeToggle = vi.fn()
    const user = userEvent.setup()
    // isLiked=true — FeedContainer передаёт актуальное состояние через props
    render(<PostCard post={makeCardData({ id: 'p1', isLiked: true })} onLikeToggle={onLikeToggle} />)

    await user.click(screen.getByRole('button', { name: 'Odstrani všeček' }))

    expect(onLikeToggle).toHaveBeenCalledOnce()
    expect(onLikeToggle).toHaveBeenCalledWith('p1')
  })

  it('не падает если onLikeToggle не передан (опциональный проп)', async () => {
    const user = userEvent.setup()
    render(<PostCard post={makeCardData()} />)

    // Клик без onLikeToggle — не должно быть ошибок
    await expect(
      user.click(screen.getByRole('button', { name: 'Všečkaj' }))
    ).resolves.not.toThrow()
  })

  it('liked инициализируется из post.isLiked=true (начальное состояние от сервера)', () => {
    render(<PostCard post={makeCardData({ isLiked: true, likes: 5 })} />)
    // При isLiked=true кнопка должна быть в состоянии "лайкнуто"
    expect(screen.getByRole('button', { name: 'Odstrani všeček' })).toBeInTheDocument()
  })

  it('liked инициализируется как false если post.isLiked не передан', () => {
    render(<PostCard post={makeCardData({ likes: 3 })} />)
    expect(screen.getByRole('button', { name: 'Všečkaj' })).toBeInTheDocument()
  })

  it('likeCount = post.likes напрямую: нет двойного подсчёта при обновлении сервера', () => {
    // PostCard не управляет оптимистичным состоянием — FeedContainer делает это через props.
    // Начало: 5 лайков, пользователь не лайкал
    const { rerender } = render(<PostCard post={makeCardData({ likes: 5, isLiked: false })} />)
    expect(screen.getByText('5')).toBeInTheDocument()

    // Сервер подтверждает: likes=6, isLiked=true — показывается 6, не 7
    rerender(<PostCard post={makeCardData({ likes: 6, isLiked: true })} />)
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.queryByText('7')).not.toBeInTheDocument()
  })

  it('кнопка комментариев имеет aria-label без счётчика (a11y, нет дублирования)', () => {
    render(<PostCard post={makeCardData({ comments: 12 })} />)
    // aria-label только "Komentarji" — счётчик рендерится в <span>, AT не читает дважды
    expect(screen.getByRole('button', { name: 'Komentarji' })).toBeInTheDocument()
  })

  it('вызывает onOptionsClick с postId при клике на кнопку опций', async () => {
    const onOptionsClick = vi.fn()
    const user = userEvent.setup()
    render(<PostCard post={makeCardData({ id: 'post-42' })} onOptionsClick={onOptionsClick} />)

    await user.click(screen.getByRole('button', { name: 'Možnosti objave' }))

    expect(onOptionsClick).toHaveBeenCalledOnce()
    expect(onOptionsClick).toHaveBeenCalledWith('post-42')
  })

  describe('mediaItem prop (Task 6.4 AC 6)', () => {
    const makeMediaItem = () => ({
      id: 'media-1',
      post_id: 'post-1',
      media_type: 'image' as const,
      url: 'https://example.com/photo.jpg',
      thumbnail_url: null,
      order_index: 0,
      is_cover: true,
    })

    it('рендерит LazyMediaWrapper когда передан mediaItem (без imageUrl)', () => {
      render(<PostCard post={makeCardData({ imageUrl: undefined, mediaItem: makeMediaItem() })} />)
      expect(screen.getByTestId('lazy-media')).toBeInTheDocument()
    })

    it('передаёт mediaItem.url в LazyMediaWrapper', () => {
      render(<PostCard post={makeCardData({ mediaItem: makeMediaItem() })} />)
      expect(screen.getByTestId('lazy-media')).toHaveAttribute(
        'data-media-url',
        'https://example.com/photo.jpg'
      )
    })

    it('не рендерит LazyMediaWrapper если нет ни imageUrl ни mediaItem', () => {
      render(<PostCard post={makeCardData({ imageUrl: undefined, mediaItem: undefined })} />)
      expect(screen.queryByTestId('lazy-media')).not.toBeInTheDocument()
    })
  })
})

describe('PostCard — одиночное видео с mediaItem [AI-Review High]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const makeVideoMediaItem = () => ({
    url: 'https://example.com/v.mp4',
    media_type: 'video' as const,
    thumbnail_url: 'https://example.com/thumb.jpg',
  })

  it('рендерит VideoPlayer вместо LazyMediaWrapper для type=video + mediaItem', () => {
    render(
      <PostCard
        post={makeCardData({
          type: 'video',
          mediaItem: makeVideoMediaItem(),
          imageUrl: undefined,
        })}
      />
    )
    expect(screen.queryByTestId('lazy-media')).not.toBeInTheDocument()
    expect(screen.getByTestId('video-player')).toBeInTheDocument()
  })

  it('VideoPlayer не обёрнут в <a>-ссылку', () => {
    const { container } = render(
      <PostCard
        post={makeCardData({
          type: 'video',
          mediaItem: makeVideoMediaItem(),
          imageUrl: undefined,
        })}
      />
    )
    const videoPlayer = container.querySelector('[data-testid="video-player"]')!
    expect(videoPlayer.closest('a')).toBeNull()
  })

  it('клик по контейнеру одиночного видео навигирует к посту с ?from=feed (кликабельность AC)', async () => {
    const user = userEvent.setup()
    render(
      <PostCard
        post={makeCardData({
          id: 'post-vid-nav',
          type: 'video',
          mediaItem: makeVideoMediaItem(),
          imageUrl: undefined,
        })}
      />
    )
    await user.click(screen.getByTestId('video-card-container'))
    expect(mockRouterPush).toHaveBeenCalledWith('/feed/post-vid-nav?from=feed')
  })

  it('video-card-container имеет role="button" и tabIndex=0 (a11y Fix #2)', () => {
    render(
      <PostCard
        post={makeCardData({
          type: 'video',
          mediaItem: makeVideoMediaItem(),
          imageUrl: undefined,
        })}
      />
    )
    const container = screen.getByTestId('video-card-container')
    expect(container).toHaveAttribute('role', 'button')
    expect(container).toHaveAttribute('tabindex', '0')
  })

  it('video-card-container имеет aria-label с названием поста (a11y Fix #2)', () => {
    render(
      <PostCard
        post={makeCardData({
          title: 'Moj video',
          type: 'video',
          mediaItem: makeVideoMediaItem(),
          imageUrl: undefined,
        })}
      />
    )
    expect(screen.getByTestId('video-card-container')).toHaveAttribute('aria-label', 'Poglej objavo: Moj video')
  })

  it('Enter на video-card-container навигирует к посту (keyboard a11y Fix #2)', async () => {
    const user = userEvent.setup()
    render(
      <PostCard
        post={makeCardData({
          id: 'post-key-nav',
          type: 'video',
          mediaItem: makeVideoMediaItem(),
          imageUrl: undefined,
        })}
      />
    )
    screen.getByTestId('video-card-container').focus()
    await user.keyboard('{Enter}')
    expect(mockRouterPush).toHaveBeenCalledWith('/feed/post-key-nav?from=feed')
  })

  it('клик по кнопке внутри video-card-container не вызывает навигацию (stopPropagation Fix #2)', () => {
    render(
      <PostCard
        post={makeCardData({
          id: 'post-vid-btn',
          type: 'video',
          mediaItem: makeVideoMediaItem(),
          imageUrl: undefined,
        })}
      />
    )
    // Создаём кнопку внутри контейнера для имитации контролов плеера
    const videoContainer = screen.getByTestId('video-card-container')
    const innerBtn = document.createElement('button')
    innerBtn.textContent = 'Play'
    videoContainer.appendChild(innerBtn)
    // fireEvent.click сохраняет корректный e.target при bubbling — userEvent может отклоняться
    fireEvent.click(innerBtn)
    expect(mockRouterPush).not.toHaveBeenCalled()
  })

  it('использует fallback-video-${post.id} как videoId когда нет media[] (без коллизий с UUID медиафайлов)', () => {
    render(
      <PostCard
        post={makeCardData({
          id: 'post-vid-1',
          type: 'video',
          mediaItem: makeVideoMediaItem(),
        })}
      />
    )
    expect(screen.getByTestId('video-player')).toHaveAttribute('data-video-id', 'fallback-video-post-vid-1')
  })

  it('использует media[0].id как videoId когда media[] присутствует (согласованность с GalleryGrid)', () => {
    render(
      <PostCard
        post={makeCardData({
          id: 'post-vid-1',
          type: 'video',
          mediaItem: makeVideoMediaItem(),
          media: [
            {
              id: 'media-item-1',
              post_id: 'post-vid-1',
              media_type: 'video' as const,
              url: 'https://example.com/v.mp4',
              thumbnail_url: null,
              order_index: 0,
              is_cover: true,
            },
          ],
        })}
      />
    )
    expect(screen.getByTestId('video-player')).toHaveAttribute('data-video-id', 'media-item-1')
  })

  it('использует mediaItem.id как приоритетный videoId (priority over media[0].id) [AI-Review Round 14]', () => {
    render(
      <PostCard
        post={makeCardData({
          id: 'post-vid-1',
          type: 'video',
          mediaItem: { id: 'mediaitem-id-123', url: 'https://example.com/v.mp4', media_type: 'video', thumbnail_url: null },
          media: [
            {
              id: 'media-item-1',
              post_id: 'post-vid-1',
              media_type: 'video' as const,
              url: 'https://example.com/v.mp4',
              thumbnail_url: null,
              order_index: 0,
              is_cover: true,
            },
          ],
        })}
      />
    )
    expect(screen.getByTestId('video-player')).toHaveAttribute('data-video-id', 'mediaitem-id-123')
  })
})

describe('PostCard — одиночное видео без mediaItem, только media[0] [AI-Review High Logic]', () => {
  const makeVideoMedia = () => [
    {
      id: 'v1',
      post_id: 'p1',
      media_type: 'video' as const,
      url: 'https://example.com/v.mp4',
      thumbnail_url: 'https://example.com/thumb.jpg',
      order_index: 0,
      is_cover: true,
    },
  ]

  it('рендерит VideoPlayer если type=video и есть только media[0] (без mediaItem)', () => {
    render(
      <PostCard
        post={makeCardData({
          type: 'video',
          mediaItem: undefined,
          imageUrl: undefined,
          media: makeVideoMedia(),
        })}
      />
    )
    expect(screen.getByTestId('video-player')).toBeInTheDocument()
  })

  it('использует media[0].url как src когда mediaItem отсутствует', () => {
    render(
      <PostCard
        post={makeCardData({
          type: 'video',
          mediaItem: undefined,
          imageUrl: undefined,
          media: makeVideoMedia(),
        })}
      />
    )
    expect(screen.getByTestId('video-player')).toHaveAttribute(
      'data-src',
      'https://example.com/v.mp4'
    )
  })

  it('type=video использует aspectRatio="16/9" для горизонтального видео', () => {
    render(
      <PostCard
        post={makeCardData({
          type: 'video',
          mediaItem: undefined,
          imageUrl: undefined,
          media: makeVideoMedia(),
        })}
      />
    )
    expect(screen.getByTestId('video-player')).toHaveAttribute('data-aspect-ratio', '16/9')
  })
})

describe('PostCard — type=multi-video с одним media[0] [AI-Review High Logic]', () => {
  const makeSingleVideoMedia = () => [
    {
      id: 'v1',
      post_id: 'p1',
      media_type: 'video' as const,
      url: 'https://example.com/v.mp4',
      thumbnail_url: null,
      order_index: 0,
      is_cover: true,
    },
  ]

  it('рендерит VideoPlayerContainer для type=multi-video с одним media элементом', () => {
    render(
      <PostCard
        post={makeCardData({
          type: 'multi-video',
          mediaItem: undefined,
          imageUrl: undefined,
          media: makeSingleVideoMedia(),
        })}
      />
    )
    expect(screen.getByTestId('video-player')).toBeInTheDocument()
  })

  it('не рендерит LazyMediaWrapper для type=multi-video + media[0] с video url', () => {
    render(
      <PostCard
        post={makeCardData({
          type: 'multi-video',
          mediaItem: undefined,
          imageUrl: undefined,
          media: makeSingleVideoMedia(),
        })}
      />
    )
    expect(screen.queryByTestId('lazy-media')).not.toBeInTheDocument()
  })

  it('type=multi-video использует aspectRatio="4/5" для поддержки вертикальных видео', () => {
    render(
      <PostCard
        post={makeCardData({
          type: 'multi-video',
          mediaItem: undefined,
          imageUrl: undefined,
          media: makeSingleVideoMedia(),
        })}
      />
    )
    expect(screen.getByTestId('video-player')).toHaveAttribute('data-aspect-ratio', '4/5')
  })
})

describe('PostCard — галерея с видео [AI-Review High]', () => {
  const makeGalleryWithVideo = () => [
    { id: 'm1', post_id: 'p1', media_type: 'image' as const, url: 'https://example.com/i.jpg', thumbnail_url: null, order_index: 0, is_cover: true },
    { id: 'v1', post_id: 'p1', media_type: 'video' as const, url: 'https://example.com/v.mp4', thumbnail_url: null, order_index: 1, is_cover: false },
  ]
  const makeGalleryImagesOnly = () => [
    { id: 'm1', post_id: 'p1', media_type: 'image' as const, url: 'https://example.com/i1.jpg', thumbnail_url: null, order_index: 0, is_cover: true },
    { id: 'm2', post_id: 'p1', media_type: 'image' as const, url: 'https://example.com/i2.jpg', thumbnail_url: null, order_index: 1, is_cover: false },
  ]

  it('галерея с видео не обёрнута в <a>-ссылку', () => {
    const { container } = render(
      <PostCard
        post={makeCardData({ type: 'gallery', media: makeGalleryWithVideo() })}
      />
    )
    const galleryGrid = container.querySelector('[data-testid="gallery-grid"]')
    expect(galleryGrid?.closest('a')).toBeNull()
  })

  it('в смешанной галерее изображения остаются кликабельными ссылками на пост (с ?from=feed)', () => {
    render(
      <PostCard
        post={makeCardData({ id: 'post-mixed-1', type: 'gallery', media: makeGalleryWithVideo() })}
      />
    )

    const links = screen.getAllByRole('link')
    expect(links.some((link) => link.getAttribute('href') === '/feed/post-mixed-1?from=feed')).toBe(true)
  })

  it('в смешанной галерее GalleryGrid не оборачивается в ссылку (видео внутри)', () => {
    const { container } = render(
      <PostCard
        post={makeCardData({ id: 'post-mixed-2', type: 'gallery', media: makeGalleryWithVideo() })}
      />
    )

    // GalleryGrid (содержащий видео) не должен быть внутри <a> — иначе <video controls> внутри ссылки невалиден
    const galleryGrid = container.querySelector('[data-testid="gallery-grid"]')
    expect(galleryGrid?.closest('a')).toBeNull()
  })

  it('галерея только из изображений обёрнута в <a>-ссылку (навигация сохраняется)', () => {
    const { container } = render(
      <PostCard
        post={makeCardData({ type: 'gallery', media: makeGalleryImagesOnly() })}
      />
    )
    const galleryGrid = container.querySelector('[data-testid="gallery-grid"]')
    expect(galleryGrid?.closest('a')).not.toBeNull()
  })
})

describe('PostCard — аватар автора', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('показывает img аватара если author.avatar_url задан', () => {
    render(
      <PostCard
        post={makeCardData({ author: { name: 'Ana', initials: 'A', avatar_url: 'https://example.com/avatar.jpg' } })}
      />
    )
    const img = screen.getByRole('img', { name: 'Ana' })
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg')
  })

  it('показывает инициалы если author.avatar_url не задан', () => {
    render(<PostCard post={makeCardData({ author: { name: 'Ana', initials: 'AV' } })} />)
    expect(screen.getByText('AV')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Ana' })).not.toBeInTheDocument()
  })

  it('показывает инициалы если author.avatar_url=null', () => {
    render(
      <PostCard post={makeCardData({ author: { name: 'Ana', initials: 'AV', avatar_url: null } })} />
    )
    expect(screen.getByText('AV')).toBeInTheDocument()
  })
})

describe('PostCard — семантика даты <time dateTime>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('рендерит дату в элементе <time> с атрибутом dateTime (a11y)', () => {
    render(
      <PostCard
        post={makeCardData({ date: '1. jan. 2026', created_at: '2026-01-01T00:00:00Z' })}
      />
    )
    const timeEl = screen.getByText('1. jan. 2026').closest('time')
    expect(timeEl).toBeInTheDocument()
    expect(timeEl).toHaveAttribute('dateTime', '2026-01-01T00:00:00Z')
  })

  it('рендерит <time> без dateTime если created_at не передан', () => {
    render(<PostCard post={makeCardData({ date: '01.01.2026' })} />)
    const timeEl = screen.getByText('01.01.2026').closest('time')
    expect(timeEl).toBeInTheDocument()
  })
})

describe('PostCardSkeleton', () => {
  it('по умолчанию не рендерит media placeholder для text-карточек', () => {
    render(<PostCardSkeleton />)

    expect(screen.queryByTestId('post-card-skeleton-media')).not.toBeInTheDocument()
  })

  it('рендерит media placeholder только при явном showMedia=true', () => {
    render(<PostCardSkeleton showMedia />)

    expect(screen.getByTestId('post-card-skeleton-media')).toBeInTheDocument()
  })

  it('media placeholder использует h-72 для фото по умолчанию (CLS fix)', () => {
    render(<PostCardSkeleton showMedia />)
    const media = screen.getByTestId('post-card-skeleton-media')
    expect(media.className).toContain('h-72')
  })

  it('media placeholder использует aspect-video для типа video (CLS fix)', () => {
    render(<PostCardSkeleton showMedia mediaType="video" />)
    const media = screen.getByTestId('post-card-skeleton-media')
    expect(media.className).toContain('aspect-video')
  })
})
