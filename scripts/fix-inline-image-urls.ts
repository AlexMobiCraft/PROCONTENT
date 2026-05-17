import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, content')
    .like('content', '%/storage/v1/object/public/%')

  if (error) {
    console.error('Error fetching posts:', error)
    process.exit(1)
  }

  if (!posts || posts.length === 0) {
    console.log('No posts with inline images found')
    return
  }

  const first = posts.find((p) => p.content?.includes('/storage/v1/object/public/'))
  if (!first || !first.content) {
    console.log('Could not find any inline image URLs')
    return
  }

  const match = first.content.match(/(https?:\/\/[^/]+)\/storage\/v1\/object\/public\//)
  if (!match) {
    console.log('Could not extract old domain from content')
    return
  }

  const oldDomain = match[1]
  const newDomain = SUPABASE_URL!.replace(/\/$/, '')

  if (oldDomain === newDomain) {
    console.log('Old and new domains are the same — nothing to fix')
    return
  }

  console.log(`Replacing: ${oldDomain} → ${newDomain}`)
  console.log(`Posts to update: ${posts.length}`)

  let updated = 0
  for (const post of posts) {
    if (!post.content) continue
    const newContent = post.content.replaceAll(oldDomain, newDomain)
    if (newContent !== post.content) {
      const { error: updateError } = await supabase
        .from('posts')
        .update({ content: newContent, updated_at: new Date().toISOString() })
        .eq('id', post.id)
      if (updateError) {
        console.error(`Failed to update post ${post.id}:`, updateError)
      } else {
        updated++
      }
    }
  }

  console.log(`Updated ${updated} posts`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
