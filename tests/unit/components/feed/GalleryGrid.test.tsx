import { createElement } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { GalleryGrid, getGridLayout } from '@/components/feed/GalleryGrid'
import type { PostMedia } from '@/features/feed/types'

vi.mock('@/features/feed/components/VideoPlayerContainer', () => ({
  VideoPlayerContainer: ({
    alt,
    src,
    videoId,
    aspectRatio,
    priority,
  }: {
    alt?: string
    src?: string
    videoId?: string
    aspectRatio?: string
    priority?: boolean
  }) => (
    <video
      src={src}
      aria-label={alt}
      data-testid="video-player"
      data-video-id={videoId}
      data-aspect-ratio={aspectRatio}
      data-priority={String(priority ?? false)}
    />
  ),
}))

vi.mock('@/components/media/LazyMediaWrapper', () => ({
  LazyMediaWrapper: ({
    alt,
    mediaItem,
    aspectRatio,
    sizes,
  }: {
    alt: string
    mediaItem?: { url: string }
    aspectRatio?: string
    sizes?: string
  }) =>
    createElement('img', {
      src: mediaItem?.url ?? '',
      alt,
      'data-testid': 'lazy-media',
      'data-aspect-ratio': aspectRatio,
      'data-sizes': sizes,
    }),
}))

function makeMedia(count: number): PostMedia[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `media-${i}`,
    post_id: 'post-1',
    media_type: 'image' as const,
    url: `https://example.com/image-${i}.jpg`,
    thumbnail_url: null,
    order_index: i,
    is_cover: i === 0,
  }))
}

describe('getGridLayout', () => {
  it('2 элемента → grid-2', () => {
    expect(getGridLayout(2)).toEqual({ layout: 'grid-2', mainCount: 2, carouselCount: 0 })
  })

  it('3 элемента → grid-2', () => {
    expect(getGridLayout(3)).toEqual({ layout: 'grid-2', mainCount: 3, carouselCount: 0 })
  })

  it('4 элемента → grid-2', () => {
    expect(getGridLayout(4)).toEqual({ layout: 'grid-2', mainCount: 4, carouselCount: 0 })
  })

  it('5 элементов → grid-2x3', () => {
    expect(getGridLayout(5)).toEqual({ layout: 'grid-2x3', mainCount: 5, carouselCount: 0 })
  })

  it('6 элементов → grid-3x3', () => {
    expect(getGridLayout(6)).toEqual({ layout: 'grid-3x3', mainCount: 6, carouselCount: 0 })
  })

  it('7 элементов → grid-2x2-carousel (4 + 3)', () => {
    expect(getGridLayout(7)).toEqual({ layout: 'grid-2x2-carousel', mainCount: 4, carouselCount: 3 })
  })

  it('8 элементов → grid-2x2-carousel (4 + 4)', () => {
    expect(getGridLayout(8)).toEqual({ layout: 'grid-2x2-carousel', mainCount: 4, carouselCount: 4 })
  })

  it('9 элементов → grid-2x2-carousel (4 + 5)', () => {
    expect(getGridLayout(9)).toEqual({ layout: 'grid-2x2-carousel', mainCount: 4, carouselCount: 5 })
  })

  it('10 элементов → grid-2x2-carousel (4 + 6)', () => {
    expect(getGridLayout(10)).toEqual({ layout: 'grid-2x2-carousel', mainCount: 4, carouselCount: 6 })
  })
})

