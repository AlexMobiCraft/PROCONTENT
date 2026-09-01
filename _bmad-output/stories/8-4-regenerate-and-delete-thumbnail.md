# Story 8.4: Ponovno generiranje in brisanje thumbnaila

Status: ready-for-dev

## Story

Как автор,
я хочу иметь возможность для конкретного видео повторно сгенерировать poster или удалить его,
чтобы исправить плохо выбранный первый кадр или избавиться от нежелательного poster.

## Acceptance Criteria

**Given** видео уже имеет автоматически сгенерированный или ручной poster  
**When** автор в редакторе кликает "Znova ustvari poster"  
**Then** старый thumbnail удаляется из Storage  
**And** создаётся новый thumbnail из текущего видео  
**And** `thumbnail_url` обновляется

**Given** автор кликает "Odstrani poster"  
**When** подтверждает действие  
**Then** thumbnail удаляется из Storage (если не используется где-то ещё)  
**And** `thumbnail_url` устанавливается в NULL  
**And** в превью отображается fallback

**Given** автор хочет удалить poster, который был загружен вручную  
**When** кликает "Odstrani poster"  
**Then** изображение удаляется из Storage  
**And** `thumbnail_url` устанавливается в NULL  
**And** в ленте для этого видео используется fallback (первый кадр)

**Given** автор кликает "Znova ustvari poster" для видео, которое не имеет `thumbnail_url`  
**When** система генерирует новый poster  
**Then** проверяется, что старый thumbnail не существует в Storage (нечего удалять)  
**And** новый poster сохраняется в Storage и обновляется `thumbnail_url`

## Tasks / Subtasks

- [ ] Task 1: Повторная генерация poster (AC: 1)
  - [ ] Subtask 1.1: Повторно использовать логику из Story 8.1 (`generateVideoThumbnail.ts`) для генерации thumbnail из видео
  - [ ] Subtask 1.2: Перед генерацией удалить старый thumbnail из Storage: `storage.from('post_media').remove([path])`
  - [ ] Subtask 1.3: Загрузить новый thumbnail и обновить `thumbnail_url`
  - [ ] Subtask 1.4: Повторная генерация запускается из `PosterContextMenu` ("Znova ustvari poster")
- [ ] Task 2: Удаление poster (AC: 2, 3)
  - [ ] Subtask 2.1: Создать client-side функцию `deleteThumbnail(postMediaId)` в `src/lib/storage/thumbnails.ts`
  - [ ] Subtask 2.2: Функция должна:
    - Получить `thumbnail_url` из `post_media`
    - Удалить файл из Storage по пути `post_media/thumbnails/{post_media_id}_thumb.jpg`
    - Обновить `thumbnail_url = NULL` в `post_media`
  - [ ] Subtask 2.3: Если `thumbnail_url` — NULL, функция должна безопасно вернуться (без ошибки)
- [ ] Task 3: Подтверждающий диалог для удаления (AC: 2)
  - [ ] Subtask 3.1: Создать подтверждающий диалог (использовать существующую UI библиотеку — например, `AlertDialog` из `@base-ui/react` или shadcn/ui)
  - [ ] Subtask 3.2: Текст диалога: "Ali ste prepričani, da želite odstraniti poster?"
  - [ ] Subtask 3.3: Кнопки: "Prekliči" и "Odstrani" (destructive style)
- [ ] Task 4: Интеграция с контекстным меню (AC: 1, 2, 3)
  - [ ] Subtask 4.1: Обновить `PosterContextMenu.tsx` — добавить callback'и для "Znova ustvari poster" и "Odstrani poster"
  - [ ] Subtask 4.2: Обновить `MediaItemPreview.tsx` — состояние "Brez posterja" отображает серый фон с текстом "Brez posterja"
- [ ] Task 5: Очистка при удалении видео (AC: 2 — расширенное)
  - [ ] Subtask 5.1: В `MediaUploader.tsx`/`handleRemove` или в API для удаления публикации проверить, удаляется ли видео
  - [ ] Subtask 5.2: Если удаляется видео, удалить и соответствующий thumbnail из Storage
  - [ ] Subtask 5.3: Это предотвращает orphaned файлы в Storage
