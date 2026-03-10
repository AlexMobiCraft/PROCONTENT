import { PreviewPostCard } from './PreviewPostCard'

const previewPosts = [
  {
    category: '#insight',
    title: 'Почему алгоритм Reels продвигает одних и игнорирует других',
    excerpt:
      'Разобрали механику ранжирования коротких видео: что реально влияет на охваты, а что — миф.',
    date: '12 фев',
    likes: 47,
    comments: 12,
    isLocked: false,
  },
  {
    category: '#разборы',
    title: 'UGC-портфолио: как собрать первые 5 кейсов без бюджета',
    excerpt:
      'Пошаговый гайд: от выбора ниши до питча бренду. Включает шаблон письма.',
    date: '8 фев',
    likes: 83,
    comments: 24,
    isLocked: true,
  },
  {
    category: '#съёмка',
    title: 'Свет в помещении: 3 расстановки для контента с телефона',
    excerpt:
      'Кольцевой свет — не единственный вариант. Показываем, как работать с естественным светом.',
    date: '1 фев',
    likes: 61,
    comments: 18,
    isLocked: true,
  },
]

export function PreviewPostsSection() {
  return (
    <section
      id="preview"
      className="bg-muted/40 px-5 py-16"
      aria-label="Превью контента"
    >
      <p className="font-sans text-xs tracking-[0.2em] uppercase text-primary mb-3">
        Превью контента
      </p>
      <h2
        className="font-serif font-light uppercase leading-none text-foreground mb-2"
        style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)' }}
      >
        Загляни внутрь
      </h2>
      <p className="font-sans text-xs tracking-[0.1em] uppercase text-muted-foreground mb-8 leading-relaxed">
        Каждую неделю — новые разборы, инсайты и практические гайды.
      </p>

      <ul className="flex flex-col gap-4">
        {previewPosts.map((post) => (
          <li key={post.title}>
            <PreviewPostCard {...post} />
          </li>
        ))}
      </ul>
    </section>
  )
}