describe('GalleryGrid — рендер по количеству элементов', () => {
  it('2 элемента: рендерит 2 изображения', () => {
    render(<GalleryGrid media={makeMedia(2)} />)
    expect(screen.getAllByTestId('lazy-media')).toHaveLength(2)
    expect(screen.queryByTestId('gallery-carousel')).toBeNull()
  })

  it('3 элемента: рендерит 3 изображения', () => {
    render(<GalleryGrid media={makeMedia(3)} />)
    expect(screen.getAllByTestId('lazy-media')).toHaveLength(3)
    expect(screen.queryByTestId('gallery-carousel')).toBeNull()
  })

  it('4 элемента: рендерит 4 изображения', () => {
    render(<GalleryGrid media={makeMedia(4)} />)
    expect(screen.getAllByTestId('lazy-media')).toHaveLength(4)
    expect(screen.queryByTestId('gallery-carousel')).toBeNull()
  })

  it('5 элементов: рендерит 5 изображений, нет карусели', () => {
    render(<GalleryGrid media={makeMedia(5)} />)
    expect(screen.getAllByTestId('lazy-media')).toHaveLength(5)
    expect(screen.queryByTestId('gallery-carousel')).toBeNull()
  })

  it('6 элементов: рендерит 6 изображений, нет карусели', () => {
    render(<GalleryGrid media={makeMedia(6)} />)
    expect(screen.getAllByTestId('lazy-media')).toHaveLength(6)
    expect(screen.queryByTestId('gallery-carousel')).toBeNull()
  })

  it('7 элементов: 4 в сетке + 3 в карусели', () => {
    render(<GalleryGrid media={makeMedia(7)} />)
    expect(screen.getAllByTestId('lazy-media')).toHaveLength(7)
    expect(screen.getByTestId('gallery-carousel')).toBeInTheDocument()
  })

  it('8 элементов: 4 в сетке + 4 в карусели', () => {
    render(<GalleryGrid media={makeMedia(8)} />)
    expect(screen.getAllByTestId('lazy-media')).toHaveLength(8)
    expect(screen.getByTestId('gallery-carousel')).toBeInTheDocument()
  })

  it('9 элементов: 4 в сетке + 5 в карусели', () => {
    render(<GalleryGrid media={makeMedia(9)} />)
    expect(screen.getAllByTestId('lazy-media')).toHaveLength(9)
    expect(screen.getByTestId('gallery-carousel')).toBeInTheDocument()
  })

  it('10 элементов: 4 в сетке + 6 в карусели', () => {
    render(<GalleryGrid media={makeMedia(10)} />)
    expect(screen.getAllByTestId('lazy-media')).toHaveLength(10)
    expect(screen.getByTestId('gallery-carousel')).toBeInTheDocument()
  })
})

describe('GalleryGrid — isLoading', () => {
  it('рендерит Skeleton при isLoading=true, медиа не видны', () => {
    render(<GalleryGrid media={makeMedia(4)} isLoading={true} />)
    expect(screen.queryByTestId('lazy-media')).toBeNull()
    expect(screen.queryByTestId('gallery-grid')).toBeNull()
    expect(screen.getByTestId('gallery-grid-skeleton')).toBeInTheDocument()
  })

  it('рендерит медиа при isLoading=false', () => {
    render(<GalleryGrid media={makeMedia(4)} isLoading={false} />)
    expect(screen.getAllByTestId('lazy-media')).toHaveLength(4)
    expect(screen.getByTestId('gallery-grid')).toBeInTheDocument()
  })
})

describe('GalleryGrid — сортировка по order_index', () => {
  it('медиа в перемешанном порядке сортируются корректно', () => {
    const shuffled: PostMedia[] = [
      { id: 'c', post_id: 'p', media_type: 'image', url: 'https://example.com/url-2.jpg', thumbnail_url: null, order_index: 2, is_cover: false },
      { id: 'a', post_id: 'p', media_type: 'image', url: 'https://example.com/url-0.jpg', thumbnail_url: null, order_index: 0, is_cover: true },
      { id: 'b', post_id: 'p', media_type: 'image', url: 'https://example.com/url-1.jpg', thumbnail_url: null, order_index: 1, is_cover: false },
    ]
    render(<GalleryGrid media={shuffled} />)
    const images = screen.getAllByTestId('lazy-media') as HTMLImageElement[]
    expect(images[0].src).toContain('url-0')
    expect(images[1].src).toContain('url-1')
    expect(images[2].src).toContain('url-2')
  })
})

