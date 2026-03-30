# Critical Fixes Execution Plan

## Overview

7 blocking issues identified. Each fix is isolated and can be applied independently. Estimated execution time: **2 hours**.

---

## Fix #1: Trim Bug in ProfileEditCard (5 min)

**File:** `src/features/profile/components/ProfileEditCard.tsx`

**Current Code (Lines 30-56):**
```typescript
async function handleSaveName() {
  if (!editedName.trim()) {
    setValidationError('Polje je obvezno')
    return
  }
  if (editedName.length < 3) {  // ❌ BUG: checks untrimmed
    setValidationError('Najmanj 3 znaki')
    return
  }

  setIsLoading(true)
  setValidationError(null)

  try {
    await updateProfile(userId, { first_name: editedName })  // ❌ saves untrimmed
    // ...
  }
}
```

**Fixed Code:**
```typescript
async function handleSaveName() {
  const trimmed = editedName.trim()  // ← Create trimmed var

  if (!trimmed) {
    setValidationError('Polje je obvezno')
    return
  }
  if (trimmed.length < 3) {  // ← Check trimmed
    setValidationError('Najmanj 3 znaki')
    return
  }

  setIsLoading(true)
  setValidationError(null)

  try {
    // eslint-disable-next-line camelcase
    await updateProfile(userId, { first_name: trimmed })  // ← Save trimmed
    toast.success('Ime je bilo posodobljeno')
    setIsEditing(false)
    // eslint-disable-next-line camelcase
    onProfileUpdate?.({ first_name: trimmed })
  } catch (error) {
    setEditedName(first_name) // Rollback
    toast.error(error instanceof Error ? error.message : 'Napaka pri posodobitvi imena')
  } finally {
    setIsLoading(false)
  }
}
```

**Verification:**
```bash
npm run test -- ProfileEditCard.test.tsx
# Should pass all existing tests + new trim test (will add)
```

---

## Fix #2: Trigger Coalesce Bug (10 min)

**File:** `supabase/migrations/036_add_user_profile_fields.sql`

**Current Code (Lines 14-28):**
```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (new.id, new.email, '', null)
  on conflict (id) do update
  set email = excluded.email,
      first_name = coalesce(excluded.first_name, profiles.first_name),
      last_name = coalesce(excluded.last_name, profiles.last_name);
  return new;
end;
$$;
```

**Fixed Code:**
```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (new.id, new.email, '', null)
  on conflict (id) do nothing;  -- ← Simply don't re-upsert
  return new;
end;
$$;
```

**Rationale:**
- Trigger fires on auth.users INSERT → creates profiles row
- RegisterContainer then updates first_name explicitly
- No need to re-merge via ON CONFLICT
- `do nothing` avoids overwriting with empty string

**Verification:**
```bash
# After migration:
1. Sign up new user with first_name="Ana"
2. Check profiles table → first_name="Ana" (not empty)
3. Verify email confirmed flow works
```

---

## Fix #3: Concurrent Upload Race Condition (15 min)

**File:** `src/features/profile/components/ProfileEditCard.tsx`

**Current Code (Lines 64-95):**
```typescript
async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.currentTarget.files?.[0]
  if (!file) return

  setIsLoading(true)  // ← Sets flag, but doesn't prevent re-entry

  try {
    const newAvatarUrl = await uploadAvatar(userId, file)
    // ... rest
  }
}
```

**Fixed Code:**
```typescript
async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.currentTarget.files?.[0]
  if (!file || isLoading) return  // ← Guard re-entry

  setIsLoading(true)

  let uploadedAvatarUrl: string | null = null

  try {
    uploadedAvatarUrl = await uploadAvatar(userId, file)

    // Update profile with new avatar URL
    const oldAvatarUrl = currentAvatarUrl
    setCurrentAvatarUrl(uploadedAvatarUrl)

    await updateProfile(userId, { avatar_url: uploadedAvatarUrl })

    // Clean up old avatar if it exists
    if (oldAvatarUrl) {
      await deleteAvatarFile(oldAvatarUrl).catch(() => {
        // Ignore cleanup errors
      })
    }

    toast.success('Avatar je bil naložen')
    onProfileUpdate?.({ avatar_url: uploadedAvatarUrl })
  } catch (error) {
    // Clean up orphaned file on error (Fix #6)
    if (uploadedAvatarUrl) {
      await deleteAvatarFile(uploadedAvatarUrl).catch(() => {
        console.warn('Cleanup failed for:', uploadedAvatarUrl)
      })
    }

    // Rollback avatar URL in UI
    setCurrentAvatarUrl(currentAvatarUrl)
    toast.error(error instanceof Error ? error.message : 'Napaka pri nalaganju avatarja')
  } finally {
    setIsLoading(false)
  }
}
```

