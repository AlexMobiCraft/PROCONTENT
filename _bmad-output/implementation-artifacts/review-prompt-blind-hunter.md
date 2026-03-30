# Blind Hunter Review: Profile Setup Feature

**Инструкция:** Вы - adversarial reviewer без контекста проекта. Вам даны только изменения кода. Ваша задача - найти логические ошибки, уязвимости, неправильное обращение с edge cases.

## Измененные/Новые файлы:

1. **supabase/migrations/036_add_user_profile_fields.sql** - миграция БД
2. **src/types/supabase.ts** - добавлены first_name, last_name типы
3. **src/features/auth/components/RegisterForm.tsx** - добавлены input поля для имени
4. **src/features/auth/components/RegisterContainer.tsx** - сохранение first_name, last_name после signup
5. **src/features/profile/api/profileApi.ts** - новый файл с uploadAvatar, updateProfile, deleteAvatarFile
6. **src/features/profile/components/ProfileEditCard.tsx** - новый компонент для редактирования профиля
7. **src/features/profile/components/ProfileScreen.tsx** - интеграция ProfileEditCard

## Критические области для ревью:

1. **Валидация first_name** - проверьте что невозможно обойти валидацию (min 3 chars, required)
2. **Асинхронные операции** - есть ли race conditions между signup и profile update?
3. **Avatar upload** - может ли файл остаться в Storage если update поломался?
4. **XSS при выводе имени** - правильно ли escaping?
5. **Обработка ошибок** - достаточно ли попыток и fallbacks?
6. **БД консистенция** - может ли профиль остаться в половинчатом состоянии?

Пожалуйста предоставьте все findings которые вы найдете.