describe('GalleryGrid — onMediaClick', () => {
  it('вызывает onMediaClick с индексом 0 при клике на первый элемент', () => {
    const onMediaClick = vi.fn()
    render(<GalleryGrid media={makeMedia(3)} onMediaClick={onMediaClick} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(onMediaClick).toHaveBeenCalledWith(0)
  })

  it('вызывает onMediaClick с индексом 1 при клике на второй элемент', () => {
    const onMediaClick = vi.fn()
    render(<GalleryGrid media={makeMedia(3)} onMediaClick={onMediaClick} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1])
    expect(onMediaClick).toHaveBeenCalledWith(1)
  })

  it('вызывает onMediaClick с глобальным индексом для элементов карусели', () => {
    const onMediaClick = vi.fn()
    render(<GalleryGrid media={makeMedia(7)} onMediaClick={onMediaClick} />)
    // Кнопки: 4 в сетке + 3 в карусели = 7 кнопок
    const buttons = screen.getAllByRole('button')
    // 5-я кнопка (index 4) = первый элемент карусели → globalIndex = 4
    fireEvent.click(buttons[4])
    expect(onMediaClick).toHaveBeenCalledWith(4)
  })
})

describe('GalleryGrid — interactive=false', () => {
  it('рендерит div-элементы, не кнопки', () => {
    render(<GalleryGrid media={makeMedia(4)} interactive={false} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getAllByTestId('lazy-media')).toHaveLength(4)
  })

  it('карусель: рендерит div-элементы, не кнопки', () => {
    render(<GalleryGrid media={makeMedia(7)} interactive={false} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getAllByTestId('lazy-media')).toHaveLength(7)
    expect(screen.getByTestId('gallery-carousel')).toBeInTheDocument()
  })

  it('non-interactive элементы НЕ имеют aria-hidden — контент виден скринридерам (a11y)', () => {
    const { container } = render(<GalleryGrid media={makeMedia(4)} interactive={false} />)
    const grid = container.querySelector('[data-layout]')!
    for (const child of Array.from(grid.children)) {
      expect(child).not.toHaveAttribute('aria-hidden')
    }
  })

  it('carousel: non-interactive элементы НЕ имеют aria-hidden', () => {
    const { container } = render(<GalleryGrid media={makeMedia(7)} interactive={false} />)
    const carousel = container.querySelector('[data-testid="gallery-carousel"]')!
    for (const child of Array.from(carousel.children)) {
      expect(child).not.toHaveAttribute('aria-hidden')
    }
  })
})

describe('GalleryGrid — mediaLabel / videoLabel (i18n)', () => {
  it('использует кастомные лейблы для изображений', () => {
    render(<GalleryGrid media={makeMedia(2)} mediaLabel="Foto" />)
    expect(screen.getByLabelText('Foto 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Foto 2')).toBeInTheDocument()
  })

  it('использует кастомные лейблы для видео', () => {
    const videoMedia = [
      { id: 'v1', post_id: 'p1', media_type: 'video' as const, url: 'https://example.com/v1.mp4', thumbnail_url: null, order_index: 0, is_cover: true },
      { id: 'v2', post_id: 'p1', media_type: 'video' as const, url: 'https://example.com/v2.mp4', thumbnail_url: null, order_index: 1, is_cover: false },
    ]
    render(<GalleryGrid media={videoMedia} videoLabel="Video" />)
    expect(screen.getByLabelText('Video 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Video 2')).toBeInTheDocument()
  })
})

