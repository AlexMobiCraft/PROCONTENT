import { createClient } from '@supabase/supabase-js'

const OLD_URL = 'https://esbutggkvetajkuvrjcb.supabase.co'
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY

if (!OLD_KEY) {
  console.error('Missing OLD_SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const old = createClient(OLD_URL, OLD_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('Checking old project...')
  const { data, error } = await old.storage.listBuckets()
  console.log('Buckets:', data)
  console.log('Error:', error)

  if (data) {
    const bucket = data.find((b) => b.name === 'inline-images')
    if (bucket) {
      console.log('\nBucket inline-images found, public:', bucket.public)
      const { data: files, error: listError } = await old.storage.from('inline-images').list('editor')
      console.log('Files in editor folder:', files)
      console.log('List error:', listError)
    }
  }
}

main().catch(console.error)
