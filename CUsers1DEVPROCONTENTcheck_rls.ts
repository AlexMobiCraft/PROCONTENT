import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Anonymous client (like frontend)
const anonClient = createClient(publicUrl, anonKey)

// Service role (bypasses RLS)
const serviceClient = createClient(publicUrl, serviceKey)

async function check() {
  console.log('=== RLS Политики ===\n')

  console.log('Test 1: Anonymous client (frontend)')
  const { data: anonPosts, error: anonError } = await anonClient
    .from('posts')
    .select('id, title')
    .eq('is_published', true)
    .limit(3)

  if (anonError) {
    console.error('❌ Error:', anonError.message)
  } else {
    console.log(`✓ Anonymous CAN read: ${anonPosts?.length} posts`)
    if (anonPosts && anonPosts.length > 0) {
      anonPosts.slice(0, 2).forEach((p, i) => {
        console.log(`  ${i+1}. ${p.title?.substring(0, 40)}...`)
      })
    }
  }

  console.log('\nTest 2: Service role (backend, bypasses RLS)')
  const { count } = await serviceClient
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', true)

  console.log(`✓ Service role count: ${count} posts`)
}

check().catch(console.error)
