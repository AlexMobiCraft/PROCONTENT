#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Конфиг БД
const projectId = 'fixiwavyrcmajyzuzand';
const password = 'ProContent+2026';

const pool = new Pool({
  host: `db.${projectId}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: password,
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
    console.error(`❌ Ошибка: ${error.message}`);
    throw error;
  }
}

async function main() {
  console.log(`🚀 Подключаюсь к ${projectId}.supabase.co...`);

  try {
    // Проверка подключения
    const res = await pool.query('SELECT NOW()');
    console.log(`✅ Подключение успешно! Текущее время БД: ${res.rows[0].now}`);

    // Применяем миграции
    const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
    await applySql(
      path.join(migrationsDir, '012_add_category_check_constraint.sql'),
      'Миграция: CHECK constraint для категорий'
    );

    await applySql(
      path.join(__dirname, 'supabase', 'seed_posts.sql'),
      'Seed: тестовые посты'
    );

    console.log(`\n🎉 Все скрипты успешно применены!`);
  } catch (error) {
    console.error(`\n💥 Критическая ошибка:`, error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
