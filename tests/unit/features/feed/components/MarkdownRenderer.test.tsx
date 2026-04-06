import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// DOMPurify работает в jsdom, но мокируем для предсказуемости тестов
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

        // Удаляем script-теги
        div.querySelectorAll('script').forEach((el) => el.remove())

        // Удаляем event-атрибуты
        div.querySelectorAll('*').forEach((el) => {
          Array.from(el.attributes).forEach((attr) => {
            if (attr.name.startsWith('on')) {
              el.removeAttribute(attr.name)
            }
          })
        })

        // Если есть ALLOWED_TAGS — удаляем запрещённые теги
        if (options?.ALLOWED_TAGS) {
          const allowedTags = options.ALLOWED_TAGS
          div.querySelectorAll('*').forEach((el) => {
            if (!allowedTags.includes(el.tagName.toLowerCase())) {
              el.replaceWith(...Array.from(el.childNodes))
            }
          })
        }

        // Применяем хуки afterSanitizeAttributes
        const hook = activeHooks.get('afterSanitizeAttributes')
        if (hook) {
          div.querySelectorAll('*').forEach((el) => hook(el))
        }

        return div.innerHTML
      },
    },
  }
})

import { MarkdownRenderer } from '@/features/feed/components/MarkdownRenderer'

describe('MarkdownRenderer', () => {
  it('рендерит h2 заголовок из HTML', () => {
    render(<MarkdownRenderer content="<h2>Заголовок</h2>" />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Заголовок')
  })

  it('рендерит ul список', () => {
    render(<MarkdownRenderer content="<ul><li>Первый</li><li>Второй</li></ul>" />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Первый')
  })

  it('рендерит pre>code блок кода', () => {
    render(<MarkdownRenderer content="<pre><code>const x = 1</code></pre>" />)
    expect(screen.getByRole('code')).toHaveTextContent('const x = 1')
  })

  it('добавляет loading="lazy" к img без этого атрибута', () => {
    render(<MarkdownRenderer content='<img src="/test.jpg" alt="тест" />' />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('не перезаписывает loading="eager" у img с явным атрибутом', () => {
    render(<MarkdownRenderer content='<img src="/test.jpg" alt="тест" loading="eager" />' />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('loading', 'eager')
  })

  it('удаляет script-тег из output', () => {
    const { container } = render(
      <MarkdownRenderer content='<p>Текст</p><script>alert("xss")</script>' />
    )
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByText('Текст')).toBeInTheDocument()
  })

  it('удаляет onclick атрибут', () => {
    render(<MarkdownRenderer content='<p onclick="alert(1)">Параграф</p>' />)
    const p = screen.getByText('Параграф')
    expect(p).not.toHaveAttribute('onclick')
  })

  it('рендерится без ошибок при пустом content', () => {
    const { container } = render(<MarkdownRenderer content="" />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('добавляет rel="noopener noreferrer" к ссылкам с target="_blank"', () => {
    render(
      <MarkdownRenderer content='<a href="https://example.com" target="_blank">Ссылка</a>' />
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
