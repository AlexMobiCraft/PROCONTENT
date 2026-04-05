-- Migration 039: Create inline-images storage bucket and RLS policies
-- Story 7.1: WYSIWYG-редактор для инлайн-изображений в постах

-- 1. Create inline-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('inline-images', 'inline-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS Policies for inline-images bucket
-- Allow authenticated users to upload inline images
CREATE POLICY "authenticated_can_upload_inline_images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'inline-images');

-- Allow public read access to inline images
CREATE POLICY "public_can_read_inline_images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'inline-images');

-- Allow authenticated users to delete inline images
CREATE POLICY "authenticated_can_delete_inline_images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'inline-images');
