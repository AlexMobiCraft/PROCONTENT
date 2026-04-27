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
const ALBUM_TIME_THRESHOLD_SECONDS = 90

function timeDiffSeconds(date1: string, date2: string): number {
  return Math.abs(new Date(date2).getTime() - new Date(date1).getTime()) / 1000
}

function extractText(text: string | TextEntity[]): string {
  if (typeof text === 'string') return text
  return text.map((e) => e.text).join('')
}

function groupMessages(messages: TelegramMessage[]): PostGroup[] {
  const mediaGroupMap = new Map<string, TelegramMessage[]>()
  const nonGrouped: TelegramMessage[] = []

  for (const msg of messages) {
    if (msg.type !== 'message') continue
    if (msg.media_group_id) {
      const g = mediaGroupMap.get(msg.media_group_id) ?? []
      g.push(msg)
      mediaGroupMap.set(msg.media_group_id, g)
    } else {
      nonGrouped.push(msg)
    }
  }

  const result: PostGroup[] = []

  nonGrouped.sort((a, b) => a.id - b.id)

  let i = 0
  while (i < nonGrouped.length) {
    const msg = nonGrouped[i]
    const isMedia = !!(msg.photo || msg.file)

    if (isMedia) {
      const group = [msg]
      let j = i + 1
      while (j < nonGrouped.length) {
        const next = nonGrouped[j]
        const nextIsMedia = !!(next.photo || next.file)
        if (nextIsMedia && timeDiffSeconds(group[0].date, next.date) <= ALBUM_TIME_THRESHOLD_SECONDS) {
          group.push(next)
          j++
        } else {
          break
        }
      }

      for (let k = 0; k < group.length; k += MAX_MEDIA_PER_POST) {
        const chunk = group.slice(k, k + MAX_MEDIA_PER_POST)
        const firstInChunk = chunk[0]
        result.push({
          messages: chunk,
          postType: chunk.length === 1 ? (firstInChunk.photo ? 'photo' : 'video') : 'gallery',
        })
      }
      i = j
    } else {
      result.push({ messages: [msg], postType: 'text' })
      i++
    }
  }

  for (const [groupId, msgs] of mediaGroupMap) {
    const sorted = msgs.sort((a, b) => a.id - b.id)
    for (let k = 0; k < sorted.length; k += MAX_MEDIA_PER_POST) {
      result.push({ messages: sorted.slice(k, k + MAX_MEDIA_PER_POST), media_group_id: groupId, postType: 'gallery' })
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

  // ── Proximity-based grouping (без media_group_id) ─────────────────────────────

  it('два фото с разницей в 1 секунду → gallery (один пост)', () => {
    const messages: TelegramMessage[] = [
      { id: 1, type: 'message', date: '2024-04-29T18:25:10', text: 'Подпись', photo: 'files/p1.jpg' },
      { id: 2, type: 'message', date: '2024-04-29T18:25:11', text: '', photo: 'files/p2.jpg' },
    ]
    const groups = groupMessages(messages)
    expect(groups).toHaveLength(1)
    expect(groups[0].postType).toBe('gallery')
    expect(groups[0].messages).toHaveLength(2)
  })

  it('семь фото с разницей ≤1 секунды → один gallery-пост', () => {
    const messages: TelegramMessage[] = Array.from({ length: 7 }, (_, i) => ({
      id: i + 7,
      type: 'message',
      date: i === 0 ? '2024-04-29T18:25:10' : '2024-04-29T18:25:11',
      text: i === 0 ? 'Подпись' : '',
      photo: `files/photo${i + 1}.jpg`,
    }))
    const groups = groupMessages(messages)
    expect(groups).toHaveLength(1)
    expect(groups[0].postType).toBe('gallery')
    expect(groups[0].messages).toHaveLength(7)
  })

  it('два фото с разницей > 90 секунд → два отдельных photo-поста', () => {
    const messages: TelegramMessage[] = [
      { id: 1, type: 'message', date: '2024-04-29T18:25:00', text: 'Первый', photo: 'files/p1.jpg' },
      { id: 2, type: 'message', date: '2024-04-29T18:27:00', text: 'Второй', photo: 'files/p2.jpg' }, // +120s
    ]
    const groups = groupMessages(messages)
    expect(groups).toHaveLength(2)
    expect(groups[0].postType).toBe('photo')
    expect(groups[1].postType).toBe('photo')
  })

  it('три фото подряд, затем текст → gallery + text', () => {
    const messages: TelegramMessage[] = [
      { id: 1, type: 'message', date: '2024-04-29T18:25:00', text: 'Подпись', photo: 'files/p1.jpg' },
      { id: 2, type: 'message', date: '2024-04-29T18:25:00', text: '', photo: 'files/p2.jpg' },
      { id: 3, type: 'message', date: '2024-04-29T18:25:01', text: '', photo: 'files/p3.jpg' },
      { id: 4, type: 'message', date: '2024-04-29T18:26:00', text: 'Отдельный текстовый пост' },
    ]
    const groups = groupMessages(messages)
    expect(groups).toHaveLength(2)
    expect(groups[0].postType).toBe('gallery')
    expect(groups[0].messages).toHaveLength(3)
    expect(groups[1].postType).toBe('text')
  })

  it('текст между двумя фото разрывает proximity-группу', () => {
    const messages: TelegramMessage[] = [
      { id: 1, type: 'message', date: '2024-04-29T18:25:00', text: '', photo: 'files/p1.jpg' },
      { id: 2, type: 'message', date: '2024-04-29T18:25:01', text: 'Текст между' },
      { id: 3, type: 'message', date: '2024-04-29T18:25:02', text: '', photo: 'files/p2.jpg' },
    ]
    const groups = groupMessages(messages)
    expect(groups).toHaveLength(3)
    expect(groups[0].postType).toBe('photo')
    expect(groups[1].postType).toBe('text')
    expect(groups[2].postType).toBe('photo')
  })

  it('proximity-группа > 10 элементов → разбивается на чанки', () => {
    const base = new Date('2024-04-29T18:25:00').getTime()
    const messages: TelegramMessage[] = Array.from({ length: 13 }, (_, i) => ({
      id: i + 1,
      type: 'message',
      date: new Date(base + i * 200).toISOString().slice(0, 19), // +200ms каждое
      text: '',
      photo: `files/photo${i + 1}.jpg`,
    }))
    const groups = groupMessages(messages)
    expect(groups).toHaveLength(2)
    expect(groups[0].messages).toHaveLength(10)
    expect(groups[1].messages).toHaveLength(3)
    expect(groups[0].postType).toBe('gallery')
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
