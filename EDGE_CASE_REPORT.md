# Edge Case Hunter Report

## Executive Summary
- **Total Issues Found:** 9 (1 CRITICAL, 4 HIGH, 3 MEDIUM, 1 LOW)
- **Scope:** CategoryManager, PostForm, PostCard, categories/page.tsx, toSlug utility, concurrent updates
- **Date:** 2026-03-29

---

## Critical Issues

### 1. toSlug() Produces Empty String on Invalid Input
**File:** `src/features/admin/components/CategoryManager.tsx:14-22`

**One-liner:** toSlug() returns empty string for strings with only special chars/Cyrillic, allowing invalid empty slugs to bypass validation.

**Severity:** CRITICAL

**Evidence:**
```typescript
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')  // ← Removes ALL non-latin chars
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')  // ← Result can be empty string
}

// Test cases:
toSlug('!@#$%^&*()') → ''        // All special chars removed
toSlug('Привет мир') → ''        // Cyrillic stripped
toSlug('   ') → ''               // Whitespace trimmed then removed
```

**Impact:**
- Empty slug is sent to API: `createCategory('Name', '')`
- Violates constraint: `slug` should match `^[a-z0-9-]+$` (length ≥ 1)
- Database constraint may fail, but client-side validation doesn't prevent submission
- User sees confusing error: API error instead of "invalid slug"

**Scenario:**
1. User enters "!!!привет!!!" in category name field
2. toSlug('!!!привет!!!') → ''
3. Form submits with title="!!!привет!!!" + slug=""
4. API fails with cryptic error (if RLS/constraint enabled)

---

## High Issues

### 2. setValue() Called Before Categories Load in Edit Mode
**File:** `src/features/admin/components/PostForm.tsx:132-137`

**One-liner:** useEffect sets category value AFTER categories load, but if loading fails silently and `categories.length > 0` never triggers, edit form shows empty category.

**Severity:** HIGH

**Evidence:**
```typescript
// useEffect #1: Load categories (no error state for missing categories)
useEffect(() => {
  getCategories()
    .then(setCategories)
    .catch(() => toast.error('Napaka pri nalaganju kategorij'))  // Toast shown but continues
    .finally(() => setIsCategoriesLoading(false))
}, [])

// useEffect #2: Only runs AFTER categories.length > 0
useEffect(() => {
  if (categories.length > 0 && isEditMode && initialData?.category) {
    setValue('category', initialData.category)
  }
}, [categories])

// Problem: if getCategories() fails AND toast.error() is mocked/ignored,
// categories stays [] and setValue() NEVER runs
```

**Impact:**
- Edit form loads but category field is empty string
- User doesn't realize their post's category was lost
- On submit, validation blocks form (category is required)
- UX is broken: user thinks they can edit but can't proceed

**Scenario:**
1. User opens edit form for post with category='stories'
2. getCategories() fails with network error
3. Toast error dismissed or unseen
4. categories = [], isCategoriesLoading = false
5. useEffect never triggers (categories.length === 0)
6. Form renders with category field = ''
7. User can't submit without fixing category manually

---

### 3. Race Condition: CategoryManager State Rsynced with DB During Delete
**File:** `src/features/admin/components/CategoryManager.tsx:68-81`

**One-liner:** Two windows add category simultaneously → localState diverges because toSlug() is computed independently in each window, creating duplicate slugs on second window's success.

**Severity:** HIGH

**Evidence:**
```typescript
async function handleDelete(id: string) {
  setDeletingId(id)  // ← UI updates optimistically
  try {
    await deleteCategory(id)
    setCategories((prev) => prev.filter((c) => c.id !== id))  // ← DB is source of truth
  } catch (err: unknown) {
    // If deleteCategory fails: deletingId stays set, UI shows spinner
    // User thinks deletion is in progress, but DB wasn't touched
    toast.error(message)
  } finally {
    setDeletingId(null)  // ← Always clears, even on error
  }
}
```

