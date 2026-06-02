---
title: 'Аватар профиля: лимит 50 МБ + клиентское сжатие (center-crop 512×512)'
type: 'feature'
created: '2026-06-02'
status: 'done'
context: ['{project-root}/_bmad-output/project-context.md']
baseline_commit: '38abdd8e86578baadc6b9215df5f68a8880d5525'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Загрузка аватара ограничена 256 КБ (`MAX_AVATAR_SIZE = 512 * 512`). Фото с современных телефонов (3–12 МБ) не проходят — пользователь видит ошибку вместо аватара. Самая массовая аудитория клуба — iPhone, который по умолчанию отдаёт HEIC, не декодируемый Canvas.

**Approach:** Сжимать на клиенте все изображения > 256 КБ через Canvas API в center-crop квадрат 512×512 / ~200 КБ перед загрузкой в Supabase Storage. Жёстко отклонять только файлы > 50 МБ (предохранитель памяти браузера). Файлы ≤ 256 КБ грузить как есть. Все отказы — внятные actionable-тосты (включая явный про HEIC), без тихих провалов.

## Boundaries & Constraints

**Always:**
- Сжатие — только клиент (`'use client'`), через `createImageBitmap` + `<canvas>.toBlob`. Без сети, серверных и npm-зависимостей.
- **Center-crop в квадрат 512×512** (cover): обрезать по меньшей стороне, чтобы хранилище совпадало с круглым `object-cover` дисплеем. Учитывать EXIF (`imageOrientation: 'from-image'`).
- Качество подбирать итеративно от **0.8** вниз до ≤ 200 КБ; если недостижимо — минимальное. Выход WebP, фолбэк JPEG (`toBlob` → null).
- Сжимать только файлы **> 256 КБ** (`COMPRESS_THRESHOLD`); ≤ 256 КБ — без сжатия.
- Валидация по **оригиналу ДО сжатия**: 0-байт → HEIC-детект → MIME-whitelist → размер ≤ 50 МБ. (HEIC раньше whitelist — иначе `.heic` с пустым MIME получил бы общий тост вместо HEIC-сообщения.)
- `ImageBitmap.close()` в `finally`; ошибка декода (corrupt/unsupported) → actionable-тост, не тихий провал.
- Системные ошибки → `toast.error` (словенский); сохранить best-effort cleanup, оптимистичные обновления + rollback.

**Ask First:**
- Менять выходной формат (WebP), целевые параметры (512 / 200 КБ / quality 0.8), пороги (256 КБ / 50 МБ) или состав allowed-типов.
- Менять `file_size_limit`/`allowed_mime_types` бакета `avatars` миграцией.

**Never:**
- Не добавлять npm-зависимости; не выносить сжатие на сервер; не маппить snake_case → camelCase.
- Не делать полноценный HEIC-декод и интерактивный crop/preview (вынесены в `deferred-work.md`).
- Не показывать сырой лимит размера в спокойном состоянии UI.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Большое фото | JPEG 8 МБ 4000×3000 | center-crop 512×512, ≤200 КБ WebP, загружено | N/A |
| Мелкое фото | PNG 40 КБ ≤256 КБ | Без сжатия, загружено как есть | N/A |
| Файл > 50 МБ | JPEG 60 МБ | Отклонён до сжатия | toast «Datoteka je prevelika (max 50 MB). Pomanjšajte sliko.» |
| HEIC/HEIF | image/heic или `.heic` | Отклонён до сжатия | toast «HEIC ni podprt. Shranite kot JPEG.» |
| 0-байт | size 0 | Отклонён | toast «Datoteka ne sme biti prazna» |
| Не-изображение | text/plain | Отклонён | toast «Samo slike … so dovoljene» |
| WebP не поддержан | `toBlob('image/webp')` → null | Фолбэк JPEG | N/A |
| Битый/неподдерж. декод | валидный MIME, `createImageBitmap` reject | Отклонён | toast «Slike ni bilo mogoče obdelati» |
| Canvas недоступен | `createImageBitmap` undefined, файл > 256 КБ | Отклонён (НЕ тихая заливка) | toast «Vaš brskalnik ne podpira obdelave slik» |
| GIF | анимированный | Первый кадр → статичный аватар, загружен | toast(info) «GIF bo shranjen kot slika» |

</frozen-after-approval>

## Code Map

