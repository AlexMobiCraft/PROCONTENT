---
title: 'Настройка профиля пользователя: регистрация с именем и управление аватаром'
type: 'feature'
created: '2026-03-30'
status: 'in-review'
baseline_commit: 'a8c8a3f357d7fd66240fa3282c492c30b0c32bd9'
context:
  - src/CLAUDE.md
  - Архитектура PROCONTENT (Smart Container/Dumb UI, RSC + Client Components)
---

<frozen-after-approval reason="намерение, определённое пользователем — не изменять без переговоров">

## Намерение

**Проблема:** Новые пользователи при регистрации не могут указать своё имя (необходимо для персонализации). Существующие профили не имеют функции загрузки аватара, что ограничивает возможности персонализации.

**Подход:** Расширить форму регистрации для сбора `first_name` (обязательно, ≥3 символа) и `last_name` (опционально). Добавить карточку редактирования профиля с загрузкой аватара в Supabase Storage. Обновить типы и схему БД для поддержки этих полей.

## Границы и ограничения

**Всегда:**
- Именование БД: `snake_case` напрямую из БД (без маппинга в camelCase)
- Язык UI: Словенский везде
- Хранилище аватаров: Supabase Storage bucket `avatars`
- Валидация: `first_name` минимум 3 символа, символы разрешены
- Паттерн Smart Container/Dumb UI: компоненты формы получают данные + callbacks, без импортов Store/Supabase
- RSC для загрузки данных, Client компоненты для интерактивности
- Оптимистичные обновления где уместно (редактирование профиля)

**Уточнить у пользователя:**
- Изменения структуры хранилища Supabase Storage или RLS политик
- Модификации auth flow помимо формы регистрации

**Запрещено:**
- Хранить чувствительные auth данные на клиенте
- Обходить валидацию формы на клиенте
- Напрямую изменять Supabase auth.users (только через Supabase auth API)
- Нарушать существующую функциональность профиля (подписка, email preferences, admin links)

## Матрица сценариев ввода/вывода

| Сценарий | Входные данные / Состояние | Ожидаемый результат / Поведение | Обработка ошибок |
|----------|---------------------------|--------------------------------|------------------|
| **Happy Path: Регистрация с именем** | Пользователь заполняет first_name (≥3 символа), пароль, отправляет | Строка `profiles` создана с first_name + last_name, пользователю отправлено письмо подтверждения | N/A |
| **Регистрация: first_name слишком короткое** | Пользователь вводит "ab", пытается отправить | Форма показывает ошибку "Najmanj 3 znaki" в строке | Заблокировать отправку |
| **Регистрация: first_name пусто** | Пользователь пропускает поле, отправляет | Форма показывает ошибку "Polje je obvezno" | Заблокировать отправку |
| **Успешная загрузка аватара** | Пользователь выбирает изображение <5МБ, нажимает загрузить | Файл загружен в `avatars/` в Storage, profile.avatar_url обновлён, UI показывает новое изображение | N/A |
| **Ошибка загрузки аватара** | Загрузка файла провалилась (сетевая ошибка), пользователь повторяет | Показать ошибку toast, откатить UI к старому аватару, разрешить повтор | Toast ошибки, откатить аватар к предыдущему URL |
| **Оптимистичное редактирование профиля** | Пользователь редактирует first_name, отправляет до ответа | UI обновляется сразу; при ошибке откатывает к старому значению | Toast ошибки, откатить first_name в UI |

</frozen-after-approval>

## Карта кода

