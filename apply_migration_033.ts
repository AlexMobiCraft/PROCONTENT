import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { join } from 'path'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function apply() {
  console.log('=== Applying Migration 033 ===\n')

  const migrationContent = readFileSync(
    join(process.cwd(), 'supabase/migrations/033_add_posts_anon_read_policy.sql'),
    'utf-8'
  )

  console.log('SQL to apply:')
  console.log(migrationContent)
  console.log('\n')

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: migrationContent
  }).catch(err => ({ data: null, error: err }))

  if (error) {
    console.error('❌ Error:', error)
    console.log('\nTrying direct approach via Supabase dashboard...')
    console.log('1. Go to https://supabase.com/dashboard/project/tmqamxnrmqmqpfkgbcpe/sql')
    console.log('2. Paste the SQL above')
    console.log('3. Execute')
  } else {
    console.log('✓ Migration applied successfully')
  }
}

apply().catch(console.error)
