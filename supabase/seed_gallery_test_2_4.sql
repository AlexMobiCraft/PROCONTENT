-- Seed: Тестовые посты для галереи (История 2.4-галерея-grid-адаптивная-верстка)
-- Описание: 2, 3, 4, 5, 6 и 7 элементов (фото, видео и смешанные)

DO $$
DECLARE
  v_author_id UUID;
  v_post_id UUID;
BEGIN
  -- Берем первого администратора или первого пользователя
  SELECT id INTO v_author_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
  IF v_author_id IS NULL THEN
    SELECT id INTO v_author_id FROM auth.users LIMIT 1;
  END IF;

  IF v_author_id IS NULL THEN
    RAISE NOTICE 'Пользователи не найдены — сид пропущен';
    RETURN;
  END IF;

  -- Очистка предыдущих тестовых постов (по заголовку), чтобы можно было перезапускать
  DELETE FROM public.posts WHERE title LIKE 'Тест % элемента%';

  -- ── 1. Пост с 2 элементами (Фото) ──────────────────────────────────────────
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count)
  VALUES (v_author_id, 'Тест 2 элемента: Фото', 'Галерея из 2 фотографий для проверки сетки 2.4', 'snemanje', 'gallery', 12, 2)
  RETURNING id INTO v_post_id;
  
  INSERT INTO public.post_media (post_id, media_type, url, order_index, is_cover) VALUES
  (v_post_id, 'image', 'https://picsum.photos/seed/p2_1/800/600', 0, true),
  (v_post_id, 'image', 'https://picsum.photos/seed/p2_2/800/600', 1, false);

  -- ── 2. Пост с 3 элементами (Видео) ─────────────────────────────────────────
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count)
  VALUES (v_author_id, 'Тест 3 элемента: Видео', 'Мульти-видео пост из 3 элементов для проверки сетки 2.4', 'izrezi', 'multi-video', 25, 5)
  RETURNING id INTO v_post_id;

  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover) VALUES
  (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'https://picsum.photos/seed/v3_1/800/450', 0, true),
  (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 'https://picsum.photos/seed/v3_2/800/450', 1, false),
  (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 'https://picsum.photos/seed/v3_3/800/450', 2, false);

  -- ── 3. Пост с 4 элементами (Смешанный: 2 фото + 2 видео) ────────────────────
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count)
  VALUES (v_author_id, 'Тест 4 элемента: Смешанный', '2 фото и 2 видео в одном посту для проверки адаптивной сетки', 'komercialni', 'gallery', 42, 8)
  RETURNING id INTO v_post_id;

  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover) VALUES
  (v_post_id, 'image', 'https://picsum.photos/seed/m4_1/800/600', NULL, 0, true),
  (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', 'https://picsum.photos/seed/m4_2/800/450', 1, false),
  (v_post_id, 'image', 'https://picsum.photos/seed/m4_3/800/600', NULL, 2, false),
  (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', 'https://picsum.photos/seed/m4_4/800/450', 3, false);

  -- ── 4. Пост с 5 элементами (Фото) ──────────────────────────────────────────
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count)
  VALUES (v_author_id, 'Тест 5 элементов: Фото', 'Галерея из 5 фотографий для проверки сетки 2.4', 'estetski-kadri', 'gallery', 56, 12)
  RETURNING id INTO v_post_id;

  INSERT INTO public.post_media (post_id, media_type, url, order_index, is_cover) VALUES
  (v_post_id, 'image', 'https://picsum.photos/seed/p5_1/800/600', 0, true),
  (v_post_id, 'image', 'https://picsum.photos/seed/p5_2/800/600', 1, false),
  (v_post_id, 'image', 'https://picsum.photos/seed/p5_3/800/600', 2, false),
  (v_post_id, 'image', 'https://picsum.photos/seed/p5_4/800/600', 3, false),
  (v_post_id, 'image', 'https://picsum.photos/seed/p5_5/800/600', 4, false);

  -- ── 5. Пост с 6 элементами (Видео) ─────────────────────────────────────────
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count)
  VALUES (v_author_id, 'Тест 6 элементов: Видео', 'Мульти-видео пост из 6 элементов для проверки сетки 2.4', 'objavljanje', 'multi-video', 89, 15)
  RETURNING id INTO v_post_id;

  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover) VALUES
  (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', 'https://picsum.photos/seed/v6_1/800/450', 0, true),
  (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', 'https://picsum.photos/seed/v6_2/800/450', 1, false),
  (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', 'https://picsum.photos/seed/v6_3/800/450', 2, false),
  (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackAd.mp4', 'https://picsum.photos/seed/v6_4/800/450', 3, false),
  (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', 'https://picsum.photos/seed/v6_5/800/450', 4, false),
  (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4', 'https://picsum.photos/seed/v6_6/800/450', 5, false);

  -- ── 6. Пост с 7 элементами (Смешанный: 4 фото + 3 видео) ────────────────────
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count)
  VALUES (v_author_id, 'Тест 7 элементов: Смешанный', 'Сложная комбинация из 7 элементов для проверки лимита +N на сетке', 'zacetek', 'gallery', 104, 21)
  RETURNING id INTO v_post_id;

  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover) VALUES
  (v_post_id, 'image', 'https://picsum.photos/seed/m7_1/800/600', NULL, 0, true),
  (v_post_id, 'image', 'https://picsum.photos/seed/m7_2/800/600', NULL, 1, false),
  (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4', 'https://picsum.photos/seed/m7_3/800/450', 2, false),
  (v_post_id, 'image', 'https://picsum.photos/seed/m7_4/800/600', NULL, 3, false),
  (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4', 'https://picsum.photos/seed/m7_5/800/450', 4, false),
  (v_post_id, 'image', 'https://picsum.photos/seed/m7_6/800/600', NULL, 5, false),
  (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'https://picsum.photos/seed/m7_7/800/450', 6, false);

  RAISE NOTICE 'Сид завершен: добавлено 6 тестовых постов (2-7 элементов)';
END $$;