**Test Scenario:**
```typescript
// Add to ProfileEditCard.test.tsx
it('prevents concurrent avatar uploads', async () => {
  const user = userEvent.setup({ delay: null })
  const mockUpload = vi.mocked(profileApi.uploadAvatar)

  mockUpload.mockImplementation(() => new Promise(r =>
    setTimeout(() => r('https://example.com/avatar.jpg'), 100)
  ))

  render(<ProfileEditCard userId="user-123" ... />)

  const input = screen.getByRole('slider')  // file input
  const file1 = new File(['a'], 'a.jpg', { type: 'image/jpeg' })
  const file2 = new File(['b'], 'b.jpg', { type: 'image/jpeg' })

  // Simulate rapid clicks
  await user.upload(input, file1)
  await user.upload(input, file2)

  // Only one upload should complete
  expect(mockUpload).toHaveBeenCalledTimes(1)
})
```

---

## Fix #4: Silent Profile Update Error (10 min)

**File:** `src/features/auth/components/RegisterContainer.tsx`

**Current Code (Lines 39-56):**
```typescript
if (data?.user) {
  // Обновить профиль с first_name и last_name
  const supabase = createClient()
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ first_name, last_name: last_name || null })
    .eq('id', data.user.id)

  if (updateError) {
    console.warn('Napaka pri posodobitvi profila:', updateError)  // ❌ Silent
  }

  setError('Potrditveno sporočilo je bilo poslano na vašo e-pošto. Potrdite e-pošto za vstop v klub.')
  setIsLoading(false)
}
```

**Fixed Code:**
```typescript
if (data?.user) {
  // Обновить профиль с first_name и last_name
  const supabase = createClient()
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      first_name: first_name.trim(),  // ← Also trim here
      last_name: last_name?.trim() || null  // ← Also trim here
    })
    .eq('id', data.user.id)

  if (updateError) {
    console.error('Profile update failed:', updateError)  // Log for debugging
    setIsLoading(false)
    setError('Napaka pri shranjevanju podatkov profila. Poskusite znova registracijo.')
    return  // ← Don't show success message on error
  }

  setError('Potrditveno sporočilo je bilo poslano na vašo e-pošto. Potrdite e-pošto za vstop v klub.')
  setIsLoading(false)
}
```

**Verification:**
- Test with invalid user ID → should show error message to user
- Test with RLS policy blocking update → should show error message

---

## Fix #5: Server-Side Validation Missing (20 min)

**File A:** `src/features/profile/api/profileApi.ts`

**Current Code (Lines 22-41):**
```typescript
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error(`Datoteka je prevelika. Največja velikost je 5 MB.`)
  }

  const supabase = createClient()
  const path = generateAvatarPath(userId, file.name)

  const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(path, file, {
    upsert: false,
    cacheControl: '3600',
  })

  if (error) {
    throw new Error(`Napaka pri nalaganju slike: ${error.message}`, { cause: error })
  }

  const { data: urlData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
  return urlData.publicUrl
}
```

**Fixed Code:**
```typescript
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  // ✅ NEW: MIME type validation
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedMimes.includes(file.type)) {
    throw new Error('Samo slike (JPEG, PNG, GIF, WebP) so dovoljene')
  }

  // ✅ NEW: 0-byte file check
  if (file.size === 0) {
    throw new Error('Datoteka ne sme biti prazna')
  }

  // ✅ EXISTING: Size check
  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error(`Datoteka je prevelika. Največja velikost je 5 MB.`)
  }

  const supabase = createClient()
  const path = generateAvatarPath(userId, file.name)

  const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(path, file, {
    upsert: false,
    cacheControl: '3600',
  })

  if (error) {
    throw new Error(`Napaka pri nalaganju slike: ${error.message}`, { cause: error })
  }

  const { data: urlData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
  return urlData.publicUrl
}
```

**File B:** `supabase/migrations/036_add_user_profile_fields.sql`

**Add to migration (after the alter table statements):**
```sql
-- Add CHECK constraints for data integrity
ALTER TABLE public.profiles
ADD CONSTRAINT check_first_name_not_empty CHECK (first_name != ''),
ADD CONSTRAINT check_first_name_min_length CHECK (LENGTH(first_name) >= 3),
ADD CONSTRAINT check_first_name_max_length CHECK (LENGTH(first_name) <= 100),
ADD CONSTRAINT check_last_name_max_length CHECK (last_name IS NULL OR LENGTH(last_name) <= 100);
```

**Verification:**
```bash
npm run test -- profileApi.test.tsx
# Will test edge cases in Fix #8
```

---

## Fix #6: Orphaned Avatar Files Cleanup (15 min)

**File:** `src/features/profile/components/ProfileEditCard.tsx`

**Already shown in Fix #3**, but let me highlight the critical part:

**In catch block (Lines 88-91):**
```typescript
} catch (error) {
  // Clean up orphaned file on error
  if (uploadedAvatarUrl) {  // ← New tracking variable
    await deleteAvatarFile(uploadedAvatarUrl).catch(() => {
      console.warn('Cleanup failed for:', uploadedAvatarUrl)
    })
  }

  // Rollback avatar URL in UI
  setCurrentAvatarUrl(currentAvatarUrl)
  toast.error(error instanceof Error ? error.message : 'Napaka pri nalaganju avatarja')
} finally {
  setIsLoading(false)
}
```