describe('GalleryGrid — col-span-2 для нечётных сеток', () => {
  it('3 элемента: последний элемент имеет col-span-2', () => {
    const { container } = render(<GalleryGrid media={makeMedia(3)} />)
    const gridChildren = container.querySelector('[data-layout="grid-2"]')!.children
    expect(gridChildren[2].className).toContain('col-span-2')
  })

  it('5 элементов: последний элемент имеет col-span-2', () => {
    const { container } = render(<GalleryGrid media={makeMedia(5)} />)
    const gridChildren = container.querySelector('[data-layout="grid-2x3"]')!.children
    expect(gridChildren[4].className).toContain('col-span-2')
  })
})

describe('GalleryGrid — skeleton carousel', () => {
  it('skeleton для count=7 включает carousel skeleton', () => {
    render(<GalleryGrid media={makeMedia(7)} isLoading={true} />)
    expect(screen.getByTestId('gallery-grid-skeleton')).toBeInTheDocument()
    expect(screen.getByTestId('gallery-skeleton-carousel')).toBeInTheDocument()
  })

  it('skeleton для count=4 НЕ содержит carousel skeleton', () => {
    render(<GalleryGrid media={makeMedia(4)} isLoading={true} />)
    expect(screen.getByTestId('gallery-grid-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('gallery-skeleton-carousel')).toBeNull()
  })

  it('skeleton carousel содержит правильное число элементов (count=8: 4 в сетке + 4 в карусели)', () => {
    const { container } = render(<GalleryGrid media={makeMedia(8)} isLoading={true} />)
    const carouselSkeleton = container.querySelector('[data-testid="gallery-skeleton-carousel"]')!
    expect(carouselSkeleton.children).toHaveLength(4)
  })
})

describe('GalleryGrid — aspectRatio для col-span-2 элементов [HIGH fix]', () => {
  it('3 элемента: первые 2 имеют aspectRatio 1/1, последний (col-span-2) — 16/9', () => {
    render(<GalleryGrid media={makeMedia(3)} />)
    const images = screen.getAllByTestId('lazy-media') as HTMLImageElement[]
    expect(images[0]).toHaveAttribute('data-aspect-ratio', '4/5')
    expect(images[1]).toHaveAttribute('data-aspect-ratio', '4/5')
    expect(images[2]).toHaveAttribute('data-aspect-ratio', '16/9')
  })

  it('5 элементов: первые 4 имеют aspectRatio 1/1, последний (col-span-2) — 16/9', () => {
    render(<GalleryGrid media={makeMedia(5)} />)
    const images = screen.getAllByTestId('lazy-media') as HTMLImageElement[]
    for (let i = 0; i < 4; i++) {
      expect(images[i]).toHaveAttribute('data-aspect-ratio', '4/5')
    }
    expect(images[4]).toHaveAttribute('data-aspect-ratio', '16/9')
  })

  it('4 элемента (нет col-span-2): все имеют aspectRatio 1/1', () => {
    render(<GalleryGrid media={makeMedia(4)} />)
    const images = screen.getAllByTestId('lazy-media') as HTMLImageElement[]
    for (const img of images) {
      expect(img).toHaveAttribute('data-aspect-ratio', '4/5')
    }
  })
})

describe('GalleryGrid — sizes для col-span-2 элементов [MEDIUM fix]', () => {
  it('3 элемента: последний (col-span-2) получает sizes для полной ширины', () => {
    render(<GalleryGrid media={makeMedia(3)} />)
    const images = screen.getAllByTestId('lazy-media') as HTMLImageElement[]
    expect(images[2]).toHaveAttribute('data-sizes', '(max-width: 768px) 100vw, 640px')
  })

  it('3 элемента: первые 2 получают sizes для половины ширины', () => {
    render(<GalleryGrid media={makeMedia(3)} />)
    const images = screen.getAllByTestId('lazy-media') as HTMLImageElement[]
    expect(images[0]).toHaveAttribute('data-sizes', '(max-width: 768px) 50vw, 320px')
    expect(images[1]).toHaveAttribute('data-sizes', '(max-width: 768px) 50vw, 320px')
  })

  it('5 элементов: последний (col-span-2) получает sizes для полной ширины', () => {
    render(<GalleryGrid media={makeMedia(5)} />)
    const images = screen.getAllByTestId('lazy-media') as HTMLImageElement[]
    expect(images[4]).toHaveAttribute('data-sizes', '(max-width: 768px) 100vw, 640px')
  })
})

describe('GalleryGrid — Skeleton count=0 guard [LOW fix]', () => {
  it('GalleryGrid с media=[] и isLoading=true рендерит скелетон для 4 элементов (fallback)', () => {
    render(<GalleryGrid media={[]} isLoading={true} />)
    expect(screen.getByTestId('gallery-grid-skeleton')).toBeInTheDocument()
  })

  it('GalleryGrid с media=[] и isLoading=false рендерит пустую галерею без краша', () => {
    render(<GalleryGrid media={[]} isLoading={false} />)
    expect(screen.getByTestId('gallery-grid')).toBeInTheDocument()
    expect(screen.queryByTestId('lazy-media')).toBeNull()
  })
})

describe('GalleryGrid — priority проброс в VideoPlayer [MEDIUM fix]', () => {
  const makeVideoMedia = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `v-${i}`,
      post_id: 'p1',
      media_type: 'video' as const,
      url: `https://example.com/v-${i}.mp4`,
      thumbnail_url: null,
      order_index: i,
      is_cover: i === 0,
    }))

  it('первые 2 видео получают priority=true при priority=true', () => {
    const { container } = render(<GalleryGrid media={makeVideoMedia(3)} priority={true} />)
    const players = Array.from(
      container.querySelectorAll('[data-testid="video-player"]')
    ) as HTMLElement[]
    expect(players[0]).toHaveAttribute('data-priority', 'true')
    expect(players[1]).toHaveAttribute('data-priority', 'true')
    expect(players[2]).toHaveAttribute('data-priority', 'false')
  })

  it('все видео получают priority=false при priority=false', () => {
    const { container } = render(<GalleryGrid media={makeVideoMedia(2)} priority={false} />)
    const players = Array.from(
      container.querySelectorAll('[data-testid="video-player"]')
    ) as HTMLElement[]
    for (const player of players) {
      expect(player).toHaveAttribute('data-priority', 'false')
    }
  })
})

