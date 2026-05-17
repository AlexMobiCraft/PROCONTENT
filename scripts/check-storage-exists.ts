import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const bucket = 'inline-images'
  const path = 'editor/d88fc14f-f04f-4c88-8153-36178d1f2e92/IMG_3412.jpeg'

  console.log('Domain:', process.env.NEXT_PUBLIC_SUPABASE_URL)

  const { data: buckets } = await supabase.storage.listBuckets()
  console.log('Buckets:', buckets?.map((b) => ({ name: b.name, public: b.public })))

  const { data: listData, error: listError } = await supabase.storage.from(bucket).list('editor')
  console.log('List editor folder:', { data: listData, error: listError })

  const { data: existsData, error: existsError } = await supabase.storage.from(bucket).exists(path)
  console.log('File exists:', { data: existsData, error: existsError })
}

main().catch(console.error)