**Why this works:**
- `uploadedAvatarUrl` tracks the newly uploaded file
- If `updateProfile()` fails, we immediately delete the orphaned file
- Best-effort cleanup (doesn't throw if delete also fails)

---

## Fix #7: Add DB Constraints (10 min)

**File:** `supabase/migrations/036_add_user_profile_fields.sql`

**Already included in Fix #5.** Add after the alter table alter column statements:

```sql
-- Line 12 in current migration, add after:
-- Удалить default после добавления данных для новых пользователей
alter table public.profiles
  alter column first_name drop default;

-- ✅ NEW: Add this:
-- Add CHECK constraints for data integrity
alter table public.profiles
add constraint check_first_name_not_empty check (first_name != ''),
add constraint check_first_name_min_length check (length(first_name) >= 3),
add constraint check_first_name_max_length check (length(first_name) <= 100),
add constraint check_last_name_max_length check (last_name is null or length(last_name) <= 100);
```

---

## Fix #8: Create profileApi.test.ts (30 min)

**File:** `tests/unit/features/profile/profileApi.test.ts` (NEW)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uploadAvatar, updateProfile, deleteAvatarFile } from '@/features/profile/api/profileApi'

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn((bucket) => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
        remove: vi.fn(),
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  })),
}))

describe('uploadAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects 0-byte file', async () => {
    const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' })

    await expect(uploadAvatar('user-123', emptyFile))
      .rejects.toThrow('prazna')
  })

  it('rejects file larger than 5MB', async () => {
    const largeFile = new File(
      [new ArrayBuffer(6 * 1024 * 1024)],
      'large.jpg',
      { type: 'image/jpeg' }
    )

    await expect(uploadAvatar('user-123', largeFile))
      .rejects.toThrow('prevelika')
  })

  it('rejects non-image MIME types', async () => {
    const textFile = new File(['text'], 'file.txt', { type: 'text/plain' })

    await expect(uploadAvatar('user-123', textFile))
      .rejects.toThrow(/samo|slike/i)
  })

  it('rejects executable files', async () => {
    const exeFile = new File(['MZ'], 'payload.exe', { type: 'application/x-msdownload' })

    await expect(uploadAvatar('user-123', exeFile))
      .rejects.toThrow(/samo|slike/i)
  })

  it('accepts valid image file (exactly 5MB)', async () => {
    const validFile = new File(
      [new ArrayBuffer(5 * 1024 * 1024)],
      'avatar.jpg',
      { type: 'image/jpeg' }
    )

    // Mock successful upload
    const mockCreateClient = vi.mocked(require('@/lib/supabase/client').createClient)
    const mockStorage = {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/avatar.jpg' },
        }),
      })),
    }
    mockCreateClient.mockReturnValue({ storage: mockStorage })

    const url = await uploadAvatar('user-123', validFile)
    expect(url).toBe('https://example.com/avatar.jpg')
  })
})

describe('deleteAvatarFile', () => {
  it('handles malformed URLs gracefully', async () => {
    const malformed = 'https://example.com/invalid/path'

    await expect(deleteAvatarFile(malformed)).resolves.not.toThrow()
    // Should log warning, not throw
  })

  it('extracts path from public URL', async () => {
    const url = 'https://xxxxx.supabase.co/storage/v1/object/public/avatars/user-123/uuid/avatar.jpg'

    const mockCreateClient = vi.mocked(require('@/lib/supabase/client').createClient)
    const mockRemove = vi.fn().mockResolvedValue({ error: null })
    mockCreateClient.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          remove: mockRemove,
        })),
      },
    })

    await deleteAvatarFile(url)

    expect(mockRemove).toHaveBeenCalledWith(['user-123/uuid/avatar.jpg'])
  })
})

describe('updateProfile', () => {
  it('throws error if profile does not exist', async () => {
    const mockCreateClient = vi.mocked(require('@/lib/supabase/client').createClient)
    mockCreateClient.mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: new Error('Not found'), count: 0 }),
      })),
    })

    await expect(updateProfile('nonexistent-id', { first_name: 'Ana' }))
      .rejects.toThrow()
  })
})
```

---

## Summary: Apply in Order

1. ✅ Fix #2 (Trigger) — Deploy migration first
2. ✅ Fix #1 (Trim) — Deploy ProfileEditCard
3. ✅ Fix #3 (Concurrency) — Deploy ProfileEditCard update
4. ✅ Fix #4 (Silent Error) — Deploy RegisterContainer
5. ✅ Fix #5 (Validation) — Deploy profileApi + migration update
6. ✅ Fix #6 (Orphaned Files) — Already in Fix #3
7. ✅ Fix #7 (Constraints) — Already in Fix #5
8. ✅ Fix #8 (Tests) — Add profileApi.test.ts

**Estimated Total Time:** 2 hours
**Can run parallel:** Fixes #1, #4, #8 (independent)

