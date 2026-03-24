import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

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
  VideoPlayerContainer: ({ videoId, src }: { videoId?: string; src?: string }) => (
    <div data-testid="video-player" data-video-id={videoId} data-src={src} />
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

  it('VideoPlayer не обёрнут в <a>-ссылку (невалидный HTML)', () => {
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

  it('в смешанной галерее изображения остаются кликабельными ссылками на пост', () => {
    render(
      <PostCard
        post={makeCardData({ id: 'post-mixed-1', type: 'gallery', media: makeGalleryWithVideo() })}
      />
    )

    const links = screen.getAllByRole('link')
    expect(links.some((link) => link.getAttribute('href') === '/feed/post-mixed-1')).toBe(true)
  })

  it('в смешанной галерее видео не оборачивается в ссылку', () => {
    const { container } = render(
      <PostCard
        post={makeCardData({ id: 'post-mixed-2', type: 'gallery', media: makeGalleryWithVideo() })}
      />
    )

    const videoPlayer = container.querySelector('[data-testid="video-player"]')
    expect(videoPlayer?.closest('a')).toBeNull()
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

describe('PostCardSkeleton', () => {
  it('по умолчанию не рендерит media placeholder для text-карточек', () => {
    render(<PostCardSkeleton />)

    expect(screen.queryByTestId('post-card-skeleton-media')).not.toBeInTheDocument()
  })

  it('рендерит media placeholder только при явном showMedia=true', () => {
    render(<PostCardSkeleton showMedia />)

    expect(screen.getByTestId('post-card-skeleton-media')).toBeInTheDocument()
  })

  it('media placeholder использует aspect-[4/5] для фото по умолчанию (CLS fix)', () => {
    render(<PostCardSkeleton showMedia />)
    const media = screen.getByTestId('post-card-skeleton-media')
    expect(media.className).toContain('aspect-[4/5]')
  })

  it('media placeholder использует aspect-video для типа video (CLS fix)', () => {
    render(<PostCardSkeleton showMedia mediaType="video" />)
    const media = screen.getByTestId('post-card-skeleton-media')
    expect(media.className).toContain('aspect-video')
  })
})
