-- Migration 021: Create categories table
-- Story 4.2: Управление категориями и рубриками постов

-- 1. Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- All users (including anonymous) can read categories — world-readable reference data
CREATE POLICY "categories_select_public"
  ON public.categories FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only admin can insert/update/delete categories
CREATE POLICY "categories_all_admin"
  ON public.categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 4. Seed with current categories (from migration 015 CHECK constraint)
INSERT INTO public.categories (name, slug) VALUES
  ('Tema meseca', 'tema'),
  ('Začetek', 'zacetek'),
  ('Stories', 'stories'),
  ('Estetski kadri in feed', 'estetski-kadri'),
  ('Snemanje videov', 'snemanje'),
  ('Izrezi (framingi)', 'izrezi'),
  ('Komercialni profili', 'komercialni'),
  ('UGC', 'ugc'),
  ('Objavljanje in reels', 'objavljanje'),
  ('Drugo', 'drugo');

-- 5. Update default category to a valid slug
ALTER TABLE public.posts ALTER COLUMN category SET DEFAULT 'drugo';

-- 6. Drop the old CHECK constraint on posts.category
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_category_check;

-- 7. Backfill NULL or invalid category values before adding FK constraint
--    Prevents migration failure if posts.category has rows not present in categories.slug
UPDATE public.posts
  SET category = 'drugo'
  WHERE category IS NULL
     OR category NOT IN (SELECT slug FROM public.categories);

-- 8. Add FK from posts.category → categories.slug
-- ON UPDATE RESTRICT: explicit slug renames must be coordinated; prevents silent data corruption
-- ON DELETE RESTRICT: can't delete a category that's in use
ALTER TABLE public.posts
  ADD CONSTRAINT posts_category_fkey
  FOREIGN KEY (category) REFERENCES public.categories(slug)
  ON UPDATE RESTRICT ON DELETE RESTRICT;
