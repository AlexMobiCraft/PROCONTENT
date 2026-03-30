import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  console.log('=== RLS Политики ===\n')

  // Get RLS policies for posts table
  const { data: policies, error } = await supabase.rpc('get_policies_for_table', {
    table_name: 'posts',
    schema_name: 'public'
  }).catch(() => ({ data: null, error: 'RPC not available' }))

  if (error) {
    console.log('Cannot read via RPC, checking manually...')
  }

  if (policies) {
    console.log('Policies on posts table:')
    policies.forEach((p: any) => {
      console.log(`  - ${p.policyname}: ${p.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'}`)
    })
  }

  // Try a simple select with authenticated user context
  // (simulating what frontend client would do)
  console.log('\n=== Test: Public read (is_published=true) ===')
  const { data: publicPosts, error: publicError } = await supabase
    .from('posts')
    .select('id')
    .eq('is_published', true)
    .limit(1)

  if (publicError) {
    console.error('❌ Error:', publicError.message)
  } else {
    console.log(`✓ Can read: ${publicPosts?.length} posts`)
  }

  // Try with service role (bypasses RLS)
  console.log('\n=== Test: Service role (bypasses RLS) ===')
  const { data: servicePosts, error: serviceError } = await supabase
    .from('posts')
    .select('id', { count: 'exact' })
    .eq('is_published', true)
    .limit(1)

  if (serviceError) {
    console.error('❌ Error:', serviceError.message)
  } else {
    console.log(`✓ Can read with service role`)
  }
}

check().catch(console.error)
