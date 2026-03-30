# 📋 Code Review: Profile Setup + Avatar Management

**Date:** 2026-03-30
**Scope:** Feature implementation for user registration with name + profile avatar management
**Reviewed by:** Adversarial Code Review
**Status:** ⚠️ **BLOCKER ISSUES FOUND** — Do not merge without critical fixes

---

## Executive Summary

Implementation of user profile name + avatar feature has **7 critical issues** that violate spec requirements and create security/data consistency risks. The codebase demonstrates good architectural patterns (Smart Container/Dumb UI, RSC + Client Components) but lacks server-side validation, has concurrency bugs, and missing error handling paths.

**Recommendation:** Fix 7 critical issues before merge. Medium issues can follow in next sprint.

---

## 🔴 CRITICAL ISSUES (Blocking)

### CRIT-001: Trim Bug in Name Validation — Accepts Whitespace

**File:** `src/features/profile/components/ProfileEditCard.tsx:31-37`
**Severity:** 🔴 Critical
**Impact:** Violates AC #1 requirement (name must be ≥3 characters)

**Code:**
```typescript
async function handleSaveName() {
  if (!editedName.trim()) {  // ✓ Checks trim
    setValidationError('Polje je obvezno')
    return
  }
  if (editedName.length < 3) {  // ✗ Checks WITHOUT trim
    setValidationError('Najmanj 3 znaki')
    return
  }
  await updateProfile(userId, { first_name: editedName })  // Saves with whitespace!
}
```

**Example Failure:**
- Input: `"  ab  "` (2 chars + 4 spaces)
- Validation: `"  ab  ".length = 6 ≥ 3` ✓ PASS
- Saves to DB: `first_name = "  ab  "` ✗ FAIL

**Root Cause:** Trimming check on line 31, but length check on line 35 uses untrimmed value.

**Fix:**
```typescript
const trimmed = editedName.trim()
if (!trimmed) {
  setValidationError('Polje je obvezno')
  return
}
if (trimmed.length < 3) {
  setValidationError('Najmanj 3 znaki')
  return
}
await updateProfile(userId, { first_name: trimmed })  // ← Save trimmed
```

---

### CRIT-002: Trigger Conflict — Coalesce Empty String Bug

**File:** `supabase/migrations/036_add_user_profile_fields.sql:22-25`
**Severity:** 🔴 Critical
**Impact:** Race condition between trigger INSERT and RegisterContainer UPDATE

**Code:**
```sql
on conflict (id) do update
set first_name = coalesce(excluded.first_name, profiles.first_name),
    last_name = coalesce(excluded.last_name, profiles.last_name);
```

**Failure Scenario:**
1. User clicks signup → `auth.users` created
2. `handle_new_user` trigger fires → INSERT into profiles with `first_name = ''`
3. RegisterContainer.handleRegisterSubmit calls UPDATE `first_name = 'Ana'`
4. Trigger fires again (edge case) OR other process updates → ON CONFLICT merges
5. `coalesce('', 'Ana')` returns `''` → **name erased!**

**Root Cause:** Empty string is a valid value; `coalesce` treats it as present.

**Fix:**
```sql
-- Option 1: Don't re-upsert on conflict
on conflict (id) do nothing

-- Option 2: Only update if new value is non-empty
on conflict (id) do update
set first_name = CASE
  WHEN excluded.first_name != '' AND excluded.first_name IS NOT NULL
    THEN excluded.first_name
  ELSE profiles.first_name
END,
```

---

### CRIT-003: Concurrent Avatar Upload Race Condition

**File:** `src/features/profile/components/ProfileEditCard.tsx:64-95`
**Severity:** 🔴 Critical
**Impact:** Multiple parallel uploads overwrite each other; UI shows wrong avatar

