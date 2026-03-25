#!/usr/bin/env node

import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Конфигурация (копия из apply-migrations.js) ──────────────────────────────
const envLocalPath = path.join(__dirname, '../.env.local');
let password = 'ProContent2026'; // fallback
let source = 'fallback';

if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf-8');
  // Ищем пароль в комментариях (там есть "Database password - ...")
  const passMatch = envContent.match(/Database password\s*-\s*([^\s\r\n]+)/i);
  if (passMatch) {
    password = passMatch[1].trim();
    source = '.env.local';
  }
}

const dbHost = process.env.DB_HOST || 'aws-1-eu-north-1.pooler.supabase.com';
const dbPort = process.env.DB_PORT || '6543';
const dbUser = process.env.DB_USER || 'postgres.esbutggkvetajkuvrjcb';

const connectionString = `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(password)}@${dbHost}:${dbPort}/postgres`;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const seedFile = path.join(__dirname, 'seed_gallery_test_2_4.sql');
  console.log(`🚀 Подключаюсь к ${dbHost}:${dbPort}...`);
  
  try {
    const res = await pool.query('SELECT NOW()');
    console.log(`✅ Подключение успешно!`);

    const sql = fs.readFileSync(seedFile, 'utf-8');
    console.log(`📝 Выполняю сид из ${path.basename(seedFile)}...`);
    
    await pool.query(sql);
    console.log(`✅ Тестовые посты созданы!`);
  } catch (error) {
    console.error(`❌ Ошибка:`, error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
