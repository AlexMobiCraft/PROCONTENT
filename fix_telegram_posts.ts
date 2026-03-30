/**
 * Фикс для импортированных Telegram постов:
 * 1. Обновляет updated_at для всех постов с telegram_message_id
 * 2. Проверяет что is_published = true для всех
 * 3. Проверяет что author_id правильный
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DRY_RUN = process.argv.includes('--dry-run')

async function run() {
  console.log(DRY_RUN ? '=== DRY RUN ===\n' : '=== Фикс Telegram постов ===\n')

  // 1. Проверяем все ли посты опубликованы
  console.log('1️⃣  Проверка is_published...')
  const { data: notPublished } = await supabase
    .from('posts')
    .select('id')
    .eq('is_published', false)
    .not('telegram_message_id', 'is', null)

  if (notPublished && notPublished.length > 0) {
    console.log(`⚠️  Найдено ${notPublished.length} неопубликованных постов`)

    if (!DRY_RUN) {
      const { error } = await supabase
        .from('posts')
        .update({ is_published: true })
        .eq('is_published', false)
        .not('telegram_message_id', 'is', null)

      if (error) {
        console.error('Ошибка:', error)
      } else {
        console.log(`✓ Обновлено: ${notPublished.length} постов (is_published → true)`)
      }
    }
  } else {
    console.log('✓ Все посты опубликованы')
  }

  // 2. Обновляем updated_at (устанавливаем в текущий момент)
  console.log('\n2️⃣  Обновление updated_at...')

  if (!DRY_RUN) {
    const { error, count } = await supabase
      .from('posts')
      .update({ updated_at: new Date().toISOString() })
      .not('telegram_message_id', 'is', null)

    if (error) {
      console.error('Ошибка:', error)
    } else {
      console.log(`✓ Обновлено: ${count} постов (updated_at → now())`)
    }
  } else {
    console.log('(dry-run) Будут обновлены все посты с telegram_message_id')
  }

  // 3. Проверяем author_id
  console.log('\n3️⃣  Проверка author_id...')
  const { data: wrongAuthor } = await supabase
    .from('posts')
    .select('id, author_id')
    .not('telegram_message_id', 'is', null)
    .not('author_id', 'is', null)

  const { data: adminUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .single()

  if (wrongAuthor && adminUser) {
    const wrongCount = wrongAuthor.filter((p) => p.author_id !== adminUser.id).length

    if (wrongCount > 0) {
      console.log(`⚠️  Найдено ${wrongCount} постов с неправильным author_id`)

      if (!DRY_RUN) {
        const { error, count } = await supabase
          .from('posts')
          .update({ author_id: adminUser.id })
          .not('telegram_message_id', 'is', null)
          .neq('author_id', adminUser.id)

        if (error) {
          console.error('Ошибка:', error)
        } else {
          console.log(`✓ Обновлено: ${count} постов (author_id → admin)`)
        }
      }
    } else {
      console.log('✓ Все посты имеют правильный author_id')
    }
  }

  // 4. Итоги
  console.log('\n' + '─'.repeat(60))
  console.log('ГОТОВО')
  console.log('─'.repeat(60))

  if (DRY_RUN) {
    console.log('\nЗапусти без --dry-run чтобы применить изменения.')
  } else {
    console.log('\n✓ Все фиксы применены.')
    console.log('💡 Обнови страницу в браузере (Ctrl+Shift+R) если фильтры всё ещё не работают.')
  }
}

run().catch((err) => {
  console.error('Критическая ошибка:', err)
  process.exit(1)
})