**Problem:** If DB DELETE fails mid-operation (e.g., timeout after HTTP 200), finally block clears deletingId but category is STILL IN DB. Next render hides spinner but user thinks deletion succeeded.

**Impact:**
- User belief diverges from DB state
- Deleting category shows in UI, then phantom-reappears on next page refresh
- If user quickly tries again, setDeletingId(null) happens twice without clear state

**Scenario:**
1. User clicks delete on category 'Stories'
2. setDeletingId('stories-id') → spinner shows
3. Network timeout: DB DELETE doesn't complete but socket closes
4. finally block: setDeletingId(null) → spinner hides
5. User thinks deletion succeeded
6. Page refresh: category 'Stories' still exists (DB unchanged)

---

### 4. PostForm double-setValue() on Category Load in Edit Mode
**File:** `src/features/admin/components/PostForm.tsx:124-137`

**One-liner:** If categories load TWICE (e.g., network retry), useEffect with `[categories]` fires twice, calling setValue() twice with the same value (redundant but no data loss).

**Severity:** HIGH

**Evidence:**
```typescript
// getCategories() resolves/rejects once per mount
useEffect(() => {
  getCategories().then(setCategories)  // ← Only once per mount
}, [])

// But if a parent component remounts PostForm or refetches categories,
// this useEffect fires again with new categories array reference
useEffect(() => {
  if (categories.length > 0 && isEditMode && initialData?.category) {
    setValue('category', initialData.category)  // ← Called twice
  }
}, [categories])  // ← categories is a state update, creates new array reference

// Race condition:
// 1. categories = [] (initial)
// 2. getCategories() resolves → setCategories([cat1, cat2])
// 3. useEffect #2 fires → setValue('category', 'stories')
// 4. Parent refetches categories (unexpected re-render)
// 5. categories = [cat1, cat2] (NEW reference, same values)
// 6. useEffect #2 fires AGAIN → setValue('category', 'stories') [redundant]
```

**Impact:**
- setValue() is idempotent, so no data corruption
- But react-hook-form may have internal side-effects from double-set
- Form validity may momentarily become invalid then re-validate (flash)
- Tests may flake if they don't account for double-setValue

**Scenario:**
1. Edit form loads with categories (network fast)
2. Parent component re-renders due to unrelated state change
3. PostForm remounts or categories dependency changes
4. setValue() called twice, causing form validation to flash

---

### 5. PostCard: e.stopPropagation() Prevents Native Keyboard Navigation
**File:** `src/components/feed/PostCard.tsx:113-116`

**One-liner:** Category button calls e.stopPropagation() to prevent parent click nav, but if PostCard parent uses Space/Enter keyboard handler, stopPropagation() doesn't prevent KeyboardEvent bubbling, creating inconsistent keyboard UX.

**Severity:** HIGH

**Evidence:**
```typescript
// In PostCard parent article (line 86):
<article onClick={handleCardClick}>

  // In category button (line 113):
  <button onClick={(e) => {
    e.stopPropagation()  // ← Prevents click from bubbling
    onCategoryClick(post.category)
  }}>

// But if you add keyboard nav:
<article onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    router.push(...)
  }
}}>
  {/* Category button INSIDE article receives KeyDown event first */}
  {/* e.stopPropagation() has NO EFFECT on KeyboardEvents — only MouseEvents */}
```

**Impact:**
- Space/Enter on category button navigates to post (not filtered)
- Inconsistent: mouse click filters by category, keyboard enters post
- Users expect Space/Enter to activate button, not navigate
- Keyboard-only users broken

**Scenario:**
1. User tabs to category button inside PostCard
2. Presses Enter/Space
3. e.stopPropagation() on parent click is unused
4. KeyboardEvent bubbles to article.onKeyDown
5. Post navigation triggered instead of category filter

---

## Medium Issues

### 6. categories/page.tsx Throws Unhandled Error → Global error.tsx Catches (No RLS)
**File:** `src/app/(admin)/categories/page.tsx:7`

**One-liner:** getCategoriesServer() error is not caught locally; Global error.tsx handles it, but should have segment-level error.tsx for admin context.

