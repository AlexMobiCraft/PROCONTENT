#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Для этого проекта нужен Service Role Key
// Получите его в Supabase Dashboard → Settings → API
const projectUrl = 'https://fixiwavyrcmajyzuzand.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ Ошибка: SUPABASE_SERVICE_ROLE_KEY не установлена');
  console.log('\n💡 Нужна Service Role Key для этого проекта.');
  console.log('Пути получения:');
  console.log('1. Перейти на https://fixiwavyrcmajyzuzand.supabase.co/project/settings/api');
  console.log('2. Найти "Service Role Key"');
  console.log('3. Скопировать и установить переменную окружения: SUPABASE_SERVICE_ROLE_KEY');
  console.log('\nЛибо создайте .env.local с этим ключом');
  process.exit(1);
}

async function executeSql(sql, description) {
  console.log(`\n📝 ${description}`);

  try {
    const response = await fetch(`${projectUrl}/rest/v1/rpc/sql_query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || response.statusText);
    }

    console.log(`✅ Успешно!`);
  } catch (error) {
    console.error(`❌ Ошибка: ${error.message}`);
    throw error;
  }
}

async function main() {
  console.log(`🚀 Применяю миграции к ${projectUrl}\n`);

  try {
    // Читаем SQL файлы
    const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
    const migrationSql = fs.readFileSync(
      path.join(migrationsDir, '012_add_category_check_constraint.sql'),
      'utf-8'
    );

    const seedSql = fs.readFileSync(
      path.join(__dirname, 'supabase', 'seed_posts.sql'),
      'utf-8'
    );

    // Применяем
    await executeSql(migrationSql, 'Миграция: ADD CHECK constraint для категорий');
    await executeSql(seedSql, 'Seed: вставляем тестовые посты');

    console.log(`\n🎉 Все скрипты успешно применены!`);
  } catch (error) {
    console.error(`\n💥 Критическая ошибка`, error.message);
    process.exit(1);
  }
}

;(async () => {
  await main()
})()
