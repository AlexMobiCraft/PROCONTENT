-- Cleanup: remove duplicate posts from seed runs
-- logic: keep one post per (title, excerpt, category) combination
DELETE FROM public.posts
WHERE id NOT IN (
    SELECT DISTINCT ON (title, excerpt, category) id
    FROM public.posts
    ORDER BY title, excerpt, category, created_at ASC
);