- `src/features/profile/lib/compressAvatar.ts` -- НОВЫЙ. `compressAvatar(file)`: skip ≤256 КБ; center-crop 512×512; quality-search; `close()` + corrupt-guard.
- `src/features/profile/api/profileApi.ts` -- `uploadAvatar`: новый порядок валидаций (0-byte → HEIC → MIME → 50 МБ), вызов `compressAvatar`, upload с `contentType` из blob.
- `src/features/profile/components/ProfileEditCard.tsx` -- два фазовых состояния («Obdelava slike…» / «Nalaganje…»), GIF-info-тост, подсказка «Slika bo samodejno optimizirana» (без числа), убрать «256 KB».
- `tests/unit/features/profile/profileApi.test.ts` -- переписать лимит-тест (256 КБ → 50 МБ) + новые кейсы HEIC.
- `tests/unit/features/profile/compressAvatar.test.ts` -- НОВЫЙ. Стабы `createImageBitmap`/canvas/toBlob.

## Tasks & Acceptance

**Execution:**
- [x] `src/features/profile/lib/compressAvatar.ts` -- `compressAvatar(file: File): Promise<File>`: (1) `file.size <= COMPRESS_THRESHOLD` → return file; (2) `typeof createImageBitmap !== 'function'` → throw «Vaš brskalnik ne podpira obdelave slik»; (3) `const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })` в try/catch (reject → throw «Slike ni bilo mogoče obdelati»); (4) вычислить cover-crop квадрат, нарисовать на 512×512 canvas (`getContext('2d')`; если null → throw); (5) `blobFromCanvas(canvas,type,q)` промисификация `toBlob`; quality-loop `[0.8,0.7,0.6,0.5]` → первый blob ≤ `TARGET_BYTES`, иначе последний; WebP, при null → JPEG; (6) `bmp.close()` в `finally`; (7) вернуть `new File([blob], replaceExt(file.name, ext), { type: blob.type })`. Константы: `MAX_DIMENSION=512`, `TARGET_BYTES=200*1024`, `COMPRESS_THRESHOLD=256*1024`.
- [x] `src/features/profile/api/profileApi.ts` -- порядок в `uploadAvatar`: 0-byte → HEIC-детект (`type` включает `heic`/`heif` ИЛИ имя `.heic`/`.heif` → throw HEIC-тост) → MIME-whitelist → `file.size > 50*1024*1024` → throw 50 МБ-тост. Затем `const toUpload = await compressAvatar(file)`; upload `toUpload` с `{ contentType: toUpload.type, cacheControl, upsert:false }`, путь из `toUpload.name`. Удалить старый `MAX_AVATAR_SIZE`.
- [x] `src/features/profile/components/ProfileEditCard.tsx` -- `uploadPhase: 'idle'|'processing'|'uploading'`; при выборе файла → `processing` («Obdelava slike…»), после `compressAvatar` → `uploading` («Nalaganje…»). Если исходный `file.type === 'image/gif'` → `toast.info('GIF bo shranjen kot slika')`. Подсказку «Največja velikost: 256 KB» заменить на «Slika bo samodejno optimizirana».
- [x] `tests/unit/features/profile/compressAvatar.test.ts` -- стабы `global.createImageBitmap` (возвращает `{width,height,close:vi.fn()}`), `HTMLCanvasElement.prototype.toBlob` (callback с детерминированным `Blob`-size), `getContext`. Покрыть: skip ≤256 КБ; throw без `createImageBitmap` для >256 КБ; quality-loop останавливается на первом ≤200 КБ; WebP→JPEG fallback (webp→null); corrupt (`createImageBitmap` reject → throw); `close()` вызван.
- [x] `tests/unit/features/profile/profileApi.test.ts` -- заменить «exceeds 256KB» на «>50MB → throw 50 МБ-тост»; «256KB exactly» оставить зелёным (jsdom: ≤256 КБ → skip, ≤50 МБ → upload); добавить HEIC-кейсы (`image/heic` и имя `.heic` → throw); ассерт `upload` с `contentType`.

**Acceptance Criteria:**
- Given фото 8 МБ, when выбрано, then center-crop 512×512 ≤200 КБ загружено, аватар обновлён, последовательно показаны «Obdelava…» → «Nalaganje…».
- Given HEIC-файл, when выбран, then actionable-тост про JPEG, загрузки нет.
- Given файл 60 МБ, when выбран, then actionable-тост про 50 МБ + сжать, загрузки нет.
- Given окружение без Canvas (jsdom) + файл ≤256 КБ, when `uploadAvatar`, then файл грузится без сжатия (тесты `profileApi` зелёные без canvas-моков).
- **Метрика:** целевой success-rate ≥ 95% успешных загрузок аватара с первой попытки (фото ≤ 50 МБ; HEIC даёт внятную инструкцию, не тихий провал).
- Given `npm run typecheck`, `npm run lint`, `npm run test`, then всё зелёное.

## Spec Change Log

## Design Notes

