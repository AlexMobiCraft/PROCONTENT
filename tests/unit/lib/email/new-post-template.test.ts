import { describe, it, expect } from 'vitest'
import {
  generateNewPostEmailHtml,
  generateNewPostEmailText,
} from '@/lib/email/templates/new-post'

const BASE_DATA = {
  postTitle: 'Kako ustvariti viralno vsebino',
  postUrl: 'https://procontent.si/post/123',
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
    expect(html).toContain('https://procontent.si/post/123')
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
})

describe('generateNewPostEmailText', () => {
  it('содержит заголовок поста', () => {
    const text = generateNewPostEmailText(BASE_DATA)
    expect(text).toContain('Kako ustvariti viralno vsebino')
  })

  it('содержит ссылку на пост', () => {
    const text = generateNewPostEmailText(BASE_DATA)
    expect(text).toContain('https://procontent.si/post/123')
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
})
