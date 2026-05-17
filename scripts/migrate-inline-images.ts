import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

dotenv.config({ path: '.env.local' })

const NEW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const OLD_URL = 'https://esbutggkvetajkuvrjcb.supabase.co'
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY

if (!NEW_URL || !NEW_KEY) {
  console.error('Missing NEW Supabase credentials in .env.local')
  process.exit(1)
}

if (!OLD_KEY) {
  console.error('Set OLD_SUPABASE_SERVICE_ROLE_KEY env var for old project')
  process.exit(1)
}

const newClient = createClient(NEW_URL, NEW_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const oldClient = createClient(OLD_URL, OLD_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('Fetching posts with inline-images from NEW project...')
  const { data: posts, error } = await newClient
    .from('posts')
    .select('id, content')
    .not('content', 'is', null)

  if (error) {
    console.error('Error fetching posts:', error)
    process.exit(1)
  }

  const targets: { postId: string; path: string }[] = []

  for (const post of posts || []) {
    if (!post.content) continue
    const matches = post.content.matchAll(/\/inline-images\/([^"\s]+)/g)
    for (const match of matches) {
      const path = match[1]
      targets.push({ postId: post.id, path })
    }
  }

  if (targets.length === 0) {
    console.log('No inline-image references found')
    return
  }

  const uniquePaths = [...new Map(targets.map((t) => [t.path, t])).values()]
  console.log(`Found ${uniquePaths.length} unique inline-image files to migrate`)

  let success = 0
  let failed = 0
  let alreadyExists = 0

  for (const { path } of uniquePaths) {
    const { data: exists } = await newClient.storage.from('inline-images').exists(path)
    if (exists) {
      alreadyExists++
      console.log(`  SKIP (exists): ${path}`)
      continue
    }

    console.log(`  DOWNLOAD: ${path}`)
    const { data: blob, error: downloadError } = await oldClient.storage
      .from('inline-images')
      .download(path)

    if (downloadError || !blob) {
      console.error(`    FAILED download: ${downloadError?.message || 'unknown'}`)
      failed++
      continue
    }

    const { error: uploadError } = await newClient.storage
      .from('inline-images')
      .upload(path, blob, { upsert: false, cacheControl: '3600' })

    if (uploadError) {
      console.error(`    FAILED upload: ${uploadError.message}`)
      failed++
      continue
    }

    console.log(`    OK: ${path}`)
    success++
  }

  console.log(`\nDone. Success: ${success}, Already exists: ${alreadyExists}, Failed: ${failed}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