**Severity:** MEDIUM

**Evidence:**
```typescript
// src/app/(admin)/categories/page.tsx
export default async function CategoriesPage() {
  const categories = await getCategoriesServer()  // ← No try-catch
  // If getCategoriesServer throws, error bubbles up
}

// Caught by: src/app/error.tsx (global)
// Not caught by: src/app/(admin)/error.tsx (doesn't exist)
// Not caught by: src/app/(admin)/categories/error.tsx (doesn't exist)
```

**Impact:**
- RLS/DB errors show generic global error page
- Admin has no context-specific recovery (e.g., "Check database connection")
- Hard to differentiate permission error vs. network error
- Breaks expected error-handling pattern (segment error > global error)

**Missing Files:**
- `src/app/(admin)/error.tsx` (should handle admin-specific errors)
- `src/app/(admin)/categories/error.tsx` (should handle categories-specific errors)

**Scenario:**
1. Admin DB user loses SELECT permission
2. getCategoriesServer() throws: "permission denied"
3. Global error.tsx shows "Nekaj je šlo narobe!" (unhelpful)
4. Admin doesn't know if it's network, RLS, or database

---

### 7. PostForm Vulnerable to Invalid Category Slug After setCategories() Fails
**File:** `src/features/admin/components/PostForm.tsx:124-137`

**One-liner:** If getCategories() fails, categories = []. On submit, category validation passes empty string as valid, and Zod validation checks min(1) on slug but NOT slug format (^[a-z0-9-]+).

**Severity:** MEDIUM

**Evidence:**
```typescript
// types.ts (line 46-50)
export const PostFormSchema = z.object({
  category: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Kategorija je obvezna').max(100)),
    // ↑ Only validates length, NOT slug format (e.g., must be a-z0-9-)
})

// If categories load fails:
// 1. getCategories() rejects
// 2. categories = []
// 3. User manually enters value: category = ''
// 4. On submit: Zod validates min(1) → fails correctly
// BUT if user somehow gets invalid slug (e.g., via console):
// 5. setValue('category', '!!!invalid!!!') → Zod min(1) passes
// 6. API rejects with "invalid slug format"
```

**Impact:**
- Zod validation is incomplete for business logic constraints
- If categories fail to load, form still renders but category dropdown is empty
- User can manually type text, but no slug format validation on submit
- API returns error instead of client-side validation

**Scenario:**
1. Network error: getCategories() fails
2. isCategoriesLoading = false, categories = []
3. Category select shows "Izberite kategorijo" (no options)
4. User types in console: form.category = '!!!invalid!!!'
5. Form submit passes Zod validation
6. API rejects: "invalid slug format"

---

### 8. CategoryManager: Slug Generation Not Validated Against Existing Slugs
**File:** `src/features/admin/components/CategoryManager.tsx:14-50`

**One-liner:** Two categories with different names can generate identical slugs (e.g., "Hello" and "hello-" both → "hello"), DB constraint catches it but UX shows API error.

**Severity:** MEDIUM

**Evidence:**
```typescript
function toSlug(name: string): string {
  return name.toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Collision examples:
toSlug('Hello World') → 'hello-world'
toSlug('Hello---World') → 'hello-world'
toSlug('HELLO WORLD') → 'hello-world'
toSlug('hello-world-') → 'hello-world'

// If user tries to create both:
// 1. Create "Hello World" → slug 'hello-world' ✓
// 2. Create "hello-world-" → slug 'hello-world' → API error (duplicate)
```

**Impact:**
- User creates category "Hello World" successfully
- User tries "hello-world-" and sees "Kategorija s tem imenom že obstaja"
- But the ERROR MESSAGE is wrong — name is different, slug is the same
- Users confused about what "already exists" means