- `supabase/migrations/036_add_user_profile_fields.sql` -- Добавить first_name, last_name в таблицу profiles; исправить trigger (ON CONFLICT DO NOTHING); добавить CHECK constraints
- `src/types/supabase.ts` -- Обновить тип Database с first_name, last_name в profiles
- `src/features/auth/components/RegisterForm.tsx` -- Собирать поля first_name + last_name
- `src/features/auth/components/RegisterContainer.tsx` -- Обновить profiles после регистрации; отображать ошибку пользователю при сбое; trim перед сохранением
- `src/features/profile/components/ProfileEditCard.tsx` -- Новая: Редактирование first_name + загрузка аватара; блокировка конкурентных загрузок; trim валидация; cleanup orphaned files
- `src/features/profile/api/profileApi.ts` -- Обновить профиль (оптимистично), загрузить аватар; MIME type + empty file validation
- `src/features/profile/components/ProfileScreen.tsx` -- Интегрировать ProfileEditCard
- `tests/unit/features/auth/RegisterForm.test.tsx` -- Валидировать минимальную длину first_name
- `tests/unit/features/profile/ProfileEditCard.test.tsx` -- Avatar upload happy/error пути; тест блокировки concurrent uploads
- `tests/unit/features/profile/profileApi.test.ts` -- **НОВЫЙ**: Тесты uploadAvatar (0-byte, >5MB, invalid MIME, valid); deleteAvatarFile (malformed URL, path extraction); updateProfile (not found)

## Задачи и критерии приёма

### Фаза 1 — Базовая реализация (выполнена)

**Исполнение:**
- [x] `supabase/migrations/036_add_user_profile_fields.sql` -- Создать миграцию, добавляющую first_name (NOT NULL VARCHAR), last_name (NULL VARCHAR), обновить handle_new_user для инициализации этих полей
- [x] `src/types/supabase.ts` -- Добавить first_name + last_name в типы profiles Row/Insert/Update (codegen или ручная синхронизация)
- [x] `src/features/auth/components/RegisterForm.tsx` -- Добавить input поля для first_name + last_name с валидацией; экспортировать данные onSubmit с этими полями
- [x] `src/features/auth/components/RegisterContainer.tsx` -- После успешного signUp вызвать supabase.from('profiles').update({ first_name, last_name }) для заполнения этих полей
- [x] `src/features/profile/api/profileApi.ts` -- Новый файл с функциями updateProfile() и uploadAvatar(); оптимистичное обновление + откат при ошибке
- [x] `src/features/profile/components/ProfileEditCard.tsx` -- Новый dumb компонент: текстовое поле для first_name, file input для аватара, отображает текущее изображение аватара
- [x] `src/features/profile/components/ProfileScreen.tsx` -- Импортировать ProfileEditCard как smart container; передать userId + текущие данные профиля
- [x] `tests/unit/features/auth/RegisterForm.test.tsx` -- Тестировать валидацию first_name (мин 3 символа, пусто отклоняется)
- [x] `tests/unit/features/profile/ProfileEditCard.test.tsx` -- Тестировать успех/ошибку загрузки аватара, редактирование first_name + откат

### Фаза 2 — Критические исправления (Critical Fixes Execution Plan)

> **Источник:** `_bmad-output/critical-fixes-execution-plan.md` · 7 блокирующих проблем из Code Review Round 1

**Исполнение:**

