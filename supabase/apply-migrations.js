#!/usr/bin/env node

import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Конфигурация ─────────────────────────────────────────────────────────────
// Пытаемся автоматически найти пароль в .env.local (даже в комментариях)
const envLocalPath = path.join(__dirname, '../.env.local');
let password = 'ProContent2026'; // fallback
let source = 'fallback';

if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf-8');
  const passMatch = envContent.match(/Database password\s*-\s*([^\r\n]+)/i);
  if (passMatch) {
    password = passMatch[1].trim();
    source = '.env.local comment';
  }
}

// Если db.ID... не работает (из-за IPv6), используйте Pooler Host (порт 6543)
const dbHost = process.env.DB_HOST || 'aws-1-eu-north-1.pooler.supabase.com';
const dbPort = process.env.DB_PORT || '6543';
const dbUser = process.env.DB_USER || 'postgres.fixiwavyrcmajyzuzand';

// КРИТИЧНО: Для ConnectionString спецсимволы (+, @, :) должны быть закодированы
const connectionString = `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(password)}@${dbHost}:${dbPort}/postgres`;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function applySql(filePath, description) {
  const sql = fs.readFileSync(filePath, 'utf-8');
  console.log(`\n📝 Применяю: ${description}`);
  console.log(`Файл: ${path.basename(filePath)}`);

  try {
    await pool.query(sql);
    console.log(`✅ Успешно!`);
  } catch (error) {
    if (error.message.includes('already exists') || 
        error.message.includes('already a member') || 
        error.message.includes('already exists, skipping')) {
      console.log(`ℹ️ Элемент уже существует, пропускаю.`);
    } else {
      console.error(`❌ Ошибка: ${error.message}`);
      throw error;
    }
  }
}

async function main() {
  console.log(`🚀 Подключаюсь к ${dbHost}:${dbPort} как ${dbUser}...`);
  console.log(`🔑 Источник пароля: ${source} (длина: ${password.length} символов)`);

  try {
    // Проверка подключения
    const res = await pool.query('SELECT NOW()');
    console.log(`✅ Подключение успешно! Текущее время БД: ${res.rows[0].now}`);

    // Применяем ВСЕ миграции из папки migrations в алфавитном порядке
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Важно: запуск по порядку 001, 002...

    console.log(`\n📂 Найдено миграций: ${files.length}`);

    for (const file of files) {
      await applySql(
        path.join(migrationsDir, file),
        `Миграция: ${file}`
      );
    }

    // В конце запускаем сид (только если передан флаг --seed)
    if (process.argv.includes('--seed')) {
      await applySql(
        path.join(__dirname, 'seed_posts.sql'),
        'Seed: тестовые посты'
      );
    } else {
      console.log(`\nℹ️ Сидирование пропущено (флаг --seed не передан).`);
    }

    console.log(`\n🎉 Все скрипты успешно применены!`);
  } catch (error) {
    console.error(`\n💥 Критическая ошибка:`, error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

;(async () => {
  await main()
})()
