import { PreviewPostCard } from './PreviewPostCard'

const previewPosts = [
  {
    id: '1',
    category: '#insight',
    title: 'Zakaj algoritem Reelsa promovira ene in ignorira druge',
    excerpt:
      'Razkrili smo mehaniko razvrščanja kratkih videoposnetkov: kaj resnično vpliva na doseg in kaj je mit.',
    date: '12. feb',
    likes: 47,
    comments: 12,
    isLocked: false,
  },
  {
    id: '2',
    category: '#analize',
    title: 'UGC portfelj: kako zbrati prvih 5 primerov brez proračuna',
    excerpt:
      'Vodnik po korakih: od izbire niše do predstavitve blagovni znamki. Vključuje predlogo pisma.',
    date: '8. feb',
    likes: 83,
    comments: 24,
    isLocked: true,
  },
  {
    id: '3',
    category: '#snemanje',
    title: 'Osvetlitev v prostoru: 3 postavitve za vsebino s telefonom',
    excerpt:
      'Obročna luč ni edina možnost. Pokažemo, kako delati z naravno svetlobo.',
    date: '1. feb',
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
            Predogled vsebine
          </p>
          <h2 className="font-serif text-foreground text-balance text-[clamp(2rem,8vw,3.5rem)] font-light leading-none uppercase">
            Poglej noter
          </h2>
          <p className="text-xs tracking-[0.1em] uppercase leading-relaxed text-muted-foreground">
            {'Vsak teden \u2014 nove analize, vpogledi in praktični vodniki.'}
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
