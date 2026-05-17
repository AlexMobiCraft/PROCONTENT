import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, content')
    .like('content', '%inline-image%')
    .limit(5)

  if (error) {
    console.error('Error:', error)
    return
  }

  if (!data || data.length === 0) {
    console.log('No posts with inline images found')
    return
  }

  for (const post of data) {
    console.log('\n--- Post:', post.id, post.title, '---')
    const imgMatches = post.content?.match(/<img[^>]+src="([^"]+)"/g) || []
    for (const match of imgMatches) {
      const srcMatch = match.match(/src="([^"]+)"/)
      if (srcMatch) {
        console.log('IMG SRC:', srcMatch[1])
      }
    }
  }
}

main().catch(console.error)
