import { describe, it, expect } from 'vitest'
import {
  PostFormSchema,
  MAX_MEDIA_FILES,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_MEDIA_TYPES,
} from '@/features/admin/types'

describe('PostFormSchema', () => {
  it('validates a valid post form', () => {
    const result = PostFormSchema.safeParse({
      title: 'Test Post',
      category: 'insight',
      content: 'Some content',
      excerpt: 'Short excerpt',
    })
    expect(result.success).toBe(true)
  })

  it('fails when title is empty', () => {
    const result = PostFormSchema.safeParse({ title: '', category: 'insight' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('title')
    }
  })

  it('fails when title is only whitespace', () => {
    const result = PostFormSchema.safeParse({ title: '   ', category: 'insight' })
    expect(result.success).toBe(false)
  })

  it('trims title whitespace before validation', () => {
    const result = PostFormSchema.safeParse({ title: '  My Post  ', category: 'insight' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('My Post')
    }
  })

  it('trims category whitespace before validation', () => {
    const result = PostFormSchema.safeParse({ title: 'Post', category: '  insight  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.category).toBe('insight')
    }
  })

  it('fails when category is empty', () => {
    const result = PostFormSchema.safeParse({ title: 'Post', category: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('category')
    }
  })

  it('fails when category is only whitespace', () => {
    const result = PostFormSchema.safeParse({ title: 'Post', category: '   ' })
    expect(result.success).toBe(false)
  })

  it('allows optional content and excerpt', () => {
    const result = PostFormSchema.safeParse({ title: 'Post', category: 'insight' })
    expect(result.success).toBe(true)
  })

  it('fails when excerpt exceeds 500 characters', () => {
    const result = PostFormSchema.safeParse({
      title: 'Post',
      category: 'insight',
      excerpt: 'x'.repeat(501),
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('excerpt')
    }
  })

  it('fails when title exceeds 255 characters', () => {
    const result = PostFormSchema.safeParse({
      title: 'x'.repeat(256),
      category: 'insight',
    })
    expect(result.success).toBe(false)
  })
})

describe('constants', () => {
  it('MAX_MEDIA_FILES is 10', () => {
    expect(MAX_MEDIA_FILES).toBe(10)
  })

  it('MAX_IMAGE_SIZE is 10 MB', () => {
    expect(MAX_IMAGE_SIZE).toBe(10 * 1024 * 1024)
  })

  it('MAX_VIDEO_SIZE is 100 MB', () => {
    expect(MAX_VIDEO_SIZE).toBe(100 * 1024 * 1024)
  })

  it('ALLOWED_IMAGE_TYPES contains common image formats', () => {
    expect(ALLOWED_IMAGE_TYPES).toContain('image/jpeg')
    expect(ALLOWED_IMAGE_TYPES).toContain('image/png')
    expect(ALLOWED_IMAGE_TYPES).toContain('image/webp')
  })

  it('ALLOWED_VIDEO_TYPES contains common video formats', () => {
    expect(ALLOWED_VIDEO_TYPES).toContain('video/mp4')
    expect(ALLOWED_VIDEO_TYPES).toContain('video/webm')
  })

  it('ALLOWED_MEDIA_TYPES combines images and videos', () => {
    expect(ALLOWED_MEDIA_TYPES).toEqual([...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES])
  })
})
