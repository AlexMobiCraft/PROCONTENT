import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MediaItemPreview } from '@/features/admin/components/MediaItemPreview'

describe('MediaItemPreview', () => {
  it('рендерит изображение для image-элемента', () => {
    render(<MediaItemPreview mediaType="image" posterUrl="https://cdn/x.jpg" />)
    const img = document.querySelector('img')
    expect(img).toHaveAttribute('src', 'https://cdn/x.jpg')
  })

  it('для видео показывает сгенерированный poster (img), а не сырой кадр', () => {
    const { container } = render(
      <MediaItemPreview
        mediaType="video"
        posterUrl="blob:poster"
        videoUrl="blob:raw-video"
        thumbnailStatus="success"
      />
    )
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', 'blob:poster')
    // Сырой <video> не рендерится, когда poster готов (Task 2.3)
    expect(container.querySelector('video')).toBeNull()
  })

  it('для видео без poster показывает fallback-видео', () => {
    const { container } = render(
      <MediaItemPreview mediaType="video" posterUrl={null} videoUrl="blob:raw-video" />
    )
    const video = container.querySelector('video')
    expect(video).toHaveAttribute('src', 'blob:raw-video')
  })

  it('показывает индикатор генерации при статусе generating', () => {
    render(
      <MediaItemPreview
        mediaType="video"
        posterUrl={null}
        videoUrl="blob:raw"
        thumbnailStatus="generating"
      />
    )
    expect(screen.getByRole('status', { name: 'Generiranje posterja...' })).toBeInTheDocument()
  })
})
