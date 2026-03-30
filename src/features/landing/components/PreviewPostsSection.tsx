import { PreviewPostCard } from './PreviewPostCard'
import type { LandingPreviewPost } from '@/features/landing/api/publicPreview'

interface PreviewPostsSectionProps {
  posts: LandingPreviewPost[]
}

export function PreviewPostsSection({ posts }: PreviewPostsSectionProps) {
  return (
    <section id="preview" className="bg-muted/40 px-5 py-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex flex-col gap-2">
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-primary">
            Predogled vsebine
          </p>
          <h2 className="font-serif text-foreground text-balance text-[clamp(2rem,8vw,3.5rem)] font-light leading-none uppercase">
            Poglej noter
          </h2>
          <p className="text-xs tracking-[0.1em] uppercase leading-relaxed text-muted-foreground">
            {'Vsak teden \u2014 nove analize, vpogledi in praktični vodniki.'}
          </p>
        </div>

        {posts.length > 0 ? (
          <div className="flex flex-col gap-4">
            {posts.map((post) => (
              <PreviewPostCard
                key={post.id}
                category={post.category}
                title={post.title}
                excerpt={post.excerpt ?? ''}
                date={new Date(post.created_at).toLocaleDateString('sl-SI', {
                  day: 'numeric',
                  month: 'short',
                })}
                likes={post.likes_count}
                comments={post.comments_count}
                isLocked={true}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