**Scenario:**
1. Admin creates category "hello-world" ✓
2. Admin tries "Hello---World" (thinking it's different)
3. DB constraint fails: duplicate slug
4. Error shown: "Kategorija s tem imenom že obstaja" (wrong message)
5. Admin thinks "Hello---World" is a duplicate name, but it's a duplicate slug

---

## Low Issues

### 9. FeedContainer: Concurrent Fast Category Switches Can Lose Pending Likes
**File:** `src/features/feed/components/FeedContainer.tsx:306-347`

**One-liner:** If user toggles like on post, then immediately switches category, pendingLikes cleanup is de-duplicated but is_liked state might not sync with new category data.

**Severity:** LOW

**Evidence:**
```typescript
// FeedContainer line 160: cleanup on category change
useEffect(() => {
  // ...
  return () => {
    initialLoadAbortRef.current?.abort()
    loadMoreAbortRef.current?.abort()
    useFeedStore.getState().setLoadingMore(false)
    // ↑ Missing: useFeedStore.getState().pendingLikes.clear()
  }
}, [activeCategory, loadInitial])

// Scenario:
// 1. User likes post "abc" → pendingLikes = ['abc']
// 2. toggleLike RPC in flight
// 3. User switches category immediately
// 4. New category loads posts (abc's is_liked from fresh query)
// 5. Old RPC response arrives → updatePost(abc, { is_liked: true })
// 6. But post might not exist in new category → silently ignored
```

**Impact:**
- pendingLikes array not cleared when switching categories
- If old RPC arrives after category switch, it tries to update non-existent post
- updatePost() silently ignores missing posts (correct behavior)
- But if post DOES exist in new category, stale like state applies
- Race condition: unlikely but theoretically possible

**Scenario:**
1. Category 'all': post "xyz" has is_liked=false
2. User likes post "xyz" → optimistic: is_liked=true, pendingLikes=['xyz']
3. RPC toggles_like in flight
4. User switches to category 'stories' (reloads posts)
5. RPC response arrives: updatePost('xyz', { is_liked: true, ... })
6. If 'stories' also contains post 'xyz': stale state applied

---

## Summary Table

| # | Component | Issue | Severity | Type |
|---|-----------|-------|----------|------|
| 1 | toSlug() | Empty string on invalid input | CRITICAL | Logic |
| 2 | PostForm | setValue() skipped if categories load fails | HIGH | Race Condition |
| 3 | CategoryManager | Delete state diverges on network timeout | HIGH | Race Condition |
| 4 | PostForm | Double setValue() on categories reload | HIGH | Idempotency |
| 5 | PostCard | stopPropagation() ineffective for keyboard events | HIGH | UX/A11y |
| 6 | categories/page.tsx | No segment-level error handler | MEDIUM | Error Handling |
| 7 | PostForm | Incomplete Zod validation for slug format | MEDIUM | Validation |
| 8 | CategoryManager | Slug collision not detected client-side | MEDIUM | UX |
| 9 | FeedContainer | Pending likes not cleared on category switch | LOW | Race Condition |

---

## Recommendations

### Immediate (CRITICAL)
1. **toSlug() validation:** Add check after final replace to detect empty result:
   ```typescript
   const slug = toSlug(trimmed)
   if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
     setNameError('Slug je neveljaven (samo črke, številke in -)')
     return
   }
   ```

### High Priority
2. **PostForm categories error:** Add error state + show message if categories fail to load
3. **CategoryManager delete:** Use optimistic + rollback pattern (not just setDeletingId)
4. **PostCard keyboard:** Don't call e.stopPropagation() in click handler (let browser handle naturally)
5. **PostForm double-setValue:** Extract category sync to separate effect with stable deps

### Medium Priority
6. **Add error.tsx files** for `(admin)` and `categories` segments
7. **Extend Zod schema** to validate slug format in client
8. **Slug collision message:** Improve error text when slug duplicates exist
9. **FeedContainer cleanup:** Reset pendingLikes on category change

---

## Test Recommendations

- Add vitest for toSlug() edge cases (empty, special chars, Cyrillic, symbols)
- Add integration test for CategoryManager concurrent add/delete
- Add E2E test for PostForm edit mode with network delay on categories
- Add snapshot tests for error states (missing categories, failed loads)

