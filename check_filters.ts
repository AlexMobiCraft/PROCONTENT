import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  console.log('=== Проверка данных для фильтров ===\n')

  // Check categories
  const { data: categories } = await supabase
    .from('categories')
    .select('id, slug, name')
    .order('name')

  console.log('Категории:')
  if (categories) {
    console.log(`  Всего: ${categories.length}`)
    categories.forEach(c => {
      console.log(`    - ${c.slug}: ${c.name}`)
    })
  }

  // Check posts by category
  console.log('\nПосты по категориям:')
  if (categories) {
    for (const cat of categories.slice(0, 3)) {
      const { count } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', cat.id)
        .eq('is_published', true)

      console.log(`  ${cat.slug}: ${count}`)
    }
  }

  // Check posts order
  const { data: latestPosts } = await supabase
    .from('posts')
    .select('id, title, created_at, updated_at, category_id')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(5)

  console.log('\nПоследние посты (по created_at):')
  if (latestPosts) {
    latestPosts.forEach((p, i) => {
      console.log(`  ${i+1}. ${p.title?.substring(0, 40)}... (created: ${p.created_at})`)
    })
  }

  // Check if there are any posts at all
  const { count: totalPosts } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', true)

  console.log(`\nВсего опубликованных постов: ${totalPosts}`)
}

check().catch(console.error)
