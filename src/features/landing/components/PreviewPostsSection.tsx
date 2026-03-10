import { PreviewPostCard } from './PreviewPostCard'

const previewPosts = [
  {
    id: '1',
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
    id: '2',
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
    id: '3',
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
    <section id="preview" className="bg-muted/40 px-5 py-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex flex-col gap-2">
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-primary">
            Превью контента
          </p>
          <h2 className="font-serif text-foreground text-balance text-[clamp(2rem,8vw,3.5rem)] font-light leading-none uppercase">
            Загляни внутрь
          </h2>
          <p className="text-xs tracking-[0.1em] uppercase leading-relaxed text-muted-foreground">
            {'Каждую неделю \u2014 новые разборы, инсайты и практические гайды.'}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {previewPosts.map((post) => (
            <PreviewPostCard
              key={post.id}
              category={post.category}
              title={post.title}
              excerpt={post.excerpt}
              date={post.date}
              likes={post.likes}
              comments={post.comments}
              isLocked={post.isLocked}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
