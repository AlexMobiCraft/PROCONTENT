-- Migration 042: Create avatars storage bucket and RLS policies
-- Fix: загрузка аватара падала с "Bucket not found" — bucket не существовал.
-- Путь файла: {userId}/{uuid}/{filename} (см. generateAvatarPath в profileApi.ts).

-- 1. Create avatars bucket с лимитом размера и whitelist MIME-типов.
--    file_size_limit: клиент сжимает до ~200 КБ; 2 МБ — запас для no-op пути (≤256 КБ as-is).
--    allowed_mime_types: WebP/JPEG — выход сжатия; PNG/GIF — допустимы на no-op пути.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public = EXCLUDED.public;

-- 2. RLS Policies for avatars bucket
-- Загружать может только аутентифицированный пользователь и только в свою папку
-- (первый сегмент пути = auth.uid()).
CREATE POLICY "users_can_upload_own_avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Публичное чтение аватаров (отображаются по public URL).
CREATE POLICY "public_can_read_avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Удалять может только владелец (cleanup старого аватара при замене).
CREATE POLICY "users_can_delete_own_avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
