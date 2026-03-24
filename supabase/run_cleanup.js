import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envLocalPath = path.join(__dirname, '../.env.local');
let password = 'ProContent2026'; // fallback

if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf-8');
  const passMatch = envContent.match(/Database password\s*-\s*([^\r\n]+)/i);
  if (passMatch) {
    password = passMatch[1].trim();
  }
}

const dbHost = 'aws-1-eu-north-1.pooler.supabase.com';
const dbPort = '6543';
const dbUser = 'postgres.fixiwavyrcmajyzuzand';
const connectionString = `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(password)}@${dbHost}:${dbPort}/postgres`;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log(`🧹 Cleaning up duplicates...`);
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'cleanup_duplicates.sql'), 'utf-8');
    const res = await pool.query(sql);
    console.log(`✅ Duplicates removed! Rows affected: ${res.rowCount}`);
    
    // Also count current rows to verify
    const countRes = await pool.query('SELECT count(*) FROM public.posts');
    console.log(`📊 Total posts now: ${countRes.rows[0].count}`);
  } catch (error) {
    console.error(`❌ Error logic:`, error.message);
  } finally {
    await pool.end();
  }
}

main();
