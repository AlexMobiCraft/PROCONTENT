import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  console.log('=== Распределение постов по категориям ===\n')

  const { data: posts } = await supabase
    .from('posts')
    .select('category')
    .not('telegram_message_id', 'is', null)
    .eq('is_published', true)

  if (!posts) return

  const counts: Record<string, number> = {}
  posts.forEach(p => {
    counts[p.category] = (counts[p.category] || 0) + 1
  })

  console.log('Категория → Количество постов:')
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`)
  })

  console.log(`\nВсего: ${posts.length}`)
}

check().catch(console.error)
