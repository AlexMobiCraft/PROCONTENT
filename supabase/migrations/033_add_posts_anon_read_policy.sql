-- Migration: Allow anonymous users to read published posts
-- Story: 5.1 Telegram Migration
-- Problem: Frontend uses anonymous Supabase client, but RLS blocks anonymous read
-- Solution: Add SELECT policy for anon role

DROP POLICY IF EXISTS "Posts are viewable by anonymous users" ON public.posts;

CREATE POLICY "Posts are viewable by anonymous users"
  ON public.posts FOR SELECT
  TO anon
  USING (is_published = true);
