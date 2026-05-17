import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const path = 'editor/d88fc14f-f04f-4c88-8153-36178d1f2e92/IMG_3412.jpeg'
  const bucket = 'inline-images'

  console.log('Checking bucket:', bucket)
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
  if (bucketError) {
    console.error('Error listing buckets:', bucketError)
    return
  }
  console.log('Available buckets:', buckets.map((b) => b.name))

  console.log('\nChecking file:', path)
  const { data: fileData, error: fileError } = await supabase.storage.from(bucket).list(path.split('/').slice(0, -1).join('/'))
  if (fileError) {
    console.error('Error listing files:', fileError)
    return
  }
  console.log('Files in folder:', fileData)

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path)
  console.log('\nPublic URL:', publicUrlData.publicUrl)
}

main().catch(console.error)