**Code:**
```typescript
async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.currentTarget.files?.[0]
  if (!file) return

  setIsLoading(true)  // ← Only sets flag, doesn't prevent re-entry

  try {
    const newAvatarUrl = await uploadAvatar(userId, file)  // Async
    const oldAvatarUrl = currentAvatarUrl
    setCurrentAvatarUrl(newAvatarUrl)  // Optimistic

    await updateProfile(userId, { avatar_url: newAvatarUrl })  // Async
    // ...
  }
}
```

**Failure Scenario:**
```
User rapidly clicks "Naloži avatar" twice with files [A.jpg, B.jpg]

Timeline:
T1: Upload A.jpg → await uploadAvatar (pending)
T2: Upload B.jpg → await uploadAvatar (pending)
T3: A.jpg completes → setCurrentAvatarUrl(A_url) → await updateProfile(A_url)
T4: B.jpg completes → setCurrentAvatarUrl(B_url) → await updateProfile(B_url)
T5: updateProfile(B_url) completes first
T6: updateProfile(A_url) completes → DB has A_url but UI shows B_url
```

**Root Cause:** `input disabled={isLoading}` doesn't prevent onChange from firing; isLoading check missing at function entry.

**Fix:**
```typescript
async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.currentTarget.files?.[0]
  if (!file || isLoading) return  // ← Guard against re-entry

  setIsLoading(true)
  // ... rest
}
```

---

### CRIT-004: Silent Failure in Registration Profile Update

**File:** `src/features/auth/components/RegisterContainer.tsx:42-50`
**Severity:** 🔴 Critical
**Impact:** User doesn't know their name wasn't saved; violates AC #1

**Code:**
```typescript
if (data?.user) {
  const supabase = createClient()
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ first_name, last_name: last_name || null })
    .eq('id', data.user.id)

  if (updateError) {
    console.warn('Napaka pri posodobitvi profila:', updateError)  // Only console!
  }

  setError('Potrditveno sporočilo je bilo poslano...')  // Shows confirmation
  setIsLoading(false)
}
```

**Failure Scenario:**
1. User signup: name="Ana", email="user@example.com"
2. `auth.users` row created ✓
3. Trigger `handle_new_user` fires → INSERT profiles
4. RegisterContainer UPDATE fails (e.g., RLS policy, trigger conflict)
5. Error only in console ✗
6. User sees "Confirmation sent" ✓
7. User confirms email, logs in
8. Profile shows `first_name = ''` ✗ No visible error

**Root Cause:** Error handling missing user-facing feedback.

**Fix:**
```typescript
if (updateError) {
  setIsLoading(false)
  setError('Napaka pri shranjevanju podatkov profila. Poskusite znova.')
  return
}

setError('Potrditveno sporočilo je bilo poslano...')
setIsLoading(false)
```

---

### CRIT-005: Server-Side Validation Missing

**File:** Multiple (profileApi.ts, migration)
**Severity:** 🔴 Critical
**Impact:** Client-side validation can be bypassed via direct API calls

**Missing Validations:**
1. Avatar file size (only checked on client in profileApi.ts:23)
2. MIME type validation (not present anywhere)
3. first_name length constraint (only on client, no DB CHECK)
4. last_name data sanitization

**Attack Vector:**
```typescript
// User opens browser console and runs:
const supabase = createClient()
await supabase.from('profiles')
  .update({ first_name: 'ab' })
  .eq('id', userId)  // ✗ PASS — no server validation

await supabase.storage.from('avatars').upload(path, largeFile)  // >5MB, ✗ PASS
```

**Root Cause:** All validation in UI/client code; no server-side guards.

**Fix:**
```sql
-- In migration 036_add_user_profile_fields.sql:
ALTER TABLE public.profiles
ADD CONSTRAINT check_first_name_not_empty CHECK (first_name != ''),
ADD CONSTRAINT check_first_name_min_length CHECK (LENGTH(first_name) >= 3),
ADD CONSTRAINT check_first_name_max_length CHECK (LENGTH(first_name) <= 100);
```

