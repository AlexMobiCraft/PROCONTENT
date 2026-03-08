// Превью-карточки постов для лендинга (публичная зона)
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

function PostPreviewCard({
  post,
}: {
  post: (typeof previewPosts)[number]
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {post.category}
          </span>
          <span className="text-xs text-muted-foreground">{post.date}</span>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-1.5">
          <h3 className="font-heading text-foreground text-base font-semibold leading-snug text-balance">
            {post.title}
          </h3>
          {post.isLocked ? (
            <div className="relative">
              <p className="line-clamp-1 text-sm leading-relaxed text-muted-foreground">
                {post.excerpt}
              </p>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card" />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
              {post.excerpt}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 pt-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <svg
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
            <span className="text-xs">{post.likes}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <svg
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
              />
            </svg>
            <span className="text-xs">{post.comments}</span>
          </div>
          {post.isLocked && (
            <div className="ml-auto flex items-center gap-1 text-primary">
              <svg
                className="size-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
              <span className="text-xs font-medium">Для участниц</span>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export function PreviewPostsSection() {
  return (
    <section id="preview" className="bg-muted/40 px-5 py-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex flex-col gap-2">
          <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
            Превью контента
          </p>
          <h2 className="font-heading text-foreground text-balance text-2xl font-semibold leading-snug">
            Загляни внутрь
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Каждую неделю — новые разборы, инсайты и практические гайды.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {previewPosts.map((post) => (
            <PostPreviewCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </section>
  )
}