describe('GalleryGrid — a11y в PostDetail: interactive=true (default) [MEDIUM fix]', () => {
  it('без interactive prop (default=true): элементы рендерятся как кнопки — доступны с клавиатуры', () => {
    render(<GalleryGrid media={makeMedia(4)} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(4)
  })

  it('интерактивные кнопки фокусируемы (не скрыты от a11y)', () => {
    render(<GalleryGrid media={makeMedia(3)} />)
    const buttons = screen.getAllByRole('button')
    for (const btn of buttons) {
      expect(btn).not.toHaveAttribute('aria-hidden')
      expect(btn).not.toHaveAttribute('tabindex', '-1')
    }
  })
})

describe('GalleryGrid — нет интерактивных стилей на wrapper вокруг видео [AI-Review Medium UX]', () => {
  const makeVideoMedia = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `v-${i}`,
      post_id: 'p1',
      media_type: 'video' as const,
      url: `https://example.com/v-${i}.mp4`,
      thumbnail_url: null,
      order_index: i,
      is_cover: i === 0,
    }))

  it('wrapper вокруг видео в основной сетке НЕ имеет hover:opacity-90 (interactive=true)', () => {
    const { container } = render(<GalleryGrid media={makeVideoMedia(2)} interactive={true} />)
    const videoPlayers = container.querySelectorAll('[data-testid="video-player"]')
    for (const player of Array.from(videoPlayers)) {
      expect(player.parentElement?.className).not.toContain('hover:opacity-90')
    }
  })

  it('wrapper вокруг видео в основной сетке НЕ имеет focus-visible:ring-2 (interactive=true)', () => {
    const { container } = render(<GalleryGrid media={makeVideoMedia(2)} interactive={true} />)
    const videoPlayers = container.querySelectorAll('[data-testid="video-player"]')
    for (const player of Array.from(videoPlayers)) {
      expect(player.parentElement?.className).not.toContain('focus-visible:ring-2')
    }
  })

  it('wrapper вокруг видео в карусели НЕ имеет hover:opacity-90 (interactive=true)', () => {
    const { container } = render(<GalleryGrid media={makeVideoMedia(7)} interactive={true} />)
    const carousel = container.querySelector('[data-testid="gallery-carousel"]')!
    const videoPlayers = carousel.querySelectorAll('[data-testid="video-player"]')
    for (const player of Array.from(videoPlayers)) {
      expect(player.parentElement?.className).not.toContain('hover:opacity-90')
    }
  })
})

