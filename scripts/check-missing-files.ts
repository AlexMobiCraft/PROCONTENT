import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { existsSync } from 'fs'
import { join } from 'path'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const BACKUP_BASE = 'supabase-backup/backups/20260516_062932/storage'

async function main() {
  console.log('=== Checking inline-images in posts ===')
  const { data: posts } = await supabase
    .from('posts')
    .select('id, title, content')
    .not('content', 'is', null)

  const inlineImages: { postId: string; src: string; path: string }[] = []

  for (const post of posts || []) {
    if (!post.content) continue
    const matches = post.content.matchAll(/<img[^>]+src="([^"]+)"/g)
    for (const match of matches) {
      const src = match[1]
      if (src.includes('/inline-images/')) {
        const pathMatch = src.match(/\/inline-images\/(.+)$/)
        if (pathMatch) {
          inlineImages.push({ postId: post.id, src, path: pathMatch[1] })
        }
      }
    }
  }

  console.log(`Found ${inlineImages.length} inline-image references`)

  let missingInStorage = 0
  let missingInBackup = 0

  for (const img of inlineImages) {
    const { data: exists } = await supabase.storage.from('inline-images').exists(img.path)
    const inBackup = existsSync(join(BACKUP_BASE, 'inline-images', img.path))
    if (!exists) {
      missingInStorage++
      console.log(`  MISSING in Storage: ${img.path} (post: ${img.postId})`)
      if (!inBackup) {
        missingInBackup++
        console.log(`    ALSO missing in backup`)
      } else {
        console.log(`    Available in backup`)
      }
    } else {
      console.log(`  OK: ${img.path}`)
    }
  }

  console.log(`\n=== Checking post_media ===`)
  const { data: mediaItems } = await supabase.from('post_media').select('id, post_id, url, thumbnail_url')
  let missingMedia = 0
  for (const item of mediaItems || []) {
    const pathMatch = item.url.match(/\/post_media\/(.+)$/)
    if (pathMatch) {
      const path = pathMatch[1]
      const { data: exists } = await supabase.storage.from('post_media').exists(path)
      const inBackup = existsSync(join(BACKUP_BASE, 'post_media', path))
      if (!exists) {
        missingMedia++
        console.log(`  MISSING in Storage: ${path} (post: ${item.post_id})`)
        if (!inBackup) console.log(`    ALSO missing in backup`)
        else console.log(`    Available in backup`)
      }
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`Inline-images: ${inlineImages.length} refs, ${missingInStorage} missing in storage, ${missingInBackup} missing in backup`)
  console.log(`Post media: ${mediaItems?.length || 0} refs, ${missingMedia} missing in storage`)
}

main().catch(console.error)