```typescript
// In profileApi.ts:22-25:
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (file.size === 0) {
    throw new Error('Datoteka ne sme biti prazna')
  }
  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error(`Datoteka je prevelika. Največja velikost je 5 MB.`)
  }

  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedMimes.includes(file.type)) {
    throw new Error('Samo slike (JPEG, PNG, GIF, WebP) so dovoljene')
  }

  // ... rest
}
```

---

### CRIT-006: Orphaned Avatar Files in Storage

**File:** `src/features/profile/components/ProfileEditCard.tsx:64-95`
**Severity:** 🔴 Critical
**Impact:** Storage fills with unreferenced files; wasted storage costs

**Failure Scenario:**
```typescript
// Step 1: Upload succeeds
const newAvatarUrl = await uploadAvatar(userId, file)  // ✓ File in storage
setCurrentAvatarUrl(newAvatarUrl)  // Optimistic UI update

// Step 2: Profile update fails (network error, RLS policy, DB constraint)
await updateProfile(userId, { avatar_url: newAvatarUrl })  // ✗ FAIL

// Step 3: Rollback
setCurrentAvatarUrl(currentAvatarUrl)
toast.error('Napaka pri nalaganju avatarja')
// ✗ NEW FILE REMAINS IN STORAGE FOREVER!
```

**Root Cause:** No cleanup on updateProfile error.

**Fix:**
```typescript
async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.currentTarget.files?.[0]
  if (!file || isLoading) return

  setIsLoading(true)
  let uploadedAvatarUrl: string | null = null

  try {
    uploadedAvatarUrl = await uploadAvatar(userId, file)
    const oldAvatarUrl = currentAvatarUrl
    setCurrentAvatarUrl(uploadedAvatarUrl)

    await updateProfile(userId, { avatar_url: uploadedAvatarUrl })

    // Clean up old avatar only on success
    if (oldAvatarUrl) {
      await deleteAvatarFile(oldAvatarUrl).catch(() => {})
    }

    toast.success('Avatar je bil naložen')
    onProfileUpdate?.({ avatar_url: uploadedAvatarUrl })
  } catch (error) {
    // Clean up uploaded file on error
    if (uploadedAvatarUrl) {
      await deleteAvatarFile(uploadedAvatarUrl).catch(() => {
        console.warn('Cleanup failed for:', uploadedAvatarUrl)
      })
    }

    setCurrentAvatarUrl(currentAvatarUrl)
    toast.error(error instanceof Error ? error.message : 'Napaka pri nalaganju avatarja')
  } finally {
    setIsLoading(false)
  }
}
```

---

### CRIT-007: Race Condition in updateProfile — Fetch-Update Gap

**File:** `src/features/profile/api/profileApi.ts:54-63`
**Severity:** 🔴 Critical (Lower priority than above, but structural)
**Impact:** Concurrent updates can lose data during rollback

**Code:**
```typescript
export async function updateProfile(
  userId: string,
  updates: { first_name?: string; avatar_url?: string }
): Promise<{ old_avatar_url: string | null }> {
  const supabase = createClient()

  // Fetch current profile
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', userId)
    .single()  // ← T1

  const oldAvatarUrl = currentProfile?.avatar_url ?? null

  // ← GAP: Another process updates avatar_url here!

  // Update profile
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)  // ← T2

  // If old value changed, rollback uses stale data
}
```

**Failure Scenario:**
```
Two browsers updating simultaneously:

Browser A (ProfileEditCard):
  T1: Fetch avatar_url = 'url-old'
  T2: Delay (network jitter)
  Browser B updates avatar_url = 'url-new'
  T3: UPDATE avatar_url = 'url-brand-new'
  T4: Returns old_avatar_url = 'url-old' ✗ WRONG

If error occurs and rollback uses old_avatar_url, wrong file is set!
```

**Root Cause:** Separation of fetch and update; no optimistic concurrency control.

