import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PostComposerPreview } from '@/features/admin/components/PostComposerPreview'

vi.mock('next/image', () => ({
  default: ({
    unoptimized,
    ...props
  }: React.ComponentProps<'img'> & { unoptimized?: boolean }) => {
    void unoptimized
    return createElement('img', { ...props, alt: props.alt ?? '' })
  },
}))

describe('PostComposerPreview', () => {
  it('renders gallery above article body', () => {
    render(
      <PostComposerPreview
        title="Naslov"
        excerpt="Povzetek"
        gallery={[
          {
            kind: 'existing',
            id: 'media-1',
            url: 'https://cdn.example.com/gallery-1.jpg',
            thumbnail_url: null,
            media_type: 'image',
            is_cover: true,
            order_index: 0,
          },
        ]}
        editor={{
          html: '<p>Besedilo članka</p>',
          json: { type: 'doc', content: [] },
          inline_images_count: 1,
        }}
        warning={null}
      />
    )

    const gallery = screen.getByTestId('preview-gallery')
    const article = screen.getByTestId('preview-article')
    const position = gallery.compareDocumentPosition(article)

    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(article).toHaveTextContent('Besedilo članka')
  })

  it('renders composition warning without blocking preview content', () => {
    render(
      <PostComposerPreview
        title=""
        excerpt=""
        gallery={[]}
        editor={{
          html: '',
          json: { type: 'doc', content: [] },
          inline_images_count: 5,
        }}
        warning="Besedilo vsebuje veliko slik. Preverite, ali vsebina ostaja berljiva."
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Besedilo vsebuje veliko slik. Preverite, ali vsebina ostaja berljiva.'
    )
    expect(screen.getByTestId('preview-article')).toBeInTheDocument()
  })
})
