import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as markdownModule from '@/lib/markdown'
import { MarkdownRenderer } from '@/features/feed/components/MarkdownRenderer'

vi.mock('dompurify', () => {
  const activeHooks = new Map<string, (node: Element) => void>()

  return {
    default: {
      addHook: (name: string, fn: (node: Element) => void) => {
        activeHooks.set(name, fn)
      },
      removeHook: (name: string) => {
        activeHooks.delete(name)
      },
      sanitize: (html: string, options?: { ALLOWED_TAGS?: string[]; ALLOWED_ATTR?: string[] }) => {
        const div = document.createElement('div')
        div.innerHTML = html

        div.querySelectorAll('script').forEach((el) => el.remove())

        div.querySelectorAll('*').forEach((el) => {
          Array.from(el.attributes).forEach((attr) => {
            if (attr.name.startsWith('on')) {
              el.removeAttribute(attr.name)
            }
          })
        })

        if (options?.ALLOWED_TAGS) {
          const allowedTags = options.ALLOWED_TAGS
          div.querySelectorAll('*').forEach((el) => {
            if (!allowedTags.includes(el.tagName.toLowerCase())) {
              el.replaceWith(...Array.from(el.childNodes))
            }
          })
        }

        const hook = activeHooks.get('afterSanitizeAttributes')
        if (hook) {
          div.querySelectorAll('*').forEach((el) => hook(el))
        }

        return div.innerHTML
      },
    },
  }
})

describe('MarkdownRenderer', () => {
  it('renders h2 heading from HTML', () => {
    render(<MarkdownRenderer content="<h2>Naslov</h2>" />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Naslov')
  })

  it('renders unordered list', () => {
    render(<MarkdownRenderer content="<ul><li>Prvi</li><li>Drugi</li></ul>" />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Prvi')
  })

  it('renders preformatted code block', () => {
    render(<MarkdownRenderer content="<pre><code>const x = 1</code></pre>" />)
    expect(screen.getByText('const x = 1')).toBeInTheDocument()
  })

  it('adds lazy loading to img without attribute', () => {
    render(<MarkdownRenderer content='<img src="/test.jpg" alt="test" />' />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('preserves explicit eager loading on img', () => {
    render(<MarkdownRenderer content='<img src="/test.jpg" alt="test" loading="eager" />' />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('loading', 'eager')
  })

  it('removes script tags from output', () => {
    const { container } = render(
      <MarkdownRenderer content='<p>Besedilo</p><script>alert("xss")</script>' />
    )

    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByText('Besedilo')).toBeInTheDocument()
  })

  it('removes onclick attribute', () => {
    render(<MarkdownRenderer content='<p onclick="alert(1)">Odstavek</p>' />)
    const paragraph = screen.getByText('Odstavek')
    expect(paragraph).not.toHaveAttribute('onclick')
  })

  it('renders without errors for empty content', () => {
    const { container } = render(<MarkdownRenderer content="" />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('adds rel to target blank links', () => {
    render(
      <MarkdownRenderer content='<a href="https://example.com" target="_blank">Povezava</a>' />
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows fallback when sanitization fails', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sanitizeSpy = vi.spyOn(markdownModule, 'sanitizeHtml').mockImplementation(() => {
      throw new Error('sanitize failed')
    })

    render(<MarkdownRenderer content="<p>test</p>" />)

    expect(screen.getByText('Vsebina trenutno ni na voljo.')).toBeInTheDocument()

    sanitizeSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })
})
