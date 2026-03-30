import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  // Count posts with telegram_message_id
  const { count } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .not('telegram_message_id', 'is', null)

  console.log(`Всего постов с telegram_message_id: ${count}`)

  const { data: telegramPosts } = await supabase
    .from('posts')
    .select('id, telegram_message_id, updated_at, is_published, author_id')
    .not('telegram_message_id', 'is', null)
    .limit(1)

  if (telegramPosts && telegramPosts.length > 0) {
    console.log('\nПример поста:')
    const post = telegramPosts[0]
    console.log(`  ID: ${post.id}`)
    console.log(`  telegram_message_id: ${post.telegram_message_id}`)
    console.log(`  updated_at: ${post.updated_at}`)
    console.log(`  is_published: ${post.is_published}`)
    console.log(`  author_id: ${post.author_id}`)
  }

  // Check for recent updated_at values
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('id, updated_at')
    .not('telegram_message_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(5)

  console.log('\nПоследние обновления:')
  if (recentPosts) {
    recentPosts.forEach((p, i) => {
      console.log(`  ${i+1}. ID ${p.id}: ${p.updated_at}`)
    })
  }
}

check().catch(console.error)
