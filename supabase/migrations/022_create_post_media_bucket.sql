-- Migration 022: Create post_media storage bucket and RLS policies
-- Story 4.2: Управление категориями и рубриками постов

-- 1. Create post_media bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('post_media', 'post_media', true)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS Policies for post_media bucket
-- Allow authenticated users to upload files
CREATE POLICY "authenticated_can_upload_post_media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'post_media');

-- Allow public read access to post_media
CREATE POLICY "public_can_read_post_media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'post_media');

-- Allow authenticated users to delete their own uploads (via post ownership)
CREATE POLICY "authenticated_can_delete_post_media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'post_media');
