import { describe, it, expect } from 'vitest'
import {
  generateNewPostEmailHtml,
  generateNewPostEmailText,
} from '@/lib/email/templates/new-post'

const BASE_DATA = {
  postTitle: 'Kako ustvariti viralno vsebino',
  postUrl: 'https://procontent.si/feed/123',
  recipientName: 'Ana',
  unsubscribeUrl: 'https://procontent.si/profile',
}

describe('generateNewPostEmailHtml', () => {
  it('содержит заголовок поста', () => {
    const html = generateNewPostEmailHtml(BASE_DATA)
    expect(html).toContain('Kako ustvariti viralno vsebino')
  })

  it('содержит ссылку на пост', () => {
    const html = generateNewPostEmailHtml(BASE_DATA)
    expect(html).toContain('https://procontent.si/feed/123')
  })

  it('содержит приветствие с именем', () => {
    const html = generateNewPostEmailHtml(BASE_DATA)
    expect(html).toContain('Pozdravljeni, Ana!')
  })

  it('содержит generic приветствие без имени', () => {
    const html = generateNewPostEmailHtml({ ...BASE_DATA, recipientName: null })
    expect(html).toContain('Pozdravljeni!')
    expect(html).not.toContain('Pozdravljeni, null')
  })

  it('содержит ссылку на отписку', () => {
    const html = generateNewPostEmailHtml(BASE_DATA)
    expect(html).toContain('https://procontent.si/profile')
  })

  it('экранирует HTML-символы в заголовке', () => {
    const html = generateNewPostEmailHtml({
      ...BASE_DATA,
      postTitle: '<script>alert("xss")</script>',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('экранирует HTML-символы в URL', () => {
    const html = generateNewPostEmailHtml({
      ...BASE_DATA,
      postUrl: 'https://example.com?a=1&b=2',
    })
    expect(html).toContain('&amp;')
    expect(html).not.toContain('?a=1&b=2')
  })

  it('возвращает валидный HTML-документ', () => {
    const html = generateNewPostEmailHtml(BASE_DATA)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html lang="sl">')
    expect(html).toContain('</html>')
  })

  it('содержит кнопку "Preberi objavo"', () => {
    const html = generateNewPostEmailHtml(BASE_DATA)
    expect(html).toContain('Preberi objavo')
  })

  it('блокирует javascript: URL в href кнопки поста', () => {
    const html = generateNewPostEmailHtml({
      ...BASE_DATA,
      postUrl: 'javascript:alert("xss")',
    })
    expect(html).not.toContain('javascript:')
    expect(html).toContain('href="#"')
  })

  it('блокирует javascript: URL в href ссылки отписки', () => {
    const html = generateNewPostEmailHtml({
      ...BASE_DATA,
      unsubscribeUrl: 'javascript:void(0)',
    })
    expect(html).not.toContain('javascript:')
  })

  it('содержит превью текста (excerpt) когда передан', () => {
    const html = generateNewPostEmailHtml({
      ...BASE_DATA,
      postExcerpt: 'Краткий анонс поста для предпросмотра.',
    })
    expect(html).toContain('Краткий анонс поста для предпросмотра.')
  })

  it('не содержит пустого блока excerpt когда не передан', () => {
    const html = generateNewPostEmailHtml({ ...BASE_DATA, postExcerpt: null })
    expect(html).not.toContain('font-size:14px;color:#6b5e52')
  })

  it('экранирует HTML в excerpt', () => {
    const html = generateNewPostEmailHtml({
      ...BASE_DATA,
      postExcerpt: '<b>опасный</b> текст',
    })
    expect(html).not.toContain('<b>')
    expect(html).toContain('&lt;b&gt;')
  })

  it('разрешает корневые относительные пути /path в href отписки', () => {
    const html = generateNewPostEmailHtml({
      ...BASE_DATA,
      unsubscribeUrl: '/profile',
    })
    expect(html).toContain('href="/profile"')
    expect(html).not.toContain('href="#"')
  })

  it('блокирует protocol-relative URL // в href', () => {
    const html = generateNewPostEmailHtml({
      ...BASE_DATA,
      postUrl: '//evil.com/steal',
    })
    expect(html).not.toContain('//evil.com')
    expect(html).toContain('href="#"')
  })
})

describe('generateNewPostEmailText', () => {
  it('содержит заголовок поста', () => {
    const text = generateNewPostEmailText(BASE_DATA)
    expect(text).toContain('Kako ustvariti viralno vsebino')
  })

  it('содержит ссылку на пост', () => {
    const text = generateNewPostEmailText(BASE_DATA)
    expect(text).toContain('https://procontent.si/feed/123')
  })

  it('содержит приветствие с именем', () => {
    const text = generateNewPostEmailText(BASE_DATA)
    expect(text).toContain('Pozdravljeni, Ana!')
  })

  it('содержит generic приветствие без имени', () => {
    const text = generateNewPostEmailText({ ...BASE_DATA, recipientName: undefined })
    expect(text).toContain('Pozdravljeni!')
  })

  it('содержит ссылку на отписку', () => {
    const text = generateNewPostEmailText(BASE_DATA)
    expect(text).toContain('https://procontent.si/profile')
  })

  it('содержит excerpt в тексте когда передан', () => {
    const text = generateNewPostEmailText({
      ...BASE_DATA,
      postExcerpt: 'Краткий анонс для текстовой версии.',
    })
    expect(text).toContain('Краткий анонс для текстовой версии.')
  })

  it('не добавляет лишней строки когда excerpt отсутствует', () => {
    const textWithout = generateNewPostEmailText({ ...BASE_DATA, postExcerpt: undefined })
    const textWith = generateNewPostEmailText({
      ...BASE_DATA,
      postExcerpt: 'Текст анонса',
    })
    expect(textWith.length).toBeGreaterThan(textWithout.length)
  })
})