**Fix:**
```typescript
// Don't return old_avatar_url from server; rely on client-side optimistic state
// Or use UPDATE ... RETURNING old_value (PostgreSQL 14+)
export async function updateProfile(
  userId: string,
  updates: { first_name?: string; avatar_url?: string }
): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (error) {
    throw new Error(`Napaka pri posodobitvi profila: ${error.message}`, { cause: error })
  }
}

// Client-side keeps track of oldValue for rollback
// (Already done in ProfileEditCard with currentAvatarUrl state)
```

---

## 🟡 MEDIUM PRIORITY ISSUES

### MED-001: Missing maxLength on first_name Input

**Files:** `RegisterForm.tsx:74-88`, `ProfileEditCard.tsx:159-174`
**Issue:** User can enter 10,000+ characters → storage bloat, UI corruption

**Fix:**
```typescript
<input
  id="first_name"
  name="first_name"
  type="text"
  maxLength={100}  // ← Add this
  minLength={3}
  required
  placeholder="Najmanj 3 znaki"
  // ...
/>
```

---

### MED-002: last_name Not Trimmed Before Save

**Files:** `RegisterForm.tsx:44`, `RegisterContainer.tsx:45`
**Issue:** Whitespace-only name saves as-is or gets mishandled

**Fix:**
```typescript
// RegisterForm.tsx line 44:
onSubmit({
  first_name: firstNameInput.value.trim(),  // ← Add trim
  last_name: lastNameInput.value.trim() || null,  // ← Add trim
  password: passwordInput.value,
})

// RegisterContainer.tsx line 45:
.update({
  first_name: first_name.trim(),
  last_name: last_name?.trim() || null  // ← Add trim
})
```

---

### MED-003: MIME Type Validation Missing

**File:** `profileApi.ts:22-41`
**Issue:** User can upload `.exe`, `.zip`, `.html` files disguised as images

**Fix:**
```typescript
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

  if (!allowedMimes.includes(file.type)) {
    throw new Error('Samo slike (JPEG, PNG, GIF, WebP) so dovoljene')
  }

  // ... rest
}
```

---

### MED-004: Filename Not Sanitized for Length

**File:** `profileApi.ts:12-16`
**Issue:** Very long filenames can exceed filesystem limits or cause truncation

**Fix:**
```typescript
function generateAvatarPath(userId: string, fileName: string): string {
  const uuid = crypto.randomUUID()
  const safeFileName = fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 200)  // ← Limit length
  return `${userId}/${uuid}/${safeFileName}`
}
```

---

### MED-005: 0-Byte File Not Rejected

**File:** `profileApi.ts:22-25`
**Issue:** Empty file upload accepted; creates invalid storage object

**Fix:**
```typescript
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (file.size === 0) {
    throw new Error('Datoteka ne sme biti prazna')
  }
  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error(`Datoteka je prevelika. Največja velikost je 5 MB.`)
  }
  // ...
}
```

---

### MED-006: updateProfile Doesn't Check Affected Rows

