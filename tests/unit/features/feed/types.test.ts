import { describe, expect, it } from 'vitest'
import { dbPostToCardData } from '@/features/feed/types'
import type { Post } from '@/features/feed/types'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    author_id: 'user-1',
    title: 'Тестовый пост',
    excerpt: 'Описание поста',
    content: 'Полный текст',
    category: 'insight',
    type: 'text',
    image_url: null,
    likes_count: 5,
    comments_count: 3,
    is_published: true,
    is_landing_preview: false,
    is_onboarding: false,
    created_at: '2026-03-15T10:00:00Z',
    updated_at: '2026-03-15T10:00:00Z',
    profiles: {
      display_name: 'Анна Иванова',
      avatar_url: null,
    },
    ...overrides,
  }
}

describe('dbPostToCardData', () => {
  it('маппит все поля поста в PostCardData', () => {
    const post = makePost()
    const card = dbPostToCardData(post)

    expect(card.id).toBe('post-1')
    expect(card.category).toBe('insight')
    expect(card.title).toBe('Тестовый пост')
    expect(card.excerpt).toBe('Описание поста')
    expect(card.likes).toBe(5)
    expect(card.comments).toBe(3)
    expect(card.type).toBe('text')
  })

  it('форматирует дату на русском', () => {
    const card = dbPostToCardData(makePost())
    // toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    expect(card.date).toMatch(/15/)
    expect(card.date).toMatch(/март/i)
  })

  it('извлекает имя автора из profiles join и ставит isAuthor=true для владельца', () => {
    const card = dbPostToCardData(makePost(), 'user-1')

    expect(card.author.name).toBe('Анна Иванова')
    expect(card.author.initials).toBe('АИ')
    expect(card.author.isAuthor).toBe(true)
  })

  it('ставит isAuthor=false если текущий пользователь не совпадает с author_id или отсутствует', () => {
    expect(dbPostToCardData(makePost(), 'user-2').author.isAuthor).toBe(false)
    expect(dbPostToCardData(makePost()).author.isAuthor).toBe(false)
  })

  it('использует fallback "Автор" при null profiles', () => {
    const card = dbPostToCardData(makePost({ profiles: null }))

    expect(card.author.name).toBe('Автор')
    expect(card.author.initials).toBe('А')
  })

  it('использует fallback "Автор" при null display_name', () => {
    const card = dbPostToCardData(
      makePost({ profiles: { display_name: null, avatar_url: null } })
    )

    expect(card.author.name).toBe('Автор')
  })

  it('использует fallback "Автор" при пустом display_name', () => {
    const card = dbPostToCardData(
      makePost({ profiles: { display_name: '', avatar_url: null } })
    )

    expect(card.author.name).toBe('Автор')
    expect(card.author.initials).toBe('А')
  })

  it('маппит null excerpt в пустую строку', () => {
    const card = dbPostToCardData(makePost({ excerpt: null }))
    expect(card.excerpt).toBe('')
  })

  it('маппит null image_url в undefined', () => {
    const card = dbPostToCardData(makePost({ image_url: null }))
    expect(card.imageUrl).toBeUndefined()
  })

  it('маппит реальный image_url', () => {
    const card = dbPostToCardData(makePost({ image_url: 'https://example.com/img.jpg' }))
    expect(card.imageUrl).toBe('https://example.com/img.jpg')
  })

  it('генерирует инициалы из одного слова', () => {
    const card = dbPostToCardData(
      makePost({ profiles: { display_name: 'Максим', avatar_url: null } })
    )
    expect(card.author.initials).toBe('М')
  })
})
