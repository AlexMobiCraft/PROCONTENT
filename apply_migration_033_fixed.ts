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

  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationContent
    })

    if (error) throw error
    console.log('✓ Migration applied successfully')
  } catch (err) {
    console.error('⚠️  Could not apply via RPC function')
    console.log('\n📋 Please run manually in Supabase SQL Editor:')
    console.log('https://supabase.com/dashboard/project/tmqamxnrmqmqpfkgbcpe/sql/new')
    console.log('\nPaste this SQL:')
    console.log(migrationContent)
  }
}

apply()
