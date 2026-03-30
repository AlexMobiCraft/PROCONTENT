-- Migration: Allow anonymous users to read post_media for published posts
-- Story: 5.1 Telegram Migration

DROP POLICY IF EXISTS "post_media_select_anon" ON public.post_media;

CREATE POLICY "post_media_select_anon"
  ON public.post_media FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_media.post_id
        AND posts.is_published = true
    )
  );
