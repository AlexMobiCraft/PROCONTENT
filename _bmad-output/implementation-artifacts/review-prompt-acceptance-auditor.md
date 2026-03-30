# Acceptance Auditor Review: Profile Setup Feature

**Инструкция:** Вы - acceptance auditor с доступом к спеке и коду. Ваша задача - проверить что реализация соответствует спеке, acceptance criteria, и архитектурным правилам проекта (CLAUDE.md).

## Спека для проверки:

**Intent:**
- Новые пользователи должны указывать имя при регистрации (обязательно, ≥3 символа)
- Существующие профили должны иметь функцию загрузки аватара
- Аватары хранятся в Supabase Storage bucket `avatars`

**Границы:**
- Database naming: snake_case напрямую (не маппим в camelCase)
- UI язык: Словенский
- Паттерн: Smart Container/Dumb UI
- RSC для загрузки, Client компоненты для интерактивности
- Оптимистичные обновления с откатом при ошибке

**Матрица сценариев:**
- ✓ Регистрация с first_name="Ana", пароль → profiles создан с first_name="Ana", last_name=NULL
- ✓ Регистрация с first_name="ab" → форма показывает "Najmanj 3 znaki"
- ✓ Upload PNG 2MB → avatar_url обновляется в БД + UI за <1s
- ✓ Avatar upload error (сеть) → toast error, откатить avatar, разрешить retry

## Что проверить:

### Acceptance Criteria
1. [ ] Могут ли новые пользователи вводить first_name в signup?
2. [ ] Валидируется ли first_name на мин 3 символа?
3. [ ] Может ли пользователь загрузить аватар?
4. [ ] Обновляется ли avatar_url в БД?
5. [ ] Откатывается ли при ошибке?

### Architecture (из CLAUDE.md)
1. [ ] Компоненты UI (RegisterForm, ProfileEditCard) - дум компоненты?
2. [ ] Используют ли они Store или Supabase? (не должны)
3. [ ] Контейнеры (RegisterContainer, ProfileScreen) - smart?
4. [ ] Используют ли они Supabase и Store?
5. [ ] Импорты: src/components/ui не импортирует из src/features?
6. [ ] snake_case для полей БД (first_name, last_name, avatar_url)?

### Validation
1. [ ] HTML5 required + minLength=3 на input?
2. [ ] JS валидация в handleSubmit как fallback?
3. [ ] first_name error отображается inline?
4. [ ] last_name опционально (можно оставить пусто)?

### Error Handling
1. [ ] Toast для успешного обновления?
2. [ ] Toast для ошибок?
3. [ ] Откат UI при ошибке API?
4. [ ] Консоль.warn при best-effort cleanup ошибках?

### Storage Integration
1. [ ] Аватары загружаются в bucket `avatars`?
2. [ ] Путь: avatars/{userId}/{uuid}/filename?
3. [ ] Cleanup старого аватара при upload нового?
4. [ ] MAX_AVATAR_SIZE = 5MB?

### Migration
1. [ ] first_name добавлен как NOT NULL?
2. [ ] last_name добавлен как NULL?
3. [ ] handle_new_user обновлен для инициализации этих полей?
4. [ ] Миграция безопасна для существующих профилей?

### Tests
1. [ ] RegisterForm валидирует min 3 chars?
2. [ ] RegisterForm отклоняет пусто?
3. [ ] ProfileEditCard handle avatar upload?
4. [ ] ProfileEditCard handle errors и rollback?

## Результаты

Пожалуйста проверьте каждый пункт и предоставьте:
- Какие AC пройдены ✓
- Какие AC провалены ✗
- Какие архитектурные правила нарушены
- Какие findings требуют исправления

