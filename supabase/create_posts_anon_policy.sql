-- Добавить политику для anonymous read публичных постов
CREATE POLICY "Posts are viewable by anonymous users"
  ON public.posts FOR SELECT
  TO anon
  USING (is_published = true);
