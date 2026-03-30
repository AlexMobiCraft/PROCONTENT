# Code Review Summary — Quick Reference

**Status:** 🛑 **BLOCKERS FOUND** — Do not merge

---

## Critical Fixes Required (115 min)

### 1️⃣ CRIT-001: Trim Bug in ProfileEditCard
- **File:** `src/features/profile/components/ProfileEditCard.tsx:35`
- **Fix:** Change `editedName.length < 3` → `editedName.trim().length < 3`
- **Time:** 5 min

### 2️⃣ CRIT-002: Trigger Coalesce Bug
- **File:** `supabase/migrations/036_add_user_profile_fields.sql:22`
- **Fix:** Change `on conflict (id) do update` → `on conflict (id) do nothing`
- **Time:** 10 min

### 3️⃣ CRIT-003: Concurrent Upload Race
- **File:** `src/features/profile/components/ProfileEditCard.tsx:64`
- **Fix:** Add `if (isLoading) return` at function start
- **Time:** 15 min

### 4️⃣ CRIT-004: Silent Error in Registration
- **File:** `src/features/auth/components/RegisterContainer.tsx:48-50`
- **Fix:** Show error to user instead of only console.warn
- **Time:** 10 min

### 5️⃣ CRIT-005: Server-Side Validation Missing
- **File:** `src/features/profile/api/profileApi.ts:22-25`
- **Adds:**
  - MIME type validation (`image/jpeg|png|gif|webp`)
  - 0-byte file rejection
  - DB CHECK constraints in migration
- **Time:** 20 min

### 6️⃣ CRIT-006: Orphaned Avatar Files
- **File:** `src/features/profile/components/ProfileEditCard.tsx:88-91`
- **Fix:** Add `deleteAvatarFile()` call when updateProfile fails
- **Time:** 15 min

### 7️⃣ ARCH-001: Add DB Constraints
- **File:** `supabase/migrations/036_add_user_profile_fields.sql`
- **Adds:**
  ```sql
  ADD CONSTRAINT check_first_name_not_empty CHECK (first_name != ''),
  ADD CONSTRAINT check_first_name_min_length CHECK (LENGTH(first_name) >= 3)
  ```
- **Time:** 10 min

### 8️⃣ TEST-004: Create profileApi.test.ts
- **File:** `tests/unit/features/profile/profileApi.test.ts` (new)
- **Test:** 0-byte file, >5MB file, invalid MIME type, orphaned cleanup
- **Time:** 30 min

---

## Medium Priority (Can Follow-up)

| Issue | File | Quick Fix |
|-------|------|-----------|
| MED-001 | RegisterForm.tsx:74 | Add `maxLength={100}` |
| MED-002 | RegisterForm.tsx:44 | Add `.trim()` to last_name |
| MED-003 | profileApi.ts:25 | Check `file.type` against whitelist |
| MED-004 | profileApi.ts:14 | Add `.slice(0, 200)` to filename |
| MED-005 | profileApi.ts:23 | Check `file.size > 0` |
| MED-006 | profileApi.ts:63 | Check `count > 0` after update |
| MED-007 | profileApi.ts:81 | Add `decodeURIComponent()` to path |
| MED-008 | (RLS) | Verify Storage bucket policies |

---

## Acceptance Criteria Status

| AC | Current Status | Blocker |
|----|---|---|
| AC #1: first_name="Ana" saves | ⚠️ BROKEN (trim bug, trigger bug) | 🔴 YES |
| AC #2: first_name="ab" rejected | ⚠️ BROKEN (no server validation) | 🔴 YES |
| AC #3: Avatar <1s update | ⚠️ BROKEN (race condition) | 🔴 YES |
| AC #4: Error + rollback on fail | ⚠️ BROKEN (orphaned files) | 🔴 YES |

---

## Review Artifacts

- **Full Report:** `code-review-profile-setup-avatar.md` (21 findings)
- **Fixes Sheet:** This file
- **Integration Test Template:** See CRIT-007 section

---

## Checklist for Merger

```
Before approve for merge:
☐ All 7 critical fixes applied
☐ npm run test (all pass)
☐ npm run typecheck (no errors)
☐ npm run lint (no new warnings)
☐ profileApi.test.ts created with edge cases
☐ DB constraints added to migration
☐ Manual test: signup with name → check profile
☐ Manual test: avatar upload + network error → check cleanup
```

