# Sprint Change Proposal — 2026-03-24

**Проект:** PROCONTENT  
**Сформировано:** 2026-03-24  
**SM:** Bob  
**Scope:** Minor → Direct implementation

---

## Section 1: Issue Summary

**Проблема:** Story 2.6 («Детальный просмотр мультиформатного поста») была имплементирована до завершения Story 2.5 («Глобальный менеджер воспроизведения видео»). В результате:

1. `PostDetail.tsx` использует `LazyMediaWrapper` для рендера `video`-типа постов, тогда как теперь требуется `VideoPlayerContainer` (Story 2.5) для соблюдения NFR4.1.
2. Типы `gallery` и `multi-video` не были явно описаны в Story 2.6.
3. Статус истории в файле (`todo`) расходился с `sprint-status.yaml` (`review`).

**Контекст обнаружения:** CC-анализ в процессе подготовки к реализации следующей стории после завершения Story 2.5.

---

## Section 2: Impact Analysis

| Область | Влияние |
|---|---|
| **Epic 2** | Затронута Story 2.6 (review) |
| **NFR4.1** | Нарушение: видео в PostDetail не участвует в глобальном контроллере |
| **Код** | `src/components/feed/PostDetail.tsx` — один точечный рефакторинг |
| **Тесты** | `tests/unit/components/feed/PostDetail.test.tsx` — обновить тест рендера video |
| **Артефакты** | Story 2.6 — обновлена (применено) |

---

## Section 3: Recommended Approach

**Direct Adjustment:** Точечное исправление в рамках текущего `review` стории 2.6.

- **Усилия:** Low (1 файл + 1 тест)
- **Риск:** Low (VideoPlayerContainer уже готов, API совместим)
- **Влияние на таймлайн:** Минимальное

---

## Section 4: Detailed Change Proposals

### Story 2.6 — Документация (ПРИМЕНЕНО ✅)

Все изменения уже внесены в файл истории:
- Status: `todo` → `review`
- AC2: добавлены все типы (text/photo/video/gallery/multi-video)
- Task 3: video → `VideoPlayerContainer`, добавлены gallery/multi-video
- Dev Notes: обновлены описания типов
- Completion Notes: добавлено предупреждение о необходимой замене  
- References: добавлены ссылки на артефакты Story 2.5

### Код — требует реализации (PENDING ⚠️)

```
Файл: src/components/feed/PostDetail.tsx

СТАРОЕ (предположительно):
case 'video':
  return <LazyMediaWrapper mediaItem={...} aspectRatio="16/9" priority />

НОВОЕ:
case 'video':
  return (
    <VideoPlayerContainer
      videoId={post.media?.[0]?.id ?? `video-${post.id}`}
      src={(post.media?.[0]?.url ?? post.mediaItem?.url)!}
      poster={post.media?.[0]?.thumbnail_url ?? undefined}
      alt={post.title}
      aspectRatio="16/9"
      priority
    />
  )
```

---

## Section 5: Implementation Handoff

**Scope:** Minor — прямая реализация Dev-агентом.

**Handoff:** Dev-агент  
**Задача:** Обновить `PostDetail.tsx` (видео-ветка) + обновить соответствующий тест

**Критерии успеха:**
- [ ] `PostDetail.tsx` использует `VideoPlayerContainer` для `video` типа  
- [ ] Тест `PostDetail.test.tsx` проверяет рендер `VideoPlayerContainer` для video
- [ ] `npm test` — все тесты пройдены
- [ ] `npm run typecheck` — 0 ошибок
- [ ] NFR4.1: видео в детальном просмотре участвует в глобальном контроллере

---

_Сформировано в рамках CC workflow (Bob SM)_
