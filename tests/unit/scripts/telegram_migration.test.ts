/**
 * Юнит-тесты для вспомогательных функций telegram_migration.ts
 *
 * Тестируем логику без зависимостей от Supabase/FS.
 */

import { describe, it, expect } from 'vitest'

// ── Встраиваем тестируемые функции напрямую (скрипт не экспортирует) ──────────
// Дублируем чистые функции для тестирования

type TextEntity = { type: string; text: string }
type TelegramMessage = {
  id: number
  type: string
  date: string
  text: string | TextEntity[]
  photo?: string
  file?: string
  thumbnail?: string
  media_group_id?: string
}
type PostGroup = {
  messages: TelegramMessage[]
  media_group_id?: string
  postType: 'text' | 'photo' | 'video' | 'gallery'
}

const MAX_MEDIA_PER_POST = 10

function extractText(text: string | TextEntity[]): string {
  if (typeof text === 'string') return text
  return text.map((e) => e.text).join('')
}

function groupMessages(messages: TelegramMessage[]): PostGroup[] {
  const mediaGroups = new Map<string, TelegramMessage[]>()
  const singles: TelegramMessage[] = []

  for (const msg of messages) {
    if (msg.type !== 'message') continue
    if (msg.media_group_id) {
      const g = mediaGroups.get(msg.media_group_id) ?? []
      g.push(msg)
      mediaGroups.set(msg.media_group_id, g)
    } else {
      singles.push(msg)
    }
  }

  const result: PostGroup[] = []

  for (const msg of singles) {
    let postType: PostGroup['postType']
    if (msg.photo) postType = 'photo'
    else if (msg.file) postType = 'video'
    else postType = 'text'
    result.push({ messages: [msg], postType })
  }

  for (const [groupId, msgs] of mediaGroups) {
    const sorted = msgs.sort((a, b) => a.id - b.id)
    for (let i = 0; i < sorted.length; i += MAX_MEDIA_PER_POST) {
      const chunk = sorted.slice(i, i + MAX_MEDIA_PER_POST)
      result.push({ messages: chunk, media_group_id: groupId, postType: 'gallery' })
    }
  }

  result.sort((a, b) => a.messages[0].id - b.messages[0].id)
  return result
}

// ── Тесты ─────────────────────────────────────────────────────────────────────

describe('extractText', () => {
  it('возвращает строку как есть', () => {
    expect(extractText('Простой текст')).toBe('Простой текст')
  })

  it('объединяет TextEntity массив в строку', () => {
    const entities: TextEntity[] = [
      { type: 'plain', text: 'Обычный ' },
      { type: 'bold', text: 'жирный' },
      { type: 'plain', text: ' текст' },
    ]
    expect(extractText(entities)).toBe('Обычный жирный текст')
  })

  it('возвращает пустую строку для пустого массива', () => {
    expect(extractText([])).toBe('')
  })

  it('возвращает пустую строку для пустой строки', () => {
    expect(extractText('')).toBe('')
  })
})