Сжатие внутри `uploadAvatar` (единая точка входа) — мок `profileApi` в `ProfileEditCard.test` остаётся валидным. Ранний skip ≤256 КБ срабатывает в jsdom (где `createImageBitmap` undefined) до проверки Canvas → существующие `profileApi`-тесты зелёные без canvas-моков; для >256 КБ без Canvas — явный throw, НЕ тихая заливка (закрывает прод-дыру).

Center-crop вместо letterbox: cover-обрезка по меньшей стороне → результат совпадает с круглым `object-cover` дисплеем (нет неожиданного кропа). Полноценный интерактивный crop и HEIC-декод — в `deferred-work.md`.

Память: жёсткий reject 50 МБ — основной предохранитель; пиковый риск — декод большого JPEG в `createImageBitmap` до отрисовки. Canvas фиксирован 512×512 (мал), `bmp.close()` в `finally` освобождает native-память. corrupt/неподдерж. формат ловится try/catch вокруг `createImageBitmap`.

Подбор качества:
```ts
let last: Blob | null = null
for (const q of [0.8, 0.7, 0.6, 0.5]) {
  const blob = (await blobFromCanvas(canvas, 'image/webp', q))
            ?? (await blobFromCanvas(canvas, 'image/jpeg', q)) // fallback
  if (blob && blob.size <= TARGET_BYTES) return blob
  last = blob
}
return last
```

## Verification

**Commands:**
- `npm run typecheck` -- expected: без ошибок
- `npm run lint` -- expected: без ошибок
- `npm run test` -- expected: всё зелёное, включая новый `compressAvatar.test.ts`

**Manual checks:**
- Фото >5 МБ → аватар появляется; Network: загруженный blob ≤ ~200 КБ, `content-type: image/webp`, квадрат 512×512.
- HEIC с iPhone → actionable-тост про JPEG.
- Файл >50 МБ → actionable-тост.
- **Инфра (release-blocker, проверить отдельно):** bucket `avatars` в Supabase — `file_size_limit` ≥ ~1 МБ и `allowed_mime_types` включает `image/webp` + `image/jpeg`. Если нет — миграция (см. Ask First).

## Suggested Review Order

**Валидация и оркестрация (entry point)**

- Единая точка входа: валидация оригинала → сжатие → upload
  [`profileApi.ts:39`](../../src/features/profile/api/profileApi.ts#L39)

- HEIC-детект до whitelist — внятный отказ для iPhone вместо тихого провала
  [`profileApi.ts:52`](../../src/features/profile/api/profileApi.ts#L52) · [`isHeic:17`](../../src/features/profile/api/profileApi.ts#L17)

- Жёсткий предохранитель памяти 50 МБ
  [`profileApi.ts:62`](../../src/features/profile/api/profileApi.ts#L62)

- `contentType` берётся из реального типа blob
  [`profileApi.ts:77`](../../src/features/profile/api/profileApi.ts#L77)

**Сжатие на Canvas**

- Skip ≤ 256 КБ — грузим как есть
  [`compressAvatar.ts:43`](../../src/features/profile/lib/compressAvatar.ts#L43)

- Без Canvas (> 256 КБ) — явный throw, НЕ тихая заливка (закрытая прод-дыра)
  [`compressAvatar.ts:48`](../../src/features/profile/lib/compressAvatar.ts#L48)

- Center-crop 512×512 + white-fill против чёрного фона при JPEG-фолбэке
  [`compressAvatar.ts:73`](../../src/features/profile/lib/compressAvatar.ts#L73)

- Quality-loop WebP→JPEG до ≤ 200 КБ
  [`compressAvatar.ts:82`](../../src/features/profile/lib/compressAvatar.ts#L82)

- Расширение файла по реальному MIME-типу blob
  [`compressAvatar.ts:110`](../../src/features/profile/lib/compressAvatar.ts#L110)

**UI binding**

- Двухфазное состояние загрузки
  [`ProfileEditCard.tsx:28`](../../src/features/profile/components/ProfileEditCard.tsx#L28)

- Проброс `onPhase` → честные подписи «Obdelava…» / «Nalaganje…»
  [`ProfileEditCard.tsx:87`](../../src/features/profile/components/ProfileEditCard.tsx#L87)

- GIF-тост только когда сжатие реально произойдёт (> 256 КБ)
  [`ProfileEditCard.tsx:77`](../../src/features/profile/components/ProfileEditCard.tsx#L77)

**Тесты**

- Юнит-тесты утилиты (стабы Canvas/createImageBitmap)
  [`compressAvatar.test.ts:1`](../../tests/unit/features/profile/compressAvatar.test.ts#L1)

- Обновлённые проверки uploadAvatar (50 МБ, HEIC, contentType)
  [`profileApi.test.ts:54`](../../tests/unit/features/profile/profileApi.test.ts#L54)