- [ ] Task 6: Тесты
  - [ ] Subtask 6.1: Unit-тесты для `deleteThumbnail` (mock Storage, mock Supabase)
  - [ ] Subtask 6.2: Unit-тесты для повторной генерации (проверить, что старый удаляется, новый загружается)
  - [ ] Subtask 6.3: E2E-тест: удалить poster, проверить fallback отображение
  - [ ] Subtask 6.4: E2E-тест: повторно сгенерировать poster, проверить обновление

## Dev Notes

### Архитектурный контекст и ограничения

- **Stack:** Next.js 16.1.6, TypeScript 5, Supabase (Auth, DB, Storage), Zustand 5.
- **Storage:** Bucket `post_media`, подпапка `thumbnails/`. Путь: `post_media/thumbnails/{post_media_id}_thumb.jpg`.
- **Идемпотентность:** Повторная генерация должна всегда перезаписывать старый thumbnail (overwrite). Удаление должно быть безопасным — если файл не существует, не должно быть ошибки.
- **Snake_case:** Все поля из базы в `snake_case`.

### Ключевые реализационные моменты

1. **Удаление из Storage:** Использовать `supabase.storage.from('post_media').remove([path])`. Проверить, что путь правильно формируется: `thumbnails/{post_media_id}_thumb.jpg`.
2. **Обновление базы:** После успешного удаления из Storage ОБНОВИТЬ `post_media.thumbnail_url = NULL`. Если база не обновится, запись будет указывать на несуществующее изображение.
3. **Повторная генерация:** Повторно использовать ту же Canvas-логику, что и Story 8.1. Отличие только в том, что перед генерацией удаляется старый thumbnail.
4. **CASCADE при удалении видео:**
   - Если видео удаляется в редакторе (`MediaUploader.handleRemove`), thumbnail не удаляется автоматически (потому что `post_media` ещё не сохранён в базе).
   - Если публикация удаляется в базе (`DELETE FROM posts ... CASCADE`), `post_media` удаляется автоматически, но Storage файл НЕ удалится автоматически (Supabase Storage не имеет FOREIGN KEY на таблицу).
   - **Поэтому:** Добавить логику для удаления thumbnail из Storage, когда видео удаляется из публикации (в client-side `handleRemove`) ИЛИ когда удаляется публикация (в server API).
5. **Reference counting:** В v1 не требуется реализовывать reference counting для thumbnail файлов. Каждое видео имеет свой thumbnail с уникальным путём `{post_media_id}_thumb.jpg`. Когда `post_media_id` удаляется, thumbnail можно безопасно удалить.

### Стратегия очистки Storage

| Сценарий | Кто удаляет thumbnail? | Где? |
|----------|----------------------|------|
| Автор кликает "Odstrani poster" | Client API | Функция `deleteThumbnail()` |
| Автор кликает "Znova ustvari poster" | Client API | Перед генерацией в той же функции |
| Автор удаляет видео из публикации | Client-side | `handleRemove` в `MediaUploader.tsx` |
| Admin удаляет всю публикацию | Server API | В `DELETE /api/admin/posts/[id]` или подобном endpoint |
| Повторная генерация в bulk | Server/скрипт | Перед генерацией проверить и удалить старые |

### UI / Slovenian Language

- Kontekstni meni:
  - "Znova ustvari poster" (ikona osvežitve)
  - "Odstrani poster" (ikona koša)
- Potrditveni dialog:
  - "Ali ste prepričani, da želite odstraniti poster?"
  - Gumb: "Odstrani"
- Toast uspeh: "Poster je bil odstranjen"
- Toast uspeh: "Poster je bil ustvarjen" (pri ponovni generaciji)
- Fallback brez posterja: "Brez posterja"

### Testing Notes

- **Unit testi:**
  - `deleteThumbnail` — preveri, da se pokliče `storage.remove()` z pravilno potjo in `supabase.from('post_media').update()` z `thumbnail_url = null`.
  - Preveri, da funkcija ne vrže napake, če datoteka v Storage ne obstaja.
- **E2E testi:**
  - Odstrani poster → preveri, da se v predogledu prikaže fallback.
  - Znova generiraj poster → preveri, da se prikaže nov poster.

### References

- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#FR8.6]
- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#FR8.7]
- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#NFR8.5]
- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#UX-DR8.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Smart Container / Dumb UI]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: src/features/admin/components/MediaUploader.tsx]
- [Source: src/features/admin/components/MediaSortableItem.tsx]
- [Source: src/features/admin/types.ts]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