- [x] **Fix #2** — `supabase/migrations/036_add_user_profile_fields.sql` — Исправить trigger `handle_new_user`: заменить `ON CONFLICT DO UPDATE` на `ON CONFLICT DO NOTHING`, чтобы повторная вставка не перезаписывала first_name пустой строкой
- [x] **Fix #7** — `supabase/migrations/036_add_user_profile_fields.sql` — Добавить CHECK constraints: `check_first_name_not_empty`, `check_first_name_min_length` (≥3), `check_first_name_max_length` (≤100), `check_last_name_max_length` (≤100 или NULL)
- [x] **Fix #1** — `src/features/profile/components/ProfileEditCard.tsx` — Trim bug: создать `const trimmed = editedName.trim()`, использовать `trimmed` для проверки длины и передачи в `updateProfile(); также передавать trimmed в `onProfileUpdate`
- [x] **Fix #3** — `src/features/profile/components/ProfileEditCard.tsx` — Блокировка concurrent uploads: добавить guard `if (!file || isLoading) return` в начало `handleAvatarUpload`; ввести `uploadedAvatarUrl` tracking variable для корректного rollback
- [x] **Fix #6** — `src/features/profile/components/ProfileEditCard.tsx` — Cleanup orphaned avatar: в catch-блоке `handleAvatarUpload` удалять файл из Storage если `uploadedAvatarUrl` установлен (best-effort, не бросать)
- [x] **Fix #4** — `src/features/auth/components/RegisterContainer.tsx` — Устранить silent error: при `updateError` показывать `setError('Napaka pri shranjevanju podatkov profila...')`, вызывать `return`; trim first_name/last_name перед update
- [x] **Fix #5** — `src/features/profile/api/profileApi.ts` — Добавить валидацию в `uploadAvatar()`: проверка MIME type (jpeg/png/gif/webp), проверка 0-byte файла (до проверки размера)
- [x] **Fix #8** — `tests/unit/features/profile/profileApi.test.ts` (**НОВЫЙ ФАЙЛ**) — Написать тесты: `uploadAvatar` (0-byte, >5MB, invalid MIME, valid 5MB), `deleteAvatarFile` (malformed URL, корректное извлечение пути), `updateProfile` (профиль не найден)
  - [x] Добавить тест в `ProfileEditCard.test.tsx`: блокировка concurrent uploads (два быстрых вызова → только один upload)

**Критерии приёма:**

_Базовые (Фаза 1):_
- Дано: новый пользователь на форме регистрации; когда: заполняет first_name="Ana" + пароль + отправляет; тогда: строка profiles создана с first_name="Ana" + last_name=NULL
- Дано: пользователь на форме регистрации; когда: заполняет first_name="ab" + пароль + отправляет; тогда: форма показывает встроенную ошибку "Najmanj 3 znaki" и блокирует отправку
- Дано: пользователь просматривает свой профиль; когда: загружает PNG изображение 2МБ; тогда: avatar_url обновляется в БД + UI отображает новое изображение в течение 1 сек
- Дано: профиль пользователя с аватаром; когда: загрузка аватара не удаётся (ошибка сети); тогда: показана ошибка toast + аватар откатился к предыдущему URL + пользователь может повторить

_Критические исправления (Фаза 2):_
- Дано: `handleSaveName` с first_name="  Ana  "; тогда: в БД сохраняется "Ana" (trimmed), длина проверяется по trimmed значению
- Дано: trigger `handle_new_user` срабатывает при повторном auth событии; тогда: `ON CONFLICT DO NOTHING` — first_name в profiles не перезаписывается
- Дано: два быстрых клика загрузки аватара; тогда: только один upload выполняется; второй блокируется guard'ом `isLoading`
- Дано: `uploadAvatar()` успешен, но `updateProfile()` падает; тогда: orphaned файл удаляется из Storage (best-effort)
- Дано: `RegisterContainer` — profile update завершается с ошибкой; тогда: пользователь видит сообщение об ошибке (не тихий `console.warn`)
- Дано: `uploadAvatar` вызван с файлом `text/plain`; тогда: выбрасывается ошибка "Samo slike (JPEG, PNG, GIF, WebP) so dovoljene"
- Дано: `uploadAvatar` вызван с 0-byte файлом; тогда: выбрасывается ошибка "Datoteka ne sme biti prazna"
- Дано: CHECK constraints в БД; тогда: insert с first_name длиной 1-2 символа отклоняется на уровне БД
- `npm run test -- profileApi.test.ts ProfileEditCard.test.tsx` — все тесты проходят 100%

## История изменений спеки

### Code Review Round 1 (Adversarial General) - 2026-03-30

**Findings от Blind Hunter adversarial review:**

