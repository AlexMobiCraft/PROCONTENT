import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSetActiveVideo = vi.hoisted(() => vi.fn())

vi.mock('@/features/feed/store', () => ({
  useFeedStore: {
    getState: () => ({ setActiveVideo: mockSetActiveVideo }),
  },
}))

import { MediaLightbox, type LightboxMedia } from '@/components/media/MediaLightbox'

function makeMedia(count: number, override?: Partial<LightboxMedia>): LightboxMedia[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m-${i}`,
    url: `https://example.com/${i}.jpg`,
    media_type: 'image' as const,
    thumbnail_url: null,
    alt: `Slika ${i + 1}`,
    ...override,
  }))
}

describe('MediaLightbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, '')
  })

  it('не рендерит ничего при media.length === 0', () => {
    const { container } = render(
      <MediaLightbox media={[]} initialIndex={0} open={true} onClose={() => {}} />
    )
    expect(container.querySelector('[data-testid="lightbox-frame"]')).toBeNull()
  })

  it('не рендерит content при open=false', () => {
    render(
      <MediaLightbox media={makeMedia(3)} initialIndex={0} open={false} onClose={() => {}} />
    )
    expect(screen.queryByTestId('lightbox-frame')).toBeNull()
  })

  it('рендерит изображение по initialIndex', () => {
    render(
      <MediaLightbox media={makeMedia(5)} initialIndex={2} open={true} onClose={() => {}} />
    )
    const img = screen.getByTestId('lightbox-image') as HTMLImageElement
    expect(img.src).toContain('2.jpg')
  })

  it('рендерит индикатор n / total при media.length > 1', () => {
    render(
      <MediaLightbox media={makeMedia(7)} initialIndex={2} open={true} onClose={() => {}} />
    )
    expect(screen.getByTestId('lightbox-indicator').textContent).toBe('3 / 7')
  })

  it('скрывает индикатор и стрелки при media.length === 1', () => {
    render(
      <MediaLightbox media={makeMedia(1)} initialIndex={0} open={true} onClose={() => {}} />
    )
    expect(screen.queryByTestId('lightbox-indicator')).toBeNull()
    expect(screen.queryByTestId('lightbox-prev')).toBeNull()
    expect(screen.queryByTestId('lightbox-next')).toBeNull()
  })

  it('кнопка × вызывает onClose', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<MediaLightbox media={makeMedia(3)} initialIndex={0} open={true} onClose={onClose} />)
    await user.click(screen.getByTestId('lightbox-close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('клик "следующее" увеличивает индекс и обновляет индикатор', async () => {
    const user = userEvent.setup()
    render(
      <MediaLightbox media={makeMedia(7)} initialIndex={2} open={true} onClose={() => {}} />
    )
    await user.click(screen.getByTestId('lightbox-next'))
    expect(screen.getByTestId('lightbox-indicator').textContent).toBe('4 / 7')
  })

  it('клик "предыдущее" уменьшает индекс', async () => {
    const user = userEvent.setup()
    render(
      <MediaLightbox media={makeMedia(7)} initialIndex={2} open={true} onClose={() => {}} />
    )
    await user.click(screen.getByTestId('lightbox-prev'))
    expect(screen.getByTestId('lightbox-indicator').textContent).toBe('2 / 7')
  })

  it('на первом элементе кнопка prev задизейблена', () => {
    render(
      <MediaLightbox media={makeMedia(3)} initialIndex={0} open={true} onClose={() => {}} />
    )
    expect(screen.getByTestId('lightbox-prev')).toBeDisabled()
  })

  it('на последнем элементе кнопка next задизейблена', () => {
    render(
      <MediaLightbox media={makeMedia(3)} initialIndex={2} open={true} onClose={() => {}} />
    )
    expect(screen.getByTestId('lightbox-next')).toBeDisabled()
  })

  it('клавиша ArrowRight увеличивает индекс', () => {
    render(
      <MediaLightbox media={makeMedia(5)} initialIndex={1} open={true} onClose={() => {}} />
    )
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByTestId('lightbox-indicator').textContent).toBe('3 / 5')
  })

  it('клавиша ArrowLeft уменьшает индекс', () => {
    render(
      <MediaLightbox media={makeMedia(5)} initialIndex={2} open={true} onClose={() => {}} />
    )
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByTestId('lightbox-indicator').textContent).toBe('2 / 5')
  })

  it('ArrowRight на последнем элементе — no-op', () => {
    render(
      <MediaLightbox media={makeMedia(3)} initialIndex={2} open={true} onClose={() => {}} />
    )
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByTestId('lightbox-indicator').textContent).toBe('3 / 3')
  })

  it('видео рендерится с autoPlay и controls', () => {
    render(
      <MediaLightbox
        media={[{ id: 'v', url: 'v.mp4', media_type: 'video', thumbnail_url: 'p.jpg', alt: 'Video' }]}
        initialIndex={0}
        open={true}
        onClose={() => {}}
      />
    )
    const video = screen.getByTestId('lightbox-video') as HTMLVideoElement
    expect(video.autoplay).toBe(true)
    expect(video.controls).toBe(true)
    expect(video.muted).toBe(false)
  })

  it('при открытии вызывает setActiveVideo(null) для NFR4.1', () => {
    render(
      <MediaLightbox media={makeMedia(2)} initialIndex={0} open={true} onClose={() => {}} />
    )
    expect(mockSetActiveVideo).toHaveBeenCalledWith(null)
  })

  it('при открытии добавляет history entry', () => {
    const pushState = vi.spyOn(window.history, 'pushState')
    render(
      <MediaLightbox media={makeMedia(2)} initialIndex={0} open={true} onClose={() => {}} />
    )
    expect(pushState).toHaveBeenCalledWith({ lightbox: true }, '')
    pushState.mockRestore()
  })

  it('popstate вызывает onClose без дополнительного history.back()', () => {
    const onClose = vi.fn()
    const back = vi.spyOn(window.history, 'back')
    render(
      <MediaLightbox media={makeMedia(2)} initialIndex={0} open={true} onClose={onClose} />
    )
    fireEvent.popState(window)
    expect(onClose).toHaveBeenCalled()
    expect(back).not.toHaveBeenCalled()
    back.mockRestore()
  })

  it('программное закрытие вызывает history.back() для очистки стека', async () => {
    const user = userEvent.setup()
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    function Wrapper() {
      const [open, setOpen] = useState(true)
      return (
        <MediaLightbox
          media={makeMedia(2)}
          initialIndex={0}
          open={open}
          onClose={() => setOpen(false)}
        />
      )
    }
    render(<Wrapper />)
    await user.click(screen.getByTestId('lightbox-close'))
    expect(back).toHaveBeenCalled()
    back.mockRestore()
  })

  it('fallback при ошибке загрузки изображения', () => {
    render(
      <MediaLightbox media={makeMedia(2)} initialIndex={0} open={true} onClose={() => {}} />
    )
    fireEvent.error(screen.getByTestId('lightbox-image'))
    expect(screen.getByTestId('lightbox-media-error')).toBeInTheDocument()
    expect(screen.queryByTestId('lightbox-image')).toBeNull()
  })

  it('свайп-вниз > 120px вызывает onClose', () => {
    const onClose = vi.fn()
    render(
      <MediaLightbox media={makeMedia(3)} initialIndex={0} open={true} onClose={onClose} />
    )
    const popup = screen.getByTestId('lightbox-frame').parentElement!
    fireEvent.pointerDown(popup, { clientX: 100, clientY: 100 })
    fireEvent.pointerUp(popup, { clientX: 100, clientY: 250 })
    expect(onClose).toHaveBeenCalled()
  })

  it('свайп-влево > 60px переключает на следующее', () => {
    render(
      <MediaLightbox media={makeMedia(5)} initialIndex={1} open={true} onClose={() => {}} />
    )
    const popup = screen.getByTestId('lightbox-frame').parentElement!
    fireEvent.pointerDown(popup, { clientX: 200, clientY: 100 })
    fireEvent.pointerUp(popup, { clientX: 100, clientY: 105 })
    expect(screen.getByTestId('lightbox-indicator').textContent).toBe('3 / 5')
  })

  it('свайп-вправо > 60px переключает на предыдущее', () => {
    render(
      <MediaLightbox media={makeMedia(5)} initialIndex={2} open={true} onClose={() => {}} />
    )
    const popup = screen.getByTestId('lightbox-frame').parentElement!
    fireEvent.pointerDown(popup, { clientX: 100, clientY: 100 })
    fireEvent.pointerUp(popup, { clientX: 200, clientY: 105 })
    expect(screen.getByTestId('lightbox-indicator').textContent).toBe('2 / 5')
  })

  it('свайп с маленькой амплитудой (< 60px) — no-op', () => {
    const onClose = vi.fn()
    render(
      <MediaLightbox media={makeMedia(5)} initialIndex={1} open={true} onClose={onClose} />
    )
    const popup = screen.getByTestId('lightbox-frame').parentElement!
    fireEvent.pointerDown(popup, { clientX: 100, clientY: 100 })
    fireEvent.pointerUp(popup, { clientX: 130, clientY: 110 })
    expect(screen.getByTestId('lightbox-indicator').textContent).toBe('2 / 5')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('переключение медиа сбрасывает hasMediaError', () => {
    const media: LightboxMedia[] = [
      { id: 'a', url: 'a.jpg', media_type: 'image', alt: 'A' },
      { id: 'b', url: 'b.jpg', media_type: 'image', alt: 'B' },
    ]
    render(<MediaLightbox media={media} initialIndex={0} open={true} onClose={() => {}} />)
    fireEvent.error(screen.getByTestId('lightbox-image'))
    expect(screen.getByTestId('lightbox-media-error')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('lightbox-next'))
    expect(screen.queryByTestId('lightbox-media-error')).toBeNull()
    expect(screen.getByTestId('lightbox-image')).toBeInTheDocument()
  })

  it('fallback при ошибке загрузки видео', () => {
    render(
      <MediaLightbox
        media={[{ id: 'v', url: 'v.mp4', media_type: 'video', thumbnail_url: null, alt: 'Video' }]}
        initialIndex={0}
        open={true}
        onClose={() => {}}
      />
    )
    fireEvent.error(screen.getByTestId('lightbox-video'))
    expect(screen.getByTestId('lightbox-media-error')).toBeInTheDocument()
    expect(screen.queryByTestId('lightbox-video')).toBeNull()
  })

  it('видео ставится на паузу при переключении медиа', async () => {
    const pauseSpy = vi.spyOn(HTMLVideoElement.prototype, 'pause').mockImplementation(() => {})
    const user = userEvent.setup()
    const media: LightboxMedia[] = [
      { id: 'v1', url: 'v1.mp4', media_type: 'video', thumbnail_url: null, alt: 'Video 1' },
      { id: 'v2', url: 'v2.mp4', media_type: 'video', thumbnail_url: null, alt: 'Video 2' },
    ]
    render(<MediaLightbox media={media} initialIndex={0} open={true} onClose={() => {}} />)
    pauseSpy.mockClear()
    await user.click(screen.getByTestId('lightbox-next'))
    expect(pauseSpy).toHaveBeenCalled()
    pauseSpy.mockRestore()
  })

  it('видео ставится на паузу при закрытии lightbox', () => {
    const pauseSpy = vi.spyOn(HTMLVideoElement.prototype, 'pause').mockImplementation(() => {})
    const { rerender } = render(
      <MediaLightbox
        media={[{ id: 'v', url: 'v.mp4', media_type: 'video', thumbnail_url: null, alt: 'Video' }]}
        initialIndex={0}
        open={true}
        onClose={() => {}}
      />
    )
    pauseSpy.mockClear()
    rerender(
      <MediaLightbox
        media={[{ id: 'v', url: 'v.mp4', media_type: 'video', thumbnail_url: null, alt: 'Video' }]}
        initialIndex={0}
        open={false}
        onClose={() => {}}
      />
    )
    expect(pauseSpy).toHaveBeenCalled()
    pauseSpy.mockRestore()
  })

  it('Esc закрывает lightbox через Dialog', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<MediaLightbox media={makeMedia(3)} initialIndex={0} open={true} onClose={onClose} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