**File:** `profileApi.ts:63`
**Issue:** UPDATE can return `{ error: null }` even if zero rows affected (user doesn't exist)

**Fix:**
```typescript
const { data, error, count } = await supabase
  .from('profiles')
  .update(updates)
  .eq('id', userId)

if (error) {
  throw new Error(`Napaka pri posodobitvi profila: ${error.message}`, { cause: error })
}

if (!count || count === 0) {
  throw new Error('Profil ne obstaja')
}
```

---

### MED-007: deleteAvatarFile Regex Fragile

**File:** `profileApi.ts:81`
**Issue:** URL parsing fails on special characters in filename (regex doesn't handle encoded paths)

**Current:**
```typescript
const match = avatarUrl.match(/\/avatars\/(.+)$/)
// Fails if avatar path contains URL-encoded characters like %20, %2F
```

**Fix:**
```typescript
const match = avatarUrl.match(/\/avatars\/(.+)$/)
if (!match) {
  console.warn('Napaka pri razčlenjevanju URL avatarja:', avatarUrl)
  return
}
const encodedPath = match[1]
const path = decodeURIComponent(encodedPath)  // ← Handle URL encoding
```

---

### MED-008: No RLS Policy Verification

**Issue:** No confirmation that Storage bucket `avatars` has correct RLS policies
**Impact:** Users might access other users' avatars or avatars might be publicly accessible

**Recommended RLS Policy:**
```sql
-- avatars bucket RLS
CREATE POLICY "Users can upload their own avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "All users can view avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');
```

---

## 🟠 ARCHITECTURAL ISSUES

### ARCH-001: Server-Side CHECK Constraints Missing

**File:** `036_add_user_profile_fields.sql`
**Issue:** No DB-level constraints; validation is client-side only

**Fix:** Add to migration:
```sql
ALTER TABLE public.profiles
ADD CONSTRAINT check_first_name_not_empty CHECK (first_name != ''),
ADD CONSTRAINT check_first_name_min_length CHECK (LENGTH(first_name) >= 3),
ADD CONSTRAINT check_first_name_max_length CHECK (LENGTH(first_name) <= 100),
ADD CONSTRAINT check_last_name_max_length CHECK (last_name IS NULL OR LENGTH(last_name) <= 100);
```

---

### ARCH-002: No Integration Tests for Auth Flow

**Issue:** No tests covering:
- signup → trigger → update sequence
- Race conditions between trigger and RegisterContainer update
- Error handling when profile update fails

**Recommendation:** Add integration test file:
```typescript
// tests/integration/auth/registration-flow.test.ts
describe('Registration Flow with Profile', () => {
  it('creates profile with first_name when signup succeeds', async () => {
    // Real Supabase instance
    const { user } = await signup({ email, password, first_name: 'Ana' })

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', user.id)
      .single()

    expect(profile.first_name).toBe('Ana')
  })
})
```

---

## 🔵 TEST COVERAGE GAPS

### TEST-001: ProfileEditCard.test.tsx Missing Trim Test

**Missing Test Case:**
```typescript
it('trims whitespace from first_name before saving', async () => {
  const user = userEvent.setup()
  const mockUpdateProfile = vi.mocked(profileApi.updateProfile)
  mockUpdateProfile.mockResolvedValue({ old_avatar_url: null })

  render(
    <ProfileEditCard
      userId="user-123"
      first_name="Janez"
      avatar_url={null}
      onProfileUpdate={vi.fn()}
    />
  )

  const editButton = screen.getByRole('button', { name: /Uredi/i })
  await user.click(editButton)

  const input = screen.getByDisplayValue('Janez')
  await user.clear(input)
  await user.type(input, '  Ana  ')  // Input with whitespace

  const saveButton = screen.getByRole('button', { name: /Shrani/i })
  await user.click(saveButton)

  await waitFor(() => {
    expect(mockUpdateProfile).toHaveBeenCalledWith('user-123', {
      first_name: 'Ana',  // ← Must be trimmed!
    })
  })
})
```

---

### TEST-002: ProfileEditCard.test.tsx Missing Avatar Tests

**Missing Test Cases:**
```typescript
describe('Avatar Upload', () => {
  it('rejects file larger than 5MB', async () => {
    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    })

    // Upload should fail
    expect(uploadAvatar('user-123', largeFile)).rejects.toThrow('prevelika')
  })

  it('cleans up orphaned file on update failure', async () => {
    const mockUploadAvatar = vi.mocked(profileApi.uploadAvatar)
    const mockUpdateProfile = vi.mocked(profileApi.updateProfile)
    const mockDeleteAvatarFile = vi.mocked(profileApi.deleteAvatarFile)

    mockUploadAvatar.mockResolvedValue('https://example.com/avatars/url')
    mockUpdateProfile.mockRejectedValue(new Error('Network error'))

    // ... render and trigger upload

    await waitFor(() => {
      expect(mockDeleteAvatarFile).toHaveBeenCalledWith('https://example.com/avatars/url')
    })
  })
})
```

---

### TEST-003: RegisterForm.test.tsx Missing Whitespace Test

**Missing Test Case:**
```typescript
it('rejects first_name with only whitespace', async () => {
  const user = userEvent.setup()
  const mockOnSubmit = vi.fn()

  render(
    <RegisterForm
      email="test@example.com"
      onSubmit={mockOnSubmit}
      isLoading={false}
      error={null}
    />
  )

  const input = screen.getByPlaceholderText('Najmanj 3 znaki')
  await user.type(input, '   ')  // Three spaces

  const submitButton = screen.getByRole('button', { name: /Dokončaj/i })
  await user.click(submitButton)

  await waitFor(() => {
    expect(screen.getByText('Najmanj 3 znaki')).toBeInTheDocument()
  })
  expect(mockOnSubmit).not.toHaveBeenCalled()
})
```

---

### TEST-004: profileApi.test.tsx Missing (Entire File)

**Recommendation:** Create new test file:
```typescript
// tests/unit/features/profile/profileApi.test.ts
describe('profileApi', () => {
  describe('uploadAvatar', () => {
    it('rejects 0-byte file', async () => {
      const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' })
      await expect(uploadAvatar('user-123', emptyFile))
        .rejects.toThrow('prazna')
    })

    it('rejects file > 5MB', async () => {
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg')
      await expect(uploadAvatar('user-123', largeFile))
        .rejects.toThrow('prevelika')
    })

    it('rejects non-image MIME types', async () => {
      const textFile = new File(['text content'], 'file.txt', { type: 'text/plain' })
      await expect(uploadAvatar('user-123', textFile))
        .rejects.toThrow(/samo|slike/i)
    })
  })

  describe('updateProfile', () => {
    it('throws error if profile does not exist', async () => {
      const nonExistentId = 'nonexistent-user-id'
      await expect(updateProfile(nonExistentId, { first_name: 'Ana' }))
        .rejects.toThrow()
    })
  })

  describe('deleteAvatarFile', () => {
    it('handles malformed URLs gracefully', async () => {
      const malformed = 'https://example.com/invalid/path'
      await expect(deleteAvatarFile(malformed)).resolves.not.toThrow()
      // Should log warning, not throw
    })
  })
})
```

---

## 📊 Fix Priority Matrix

| Issue ID | Title | Severity | Effort | Impact | Blockers Merge? |
|----------|-------|----------|--------|--------|-----------------|
| CRIT-001 | Trim bug in validation | 🔴 Critical | 5 min | High | ✅ YES |
| CRIT-002 | Trigger coalesce bug | 🔴 Critical | 10 min | High | ✅ YES |
| CRIT-003 | Concurrent upload race | 🔴 Critical | 15 min | High | ✅ YES |
| CRIT-004 | Silent profile update error | 🔴 Critical | 10 min | Medium | ✅ YES |
| CRIT-005 | Server-side validation missing | 🔴 Critical | 20 min | High | ✅ YES |
| CRIT-006 | Orphaned files in storage | 🔴 Critical | 15 min | Medium | ✅ YES |
| CRIT-007 | Fetch-update race condition | 🔴 Critical | 20 min | Low | ⚠️ MAYBE |
| MED-001 | Missing maxLength | 🟡 Medium | 2 min | Low | ❌ NO |
| MED-002 | last_name not trimmed | 🟡 Medium | 5 min | Low | ❌ NO |
| MED-003 | MIME type validation | 🟡 Medium | 10 min | Medium | ❌ NO |
| MED-004 | Filename length limit | 🟡 Medium | 5 min | Low | ❌ NO |
| MED-005 | 0-byte file allowed | 🟡 Medium | 5 min | Low | ❌ NO |
| MED-006 | No affected rows check | 🟡 Medium | 10 min | Low | ❌ NO |
| MED-007 | Fragile URL parsing | 🟡 Medium | 10 min | Low | ❌ NO |
| MED-008 | RLS policy verification | 🟡 Medium | 20 min | High | ❌ NO |
| ARCH-001 | No DB constraints | 🟠 Architecture | 10 min | High | ✅ YES |
| ARCH-002 | No integration tests | 🟠 Architecture | 30 min | Medium | ⚠️ MAYBE |
| TEST-001 | Trim test missing | 🔵 Test Gap | 10 min | Medium | ⚠️ MAYBE |
| TEST-002 | Avatar tests missing | 🔵 Test Gap | 20 min | Medium | ⚠️ MAYBE |
| TEST-003 | Whitespace test missing | 🔵 Test Gap | 5 min | Low | ❌ NO |
| TEST-004 | profileApi.test missing | 🔵 Test Gap | 30 min | High | ✅ YES |

---

## ✅ Positive Findings

1. **Smart Container / Dumb UI Pattern** — ProfileScreen (container) properly delegates to ProfileEditCard (dumb component) ✓
2. **RSC + Client Components** — Good separation: RSC for data loading, Client Components for interactivity ✓
3. **snake_case Database Fields** — Consistently uses `first_name`, `last_name` from DB (no camelCase mapping) ✓
4. **Optimistic Updates** — ProfileEditCard correctly updates UI before server response ✓
5. **Error Handling (Partial)** — ProfileEditCard shows toast on error; just needs orphaned file cleanup ✓
6. **Test Structure** — Uses proper mocking with vitest + @testing-library/react ✓

---

## 🎯 Recommendation & Next Steps

### Before Merge (Critical Path ~ 2 hours)

**Must Fix (Blocking):**
1. ✅ CRIT-001: Trim bug (5 min)
2. ✅ CRIT-002: Trigger coalesce bug (10 min)
3. ✅ CRIT-003: Concurrent upload race (15 min)
4. ✅ CRIT-004: Silent error in registration (10 min)
5. ✅ CRIT-005: Server-side validation + DB constraints (20 min)
6. ✅ CRIT-006: Orphaned file cleanup (15 min)
7. ✅ ARCH-001: Add DB constraints (10 min)
8. ✅ TEST-004: Create profileApi.test.tsx (30 min)

**Estimated Time:** 115 minutes (~2 hours)

### After Merge (Follow-up Sprint)

**Should Fix (Medium Priority):**
- MED-001 through MED-008 (70 min total)
- CRIT-007: Refactor updateProfile pattern (20 min)
- TEST-001, TEST-002, TEST-003: Add missing tests (25 min)
- ARCH-002: Add integration tests (30 min)

---

## 🔏 Sign-Off

**Review Completion Date:** 2026-03-30
**Reviewer:** Adversarial General Code Review
**Recommendation:** **🛑 DO NOT MERGE** until 7 critical issues are resolved

**Critical Failures Found:**
- ✅ 7 blocking issues
- ✅ 8 medium issues
- ✅ 2 architectural gaps
- ✅ 4 test coverage gaps

**Total Issues:** 21

---

## Appendix: Quick Fix Checklist

```markdown
- [ ] CRIT-001: Fix trim validation in ProfileEditCard.tsx:31-37
- [ ] CRIT-002: Change trigger logic to use `on conflict (id) do nothing`
- [ ] CRIT-003: Add `if (isLoading) return` guard in handleAvatarUpload
- [ ] CRIT-004: Add user-facing error message in RegisterContainer
- [ ] CRIT-005: Add MIME type + server validation in uploadAvatar
- [ ] CRIT-006: Add deleteAvatarFile call on updateProfile error
- [ ] ARCH-001: Add CHECK constraints to migration
- [ ] TEST-004: Create profileApi.test.tsx with edge cases
- [ ] MED-001: Add maxLength={100} to inputs
- [ ] MED-002: Add trim() to last_name
- [ ] MED-003: Validate MIME types
- [ ] Verify RLS policies on avatars bucket
- [ ] Run `npm run test` and `npm run typecheck`
- [ ] Final review before merge
```

