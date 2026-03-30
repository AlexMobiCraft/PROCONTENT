import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  // Get sample post with all columns
  const { data: sample } = await supabase
    .from('posts')
    .select()
    .not('telegram_message_id', 'is', null)
    .limit(1)

  if (sample && sample.length > 0) {
    const post = sample[0]
    console.log('Все колонки в посте:')
    Object.keys(post).forEach(key => {
      console.log(`  - ${key}: ${typeof post[key as keyof typeof post]}`)
    })
  }
}

check().catch(console.error)