describe('GalleryGrid — aria-label для видео', () => {
  it('видео элемент получает aria-label "Videoposnetek N"', () => {
    const videoMedia = [
      { id: 'v1', post_id: 'p1', media_type: 'video' as const, url: 'https://example.com/v1.mp4', thumbnail_url: null, order_index: 0, is_cover: true },
      { id: 'v2', post_id: 'p1', media_type: 'video' as const, url: 'https://example.com/v2.mp4', thumbnail_url: null, order_index: 1, is_cover: false },
    ]
    render(<GalleryGrid media={videoMedia} />)
    expect(screen.getByLabelText('Videoposnetek 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Videoposnetek 2')).toBeInTheDocument()
  })

  it('изображение получает aria-label "Slika N"', () => {
    render(<GalleryGrid media={makeMedia(2)} />)
    expect(screen.getByLabelText('Slika 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Slika 2')).toBeInTheDocument()
  })
})

describe('GalleryGrid — itemLinkHref для смешанных галерей [AI-Review High UX]', () => {
  it('оборачивает только изображения в Link, оставляя видео без ссылки', () => {
    const media: PostMedia[] = [
      {
        id: 'img-1',
        post_id: 'p1',
        media_type: 'image',
        url: 'https://example.com/img-1.jpg',
        thumbnail_url: null,
        order_index: 0,
        is_cover: true,
      },
      {
        id: 'vid-1',
        post_id: 'p1',
        media_type: 'video',
        url: 'https://example.com/video-1.mp4',
        thumbnail_url: null,
        order_index: 1,
        is_cover: false,
      },
    ]

    const { container } = render(
      <GalleryGrid media={media} interactive={false} itemLinkHref="/feed/post-1" />
    )

    expect(screen.getByRole('link', { name: 'Slika 1' })).toHaveAttribute('href', '/feed/post-1')
    expect(container.querySelector('[data-testid="video-player"]')?.closest('a')).toBeNull()
  })

  it('Link элементы имеют hover/focus стили даже при interactive=false [AI-Review High A11y]', () => {
    const { container } = render(
      <GalleryGrid media={makeMedia(2)} interactive={false} itemLinkHref="/feed/post-1" />
    )
    const links = container.querySelectorAll('a')
    expect(links.length).toBeGreaterThan(0)
    for (const link of Array.from(links)) {
      expect(link.className).toContain('hover:opacity-90')
      expect(link.className).toContain('focus-visible:ring-2')
    }
  })

  it('carousel: Link элементы имеют hover/focus стили при interactive=false [AI-Review High A11y]', () => {
    const { container } = render(
      <GalleryGrid media={makeMedia(7)} interactive={false} itemLinkHref="/feed/post-1" />
    )
    const carousel = container.querySelector('[data-testid="gallery-carousel"]')!
    const links = carousel.querySelectorAll('a')
    expect(links.length).toBeGreaterThan(0)
    for (const link of Array.from(links)) {
      expect(link.className).toContain('hover:opacity-90')
      expect(link.className).toContain('focus-visible:ring-2')
    }
  })
})