**🔴 КРИТИЧЕСКИЕ (требуют исправления):**
1. **first_name валидация только на клиенте** — HTML5 `required` и `minLength=3` легко обходятся. Нет server-side валидации перед insert/update.
2. **Race condition: signup → profile update** — Если trigger `handle_new_user` запоздает, UPDATE может выполниться на несуществующий row.
3. **Orphaned avatar files в Storage** — Если `uploadAvatar()` успешен но `updateProfile()` провалится, файл остаётся навечно.
4. **Avatar upload без server-side валидации** — `MAX_AVATAR_SIZE` только на клиенте. Пользователь может обойти через API.
5. **Отсутствует MIME type validation** — Пользователь может загрузить опасный файл (`.jpg.exe`).
6. **registerContainer: updateError просто логируется** — Ошибка profile update не показана пользователю.

**🟡 СРЕДНИЕ (логические ошибки):**
7. **last_name может быть пробелы** — Нет `trim()` перед сохранением.
8. **Отсутствует maxLength для first_name** — Можно ввести 10000+ символов.
9. **Concurrent avatar uploads не заблокированы** — Несколько параллельных загрузок возможны.
10. **deleteAvatarFile URL парсинг fragile** — Regex может провалиться на спецсимволах.

**🟠 АРХИТЕКТУРНЫЕ:**
11. **Триггер handle_new_user может перезаписать данные** — ON CONFLICT может перезаписать first_name на пустую строку.
12. **Filename санитизация слабая** — `generateAvatarPath()` использует `file.name` без escaping (может содержать `../`).
13. **Тесты используют mock вместо integration** — Нет real Supabase тестов.

**Рекомендуемая последовательность исправления:**
- HIGH: Server-side валидация first_name, MIME type validation, avatar size validation
- HIGH: Обработка ошибок profile update для пользователя
- HIGH: Блокировка concurrent avatar uploads
- MEDIUM: Санитизация filename, trim() для last_name, maxLength
- LOW: Integration tests для avatar upload

**Статус устранения:** → Все 8 исправлений внесены в `_bmad-output/critical-fixes-execution-plan.md` и добавлены в задачи Фазы 2 выше.

### Critical Fixes Plan - 2026-03-30

**Источник:** `_bmad-output/critical-fixes-execution-plan.md`

**7 блокирующих проблем, 8 исправлений, ~2 часа выполнения:**

| Fix | Файл | Проблема | Решение |
|-----|------|----------|---------|
| **#1** | `ProfileEditCard.tsx` | Trim bug: длина проверяется до trim → "  ab  " проходит валидацию | `const trimmed = editedName.trim()`, проверять и сохранять `trimmed` |
| **#2** | `036_add_user_profile_fields.sql` | `ON CONFLICT DO UPDATE` перезаписывает first_name пустой строкой | `ON CONFLICT DO NOTHING` |
| **#3** | `ProfileEditCard.tsx` | Race condition: concurrent avatar uploads | Guard `if (!file \|\| isLoading) return`; track `uploadedAvatarUrl` |
| **#4** | `RegisterContainer.tsx` | Silent profile update error (только `console.warn`) | Show `setError(...)` + `return` + trim перед сохранением |
| **#5** | `profileApi.ts` | Нет MIME type / 0-byte validation | Проверять `file.type in allowedMimes` и `file.size === 0` |
| **#6** | `ProfileEditCard.tsx` | Orphaned avatar files в Storage | В catch: `deleteAvatarFile(uploadedAvatarUrl)` (best-effort) |
| **#7** | `036_add_user_profile_fields.sql` | Нет DB-level length constraints | CHECK constraints: min 3, max 100 для first_name; max 100 для last_name |
| **#8** | `tests/…/profileApi.test.ts` (NEW) | Нет юнит-тестов для profileApi | Тесты: uploadAvatar, deleteAvatarFile, updateProfile + тест concurrent uploads |

**Порядок применения:** Fix #2 → #1 → #3 → #4 → #5 → #6 (входит в #3) → #7 (входит в #5) → #8

## Заметки о дизайне

