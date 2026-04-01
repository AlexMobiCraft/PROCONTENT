import { describe, expect, it } from 'vitest'
import { dbPostToCardData, sortByOrderIndex } from '@/features/feed/types'
import type { Post, PostMedia } from '@/features/feed/types'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    author_id: 'user-1',
    title: 'Testna objava',
    excerpt: 'Opis objave',
    content: 'Celotno besedilo',
    category: 'insight',
    type: 'text',
    image_url: null,
    likes_count: 5,
    comments_count: 3,
    is_published: true,
    status: 'published',
    scheduled_at: null,
    published_at: '2026-03-15T10:00:00Z',
    is_landing_preview: false,
    is_onboarding: false,
    created_at: '2026-03-15T10:00:00Z',
    updated_at: '2026-03-15T10:00:00Z',
    is_liked: false,
    profiles: {
      display_name: 'Ana Ivanova',
      avatar_url: null,
    },
    ...overrides,
  } as Post
}

describe('sortByOrderIndex', () => {
  it('сортирует массив медиа по order_index', () => {
    const media: PostMedia[] = [
      { id: 'c', post_id: 'p', media_type: 'image', url: 'c', thumbnail_url: null, order_index: 2, is_cover: false },
      { id: 'a', post_id: 'p', media_type: 'image', url: 'a', thumbnail_url: null, order_index: 0, is_cover: true },
      { id: 'b', post_id: 'p', media_type: 'image', url: 'b', thumbnail_url: null, order_index: 1, is_cover: false },
    ]
    const sorted = sortByOrderIndex(media)
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  it('не мутирует исходный массив', () => {
    const media: PostMedia[] = [
      { id: 'b', post_id: 'p', media_type: 'image', url: 'b', thumbnail_url: null, order_index: 1, is_cover: false },
      { id: 'a', post_id: 'p', media_type: 'image', url: 'a', thumbnail_url: null, order_index: 0, is_cover: true },
    ]
    const original = [...media]
    sortByOrderIndex(media)
    expect(media.map((m) => m.id)).toEqual(original.map((m) => m.id))
  })
})

describe('dbPostToCardData', () => {
  it('маппит все поля поста в PostCardData', () => {
    const post = makePost()
    const card = dbPostToCardData(post)

    expect(card.id).toBe('post-1')
    expect(card.category).toBe('insight')
    expect(card.title).toBe('Testna objava')
    expect(card.excerpt).toBe('Opis objave')
    expect(card.likes).toBe(5)
    expect(card.comments).toBe(3)
    expect(card.type).toBe('text')
  })

  it('форматирует дату на словенском', () => {
    const card = dbPostToCardData(makePost())
    // toLocaleDateString('sl-SI', { day: 'numeric', month: 'long' })
    expect(card.date).toMatch(/15/)
    expect(card.date).toMatch(/marec/i)
  })

  it('извлекает имя автора из profiles join и ставит isAuthor=true для владельца', () => {
    const card = dbPostToCardData(makePost(), 'user-1')

    expect(card.author.name).toBe('Ana Ivanova')
    expect(card.author.initials).toBe('AI')
    expect(card.author.isAuthor).toBe(true)
  })

  it('инициалы: split(/\\s+/) корректно обрабатывает двойные пробелы в имени автора', () => {
    const card = dbPostToCardData(
      makePost({ profiles: { display_name: 'Ana  Ivanova', avatar_url: null } })
    )
    expect(card.author.name).toBe('Ana  Ivanova')
    expect(card.author.initials).toBe('AI')
  })

  it('ставит isAuthor=false если текущий пользователь не совпадает с author_id или отсутствует', () => {
    expect(dbPostToCardData(makePost(), 'user-2').author.isAuthor).toBe(false)
    expect(dbPostToCardData(makePost()).author.isAuthor).toBe(false)
  })

  it('использует fallback "Avtor" при null profiles', () => {
    const card = dbPostToCardData(makePost({ profiles: null }))

    expect(card.author.name).toBe('Avtor')
    expect(card.author.initials).toBe('A')
  })

  it('использует fallback "Avtor" при null display_name', () => {
    const card = dbPostToCardData(
      makePost({ profiles: { display_name: null, avatar_url: null } })
    )

    expect(card.author.name).toBe('Avtor')
  })

  it('использует fallback "Avtor" при пустом display_name', () => {
    const card = dbPostToCardData(
      makePost({ profiles: { display_name: '', avatar_url: null } })
    )

    expect(card.author.name).toBe('Avtor')
    expect(card.author.initials).toBe('A')
  })

  it('маппит null excerpt в пустую строку', () => {
    const card = dbPostToCardData(makePost({ excerpt: null }))
    expect(card.excerpt).toBe('')
  })

  it('маппит null image_url в undefined', () => {
    const card = dbPostToCardData(makePost({ image_url: null }))
    expect(card.imageUrl).toBeUndefined()
  })

  it('маппит null image_url в undefined (legacy image_url больше не используется)', () => {
    // image_url в таблице posts deprecated — источник теперь только post_media
    const card = dbPostToCardData(makePost({ image_url: 'https://example.com/img.jpg', post_media: undefined }))
    expect(card.imageUrl).toBeUndefined()
  })

  it('использует post_media[0].url когда image_url = null', () => {
    const card = dbPostToCardData(
      makePost({
        image_url: null,
        post_media: [
          { id: 'm1', post_id: 'post-1', media_type: 'image', url: 'https://cdn.example.com/media.jpg', thumbnail_url: null, order_index: 0, is_cover: true },
        ],
      })
    )
    expect(card.imageUrl).toBe('https://cdn.example.com/media.jpg')
  })

  it('post_media имеет приоритет над legacy image_url', () => {
    const card = dbPostToCardData(
      makePost({
        image_url: 'https://example.com/legacy.jpg',
        post_media: [
          { id: 'm1', post_id: 'post-1', media_type: 'image', url: 'https://cdn.example.com/media.jpg', thumbnail_url: null, order_index: 0, is_cover: false },
        ],
      })
    )
    expect(card.imageUrl).toBe('https://cdn.example.com/media.jpg')
  })

  it('возвращает undefined когда нет ни image_url ни post_media', () => {
    const card = dbPostToCardData(makePost({ image_url: null, post_media: [] }))
    expect(card.imageUrl).toBeUndefined()
  })

  it('возвращает undefined когда image_url = null и post_media = undefined', () => {
    const card = dbPostToCardData(makePost({ image_url: null, post_media: undefined }))
    expect(card.imageUrl).toBeUndefined()
  })

  it('выбирает cover-медиа из post_media как imageUrl', () => {
    const card = dbPostToCardData(
      makePost({
        image_url: null,
        post_media: [
          { id: 'm1', post_id: 'post-1', media_type: 'image', url: 'https://cdn.example.com/first.jpg', thumbnail_url: null, order_index: 0, is_cover: false },
          { id: 'm2', post_id: 'post-1', media_type: 'image', url: 'https://cdn.example.com/cover.jpg', thumbnail_url: null, order_index: 1, is_cover: true },
        ],
      })
    )
    expect(card.imageUrl).toBe('https://cdn.example.com/cover.jpg')
  })

  it('сортирует post_media по order_index и берёт первый при отсутствии cover', () => {
    const card = dbPostToCardData(
      makePost({
        image_url: null,
        post_media: [
          { id: 'm2', post_id: 'post-1', media_type: 'image', url: 'https://cdn.example.com/second.jpg', thumbnail_url: null, order_index: 1, is_cover: false },
          { id: 'm1', post_id: 'post-1', media_type: 'image', url: 'https://cdn.example.com/first.jpg', thumbnail_url: null, order_index: 0, is_cover: false },
        ],
      })
    )
    expect(card.imageUrl).toBe('https://cdn.example.com/first.jpg')
  })

  it('определяет type="photo" из post_media (одно изображение)', () => {
    const card = dbPostToCardData(
      makePost({
        type: 'text',
        post_media: [
          { id: 'm1', post_id: 'post-1', media_type: 'image', url: 'u', thumbnail_url: null, order_index: 0, is_cover: true },
        ],
      })
    )
    expect(card.type).toBe('photo')
  })

  it('определяет type="video" из post_media (одно видео)', () => {
    const card = dbPostToCardData(
      makePost({
        type: 'text',
        post_media: [
          { id: 'm1', post_id: 'post-1', media_type: 'video', url: 'u', thumbnail_url: null, order_index: 0, is_cover: true },
        ],
      })
    )
    expect(card.type).toBe('video')
  })

  it('определяет type="gallery" из post_media (несколько изображений)', () => {
    const card = dbPostToCardData(
      makePost({
        type: 'text',
        post_media: [
          { id: 'm1', post_id: 'post-1', media_type: 'image', url: 'u1', thumbnail_url: null, order_index: 0, is_cover: false },
          { id: 'm2', post_id: 'post-1', media_type: 'image', url: 'u2', thumbnail_url: null, order_index: 1, is_cover: false },
        ],
      })
    )
    expect(card.type).toBe('gallery')
  })

  it('определяет type="multi-video" из post_media (несколько видео)', () => {
    const card = dbPostToCardData(
      makePost({
        type: 'text',
        post_media: [
          { id: 'm1', post_id: 'post-1', media_type: 'video', url: 'u1', thumbnail_url: null, order_index: 0, is_cover: false },
          { id: 'm2', post_id: 'post-1', media_type: 'video', url: 'u2', thumbnail_url: null, order_index: 1, is_cover: false },
        ],
      })
    )
    expect(card.type).toBe('multi-video')
  })

  it('определяет type="text" когда post_media пуст', () => {
    const card = dbPostToCardData(makePost({ type: 'photo', post_media: [] }))
    expect(card.type).toBe('text')
  })

  it('определяет type="text" когда post_media = undefined', () => {
    const card = dbPostToCardData(makePost({ type: 'video', post_media: undefined }))
    expect(card.type).toBe('text')
  })

  it('генерирует инициалы из одного слова', () => {
    const card = dbPostToCardData(
      makePost({ profiles: { display_name: 'Maksim', avatar_url: null } })
    )
    expect(card.author.initials).toBe('M')
  })
})