describe('groupMessages', () => {
  it('пропускает service messages', () => {
    const messages: TelegramMessage[] = [
      { id: 1, type: 'service', date: '2023-01-01T00:00:00', text: 'Пользователь вступил' },
      { id: 2, type: 'message', date: '2023-01-01T01:00:00', text: 'Привет' },
    ]
    const groups = groupMessages(messages)
    expect(groups).toHaveLength(1)
    expect(groups[0].messages[0].id).toBe(2)
  })

  it('текстовое сообщение → type=text', () => {
    const messages: TelegramMessage[] = [
      { id: 1, type: 'message', date: '2023-01-01T00:00:00', text: 'Текст поста' },
    ]
    const groups = groupMessages(messages)
    expect(groups[0].postType).toBe('text')
  })

  it('сообщение с фото → type=photo', () => {
    const messages: TelegramMessage[] = [
      { id: 1, type: 'message', date: '2023-01-01T00:00:00', text: '', photo: 'files/photo.jpg' },
    ]
    const groups = groupMessages(messages)
    expect(groups[0].postType).toBe('photo')
  })

  it('сообщение с видео → type=video', () => {
    const messages: TelegramMessage[] = [
      { id: 1, type: 'message', date: '2023-01-01T00:00:00', text: '', file: 'files/video.mp4' },
    ]
    const groups = groupMessages(messages)
    expect(groups[0].postType).toBe('video')
  })

  it('медиагруппа из 2 сообщений → type=gallery', () => {
    const messages: TelegramMessage[] = [
      {
        id: 10,
        type: 'message',
        date: '2023-01-01T00:00:00',
        text: 'Подпись',
        photo: 'files/photo1.jpg',
        media_group_id: 'group123',
      },
      {
        id: 11,
        type: 'message',
        date: '2023-01-01T00:00:01',
        text: '',
        photo: 'files/photo2.jpg',
        media_group_id: 'group123',
      },
    ]
    const groups = groupMessages(messages)
    expect(groups).toHaveLength(1)
    expect(groups[0].postType).toBe('gallery')
    expect(groups[0].messages).toHaveLength(2)
    expect(groups[0].media_group_id).toBe('group123')
  })

  it('медиагруппа сортируется по id (порядок отправки)', () => {
    // Сообщения в result.json могут идти вразброс
    const messages: TelegramMessage[] = [
      {
        id: 15,
        type: 'message',
        date: '2023-01-01T00:00:02',
        text: '',
        photo: 'files/photo3.jpg',
        media_group_id: 'grp1',
      },
      {
        id: 13,
        type: 'message',
        date: '2023-01-01T00:00:00',
        text: 'Подпись',
        photo: 'files/photo1.jpg',
        media_group_id: 'grp1',
      },
      {
        id: 14,
        type: 'message',
        date: '2023-01-01T00:00:01',
        text: '',
        photo: 'files/photo2.jpg',
        media_group_id: 'grp1',
      },
    ]
    const groups = groupMessages(messages)
    expect(groups[0].messages[0].id).toBe(13)
    expect(groups[0].messages[1].id).toBe(14)
    expect(groups[0].messages[2].id).toBe(15)
  })

  it('медиагруппа > 10 элементов → разбивается на чанки', () => {
    const messages: TelegramMessage[] = Array.from({ length: 13 }, (_, i) => ({
      id: i + 1,
      type: 'message',
      date: '2023-01-01T00:00:00',
      text: '',
      photo: `files/photo${i + 1}.jpg`,
      media_group_id: 'biggroup',
    }))
    const groups = groupMessages(messages)
    // 13 медиа → 2 группы: 10 + 3
    expect(groups).toHaveLength(2)
    expect(groups[0].messages).toHaveLength(10)
    expect(groups[1].messages).toHaveLength(3)
    expect(groups[0].postType).toBe('gallery')
    expect(groups[1].postType).toBe('gallery')
  })

  it('несколько отдельных сообщений сортируются хронологически', () => {
    const messages: TelegramMessage[] = [
      { id: 5, type: 'message', date: '2023-01-01T05:00:00', text: 'Пятый' },
      { id: 1, type: 'message', date: '2023-01-01T01:00:00', text: 'Первый' },
      { id: 3, type: 'message', date: '2023-01-01T03:00:00', text: 'Третий' },
    ]
    const groups = groupMessages(messages)
    expect(groups[0].messages[0].id).toBe(1)
    expect(groups[1].messages[0].id).toBe(3)
    expect(groups[2].messages[0].id).toBe(5)
  })

  it('пустой массив → пустой результат', () => {
    expect(groupMessages([])).toHaveLength(0)
  })

  it('смешанные группы и одиночные сортируются вместе', () => {
    const messages: TelegramMessage[] = [
      { id: 3, type: 'message', date: '2023-01-01T03:00:00', text: 'Одиночный' },
      {
        id: 1,
        type: 'message',
        date: '2023-01-01T01:00:00',
        text: 'Первый галереи',
        photo: 'f1.jpg',
        media_group_id: 'grp',
      },
      {
        id: 2,
        type: 'message',
        date: '2023-01-01T02:00:00',
        text: '',
        photo: 'f2.jpg',
        media_group_id: 'grp',
      },
    ]
    const groups = groupMessages(messages)
    expect(groups).toHaveLength(2)
    expect(groups[0].postType).toBe('gallery') // id=1 первый
    expect(groups[1].messages[0].id).toBe(3) // id=3 второй
  })
})
