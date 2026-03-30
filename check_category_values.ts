import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  console.log('=== Проверка category в постах ===\n')

  // Count posts with category
  const { data: stats } = await supabase
    .from('posts')
    .select('id')
    .not('telegram_message_id', 'is', null)
    .is('category', null)
    .limit(1)

  // Get all distinct categories
  const { data: distinctCats } = await supabase
    .from('posts')
    .select('category')
    .not('telegram_message_id', 'is', null)
    .not('category', 'is', null)

  if (distinctCats) {
    const uniqueCats = [...new Set(distinctCats.map(p => p.category))]
    console.log(`Уникальные категории в постах: ${uniqueCats.length}`)
    uniqueCats.forEach(cat => console.log(`  - ${cat}`))
  }

  // Get sample posts with categories
  const { data: sample } = await supabase
    .from('posts')
    .select('id, title, category, telegram_message_id')
    .not('telegram_message_id', 'is', null)
    .not('category', 'is', null)
    .limit(5)

  console.log(`\nПосты с категориями: ${sample?.length || 0}`)
  sample?.forEach((p, i) => {
    console.log(`  ${i+1}. ${p.title?.substring(0, 40)}... → ${p.category}`)
  })

  // Count posts without category
  const { count: withoutCat } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .not('telegram_message_id', 'is', null)
    .is('category', null)

  console.log(`\nПостов БЕЗ категории: ${withoutCat}`)
}

check().catch(console.error)
