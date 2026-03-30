import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function test() {
  console.log('=== Testing all RLS policies for frontend ===\n')

  // Test posts
  const { count: postsCount } = await anonClient
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', true)

  console.log(`✓ posts (is_published=true): ${postsCount}`)

  // Test post_media
  const { data: mediaSample, error: mediaError } = await anonClient
    .from('post_media')
    .select('*')
    .limit(1)

  if (mediaError) {
    console.log(`❌ post_media: ${mediaError.message}`)
  } else {
    console.log(`✓ post_media: can read (${mediaSample?.length || 0} sample)`)
  }

  // Test categories
  const { data: catSample, error: catError } = await anonClient
    .from('categories')
    .select('*')
    .limit(1)

  if (catError) {
    console.log(`❌ categories: ${catError.message}`)
  } else {
    console.log(`✓ categories: can read (${catSample?.length || 0} sample)`)
  }

  // Test profiles (for author data)
  const { data: profileSample, error: profileError } = await anonClient
    .from('profiles')
    .select('*')
    .limit(1)

  if (profileError) {
    console.log(`❌ profiles: ${profileError.message}`)
  } else {
    console.log(`✓ profiles: can read (${profileSample?.length || 0} sample)`)
  }

  // Test full posts with joins
  console.log('\n=== Testing posts query with joins ===')
  const { data: postsWithJoins, error: joinError } = await anonClient
    .from('posts')
    .select('*, profiles!author_id(display_name, avatar_url), post_media(id, media_type, url, thumbnail_url, order_index, is_cover), is_liked:posts_is_liked')
    .eq('is_published', true)
    .limit(2)

  if (joinError) {
    console.error('❌ Posts with joins failed:', joinError.message)
  } else {
    console.log(`✓ Posts with joins: ${postsWithJoins?.length} posts`)
    if (postsWithJoins && postsWithJoins.length > 0) {
      console.log(`  Sample: ${postsWithJoins[0].title?.substring(0, 40)}...`)
      console.log(`  Author: ${(postsWithJoins[0] as any).profiles?.display_name}`)
    }
  }
}

test().catch(console.error)
