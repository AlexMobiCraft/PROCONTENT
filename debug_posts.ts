import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function debug() {
  console.log('=== Проверка category_id в постах ===\n')

  // Check category distribution
  const { data: stats } = await supabase
    .rpc('execute_query', {
      query: `SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN category_id IS NOT NULL THEN 1 END) as with_category,
        COUNT(CASE WHEN category_id IS NULL THEN 1 END) as without_category
      FROM posts
      WHERE telegram_message_id IS NOT NULL`
    })

  // Alternative: raw query via execute_sql (if available through SDK)
  const { data: samplePosts, error } = await supabase
    .from('posts')
    .select('id, title, category_id, is_published, created_at')
    .not('telegram_message_id', 'is', null)
    .eq('is_published', true)
    .limit(5)

  console.log('Пример постов с is_published=true:')
  if (error) {
    console.error('Ошибка:', error)
  } else {
    console.log(`Получено: ${samplePosts?.length} постов`)
    samplePosts?.forEach((p, i) => {
      console.log(`  ${i+1}. ID: ${p.id}`)
      console.log(`     Title: ${p.title?.substring(0, 50)}...`)
      console.log(`     category_id: ${p.category_id}`)
      console.log(`     created_at: ${p.created_at}`)
    })
  }

  // Check posts without filter
  console.log('\nТест 2: Без фильтра is_published')
  const { data: allPosts2 } = await supabase
    .from('posts')
    .select('id, category_id, is_published')
    .not('telegram_message_id', 'is', null)
    .limit(3)

  if (allPosts2) {
    console.log(`Получено: ${allPosts2.length} постов`)
    allPosts2.forEach((p, i) => {
      console.log(`  ${i+1}. is_published: ${p.is_published}, category_id: ${p.category_id}`)
    })
  }

  // Check if RLS is blocking
  console.log('\nТест 3: Проверка через service role (уходит RLS)')
  const { count: countServiceRole } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .not('telegram_message_id', 'is', null)
    .eq('is_published', true)

  console.log(`Count с service role: ${countServiceRole}`)
}

debug().catch(console.error)
