import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, title, content')
    .not('content', 'is', null)

  if (error) {
    console.error('Error fetching posts:', error)
    process.exit(1)
  }

  let removedCount = 0

  for (const post of posts || []) {
    if (!post.content) continue
    const hasBroken = post.content.includes('IMG_3412.jpeg')
    if (!hasBroken) continue

    console.log(`Post: ${post.id} — ${post.title}`)

    let newContent = post.content

    const figureRegex = /<figure[^>]*data-type="inline-image"[^>]*>.*?<img[^>]*src="[^"]*IMG_3412\.jpeg"[^>]*>.*?<\/figure>/gi
    if (figureRegex.test(newContent)) {
      newContent = newContent.replace(figureRegex, '')
    } else {
      const imgRegex = /<img[^>]*src="[^"]*IMG_3412\.jpeg"[^>]*\/?>/gi
      newContent = newContent.replace(imgRegex, '')
    }

    newContent = newContent.replace(/\n{3,}/g, '\n\n').trim()

    if (newContent !== post.content) {
      const { error: updateError } = await supabase
        .from('posts')
        .update({ content: newContent, updated_at: new Date().toISOString() })
        .eq('id', post.id)
      if (updateError) {
        console.error(`  FAILED to update: ${updateError.message}`)
      } else {
        console.log('  REMOVED broken image, updated content')
        removedCount++
      }
    }
  }

  console.log(`\nDone. Removed broken images from ${removedCount} posts.`)
}

main().catch(console.error)
