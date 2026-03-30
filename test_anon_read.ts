import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// Anonymous client (like frontend)
const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function test() {
  console.log('Testing anonymous client read...\n')

  const { data, error, count } = await anonClient
    .from('posts')
    .select('id, title', { count: 'exact' })
    .eq('is_published', true)
    .limit(3)

  if (error) {
    console.error('❌ RLS blocks read:', error.message)
  } else {
    console.log(`✓ Anonymous can read ${count} published posts`)
    data?.slice(0, 2).forEach((p, i) => {
      console.log(`  ${i+1}. ${p.title?.substring(0, 40)}...`)
    })
  }
}

test().catch(console.error)