**Путь загрузки аватара:** Отразить паттерн post_media — хранить в `avatars/{userId}/{uuid}/filename`. Это изолирует аватары пользователей и позволяет будущим cleanup job'ам работать без конфликтов.

**Оптимистичные обновления в ProfileEditCard:** Обновить UI сразу при отправке формы, затем синхронизировать с сервером. При ошибке (например, конкурентное обновление профиля) откатить к старому значению и показать ошибку toast. Это совпадает с существующим паттерном FeedContainer для лайков.

**Валидация first_name:** HTML5 `required` + minLength=3 на input; JS валидация в handleSubmit как fallback. Отображать встроенную ошибку под полем ввода (не как отдельный alert).

**last_name опционально:** Нет валидации помимо ограничения maxLength из БД (если есть). Разрешить пустую строку = NULL в БД.

## Проверка

**Команды:**
- `npm run typecheck` -- TypeScript типы для новых полей разрешаются без ошибок
- `npm run test -- RegisterForm ProfileEditCard profileApi` -- Unit тесты проходят для сценариев валидации + загрузки + profileApi edge cases
- `npm run lint` -- Нет ESLint нарушений в новых/изменённых файлах

**Дополнительные проверки после Critical Fixes:**
- `npm run test -- profileApi.test.ts` -- Новые тесты: 0-byte, invalid MIME, >5MB, valid upload, malformed URL, path extraction, profile not found
- Ручная проверка trigger: зарегистрировать пользователя → проверить `profiles.first_name` = ожидаемое значение, не пустая строка
- Ручная проверка: два быстрых клика загрузки → только один файл загружен в Storage

**Ручные проверки (если нет CLI):**
- Поток регистрации: Заполнить first_name="Janez", пароль, отправить → таблица profiles показывает first_name="Janez"
- Страница профиля: Кнопка загрузки аватара видна + успешно загружает файл
- Редактирование профиля: Изменить first_name="Mateja", нажать сохранить → UI обновляется сразу, БД отражает изменение

## Suggested Review Order

**Точка входа: архитектура регистрации**

- Обновлена forma регистрации для сбора имени и фамилии с валидацией
  [`RegisterForm.tsx:1`](../../src/features/auth/components/RegisterForm.tsx#L1)

- Контейнер регистрации сохраняет имя в профиле после успешного signup
  [`RegisterContainer.tsx:20`](../../src/features/auth/components/RegisterContainer.tsx#L20)

**Управление профилем: редактирование и аватар**

- API функции для загрузки аватара и обновления профиля с оптимистичными обновлениями
  [`profileApi.ts:1`](../../src/features/profile/api/profileApi.ts#L1)

- Компонент редактирования профиля с валидацией и обработкой ошибок
  [`ProfileEditCard.tsx:1`](../../src/features/profile/components/ProfileEditCard.tsx#L1)

- Интеграция компонента редактирования в экран профиля
  [`ProfileScreen.tsx:12`](../../src/features/profile/components/ProfileScreen.tsx#L12)

**Схема данных**

- Миграция БД: добавление first_name и last_name полей в таблицу profiles
  [`036_add_user_profile_fields.sql:1`](../../supabase/migrations/036_add_user_profile_fields.sql#L1)

- Обновленные TypeScript типы для новых полей profiles
  [`supabase.ts:262`](../../src/types/supabase.ts#L262)

**Тестирование**

- Валидация имени в форме регистрации (min 3 chars, required, special characters)
  [`RegisterForm.test.tsx:1`](../../tests/unit/features/auth/RegisterForm.test.tsx#L1)

- Avatar upload, редактирование имени, обработка ошибок, concurrent upload guard
  [`ProfileEditCard.test.tsx:1`](../../tests/unit/features/profile/ProfileEditCard.test.tsx#L1)

- API-уровень: uploadAvatar edge cases, deleteAvatarFile URL parsing, updateProfile error handling
  [`profileApi.test.ts:1`](../../tests/unit/features/profile/profileApi.test.ts#L1)
