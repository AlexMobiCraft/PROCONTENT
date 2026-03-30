import pg from 'pg'

const { Pool } = pg

async function check() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    const result = await pool.query(`
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        qual,
        with_check
      FROM pg_policies
      WHERE tablename = 'posts'
      ORDER BY policyname
    `)

    console.log('=== RLS Политики на posts ===\n')
    if (result.rows.length === 0) {
      console.log('❌ NO RLS POLICIES FOUND!')
      console.log('\nПроверка RLS включён?')
      const rls = await pool.query(`
        SELECT relname, relrowsecurity
        FROM pg_class
        WHERE relname = 'posts'
      `)
      console.log(`RLS enabled: ${rls.rows[0]?.relrowsecurity}`)
    } else {
      result.rows.forEach(row => {
        console.log(`Policy: ${row.policyname}`)
        console.log(`  Permissive: ${row.permissive}`)
        console.log(`  Roles: ${row.roles}`)
        console.log(`  SELECT (qual): ${row.qual}`)
        if (row.with_check) {
          console.log(`  UPDATE/DELETE (with_check): ${row.with_check}`)
        }
        console.log()
      })
    }
  } finally {
    await pool.end()
  }
}

check().catch(console.error)
