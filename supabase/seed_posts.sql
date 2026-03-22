-- Seed: тестовые посты для разработки
-- Story: 2.3 Оптимизированное отображение медиа в карточках (LazyMediaWrapper)
-- Примечание: запускать только в dev/staging окружении
-- Требование: существующий пользователь в auth.users

DO $$
DECLARE
  v_author_id UUID;
  v_post_id UUID;
BEGIN
  -- Берём первого пользователя из auth.users
  SELECT id INTO v_author_id FROM auth.users LIMIT 1;

  IF v_author_id IS NULL THEN
    RAISE NOTICE 'В auth.users нет пользователей — seed пропущен';
    RETURN;
  END IF;

  -- Текстовые посты (без медиа)
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at) VALUES
  (v_author_id, 'Как я выстроила контент-стратегию на год вперёд', 'Разбираю свой процесс планирования: от анализа аудитории до конкретных рубрик и форматов.', 'insight', 'text', 24, 5, now() - interval '1 day'),
  (v_author_id, 'Анализ: почему Reels перестали работать как раньше', 'Алгоритм изменился. Я заметила это на своём профиле и вот как адаптировала подход.', 'razobory', 'text', 41, 12, now() - interval '2 days'),
  (v_author_id, 'Съёмка без студии: моя домашняя установка для lifestyle-фото', 'Показываю оборудование, которое использую дома, и как добиться чистого света.', 'syomka', 'text', 67, 8, now() - interval '3 days'),
  (v_author_id, 'Почему я перестала следить за трендами в Reels', 'Три месяца экспериментов с вертикальным видео — что работает, а что нет.', 'reels', 'text', 33, 6, now() - interval '4 days'),
  (v_author_id, 'Коллаборации с брендами: как не потерять себя', 'Мой чек-лист для оценки партнёрских предложений и переговоров об условиях.', 'brendy', 'text', 19, 3, now() - interval '5 days'),
  (v_author_id, 'Тема месяца: выгорание контент-мейкера', 'Что помогло мне вернуться к работе после двух месяцев молчания.', 'tema', 'text', 88, 21, now() - interval '6 days'),
  (v_author_id, 'Инсайт: аудитории не нужна идеальность', 'Почему мои "несовершенные" посты собирают больший охват, чем тщательно отполированные.', 'insight', 'text', 55, 14, now() - interval '7 days'),
  (v_author_id, 'Анализ профиля: что бы я сделала иначе', 'Разбираю один из лучших профилей в нише с точки зрения стратегии и контента.', 'razobory', 'text', 29, 7, now() - interval '8 days'),
  (v_author_id, 'Lightroom-пресеты для тёплой осенней эстетики', 'Делюсь пресетами, которые использую для единого стиля в ленте.', 'syomka', 'text', 74, 18, now() - interval '9 days'),
  (v_author_id, 'Структура моего контент-плана на месяц', 'Шаблон и процесс планирования: как поддерживаю баланс между личным и продающим.', 'insight', 'text', 62, 11, now() - interval '10 days'),
  (v_author_id, 'Reels за 30 минут: моя быстрая установка', 'Как снимать видео без лишних трат времени, сохраняя качество.', 'reels', 'text', 47, 9, now() - interval '11 days'),
  (v_author_id, 'Как выбираю бренды для долгосрочного сотрудничества', 'Критерии, которые помогают не ошибиться при выборе рекламодателя.', 'brendy', 'text', 38, 4, now() - interval '12 days'),
  (v_author_id, 'Творческий кризис: норма и как с ним жить', 'Честный разговор о периодах, когда вообще не хочется снимать или писать.', 'tema', 'text', 91, 25, now() - interval '13 days');

  -- Story 2.3: медиапосты для визуального тестирования LazyMediaWrapper (AC 5, AC 9)
  -- Используем post_media вместо устаревшего image_url в posts
  -- Изображения: picsum.photos (детерминированные сиды, портрет 4/5 и пейзаж 16/9)

  -- Фото-пост 1
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Утренняя рутина: как начинается мой рабочий день', 'Показываю, как готовлюсь к съёмке и планирую контент по утрам.', 'syomka', 'photo', 34, 7, now() - interval '14 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/morning1/600/750', NULL, 0, true);

  -- Фото-пост 2
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'За кадром: моя студийная установка 2024', 'Весь свет, фоны и оборудование, которое я использую для съёмки контента.', 'syomka', 'photo', 56, 13, now() - interval '15 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/studio2/600/750', NULL, 0, true);

  -- Фото-пост 3
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Флэтлей для продуктовых брендов: мой процесс', 'Как строю композицию, выбираю реквизит и добиваюсь чистоты кадра.', 'brendy', 'photo', 48, 9, now() - interval '16 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/flatlay3/800/600', NULL, 0, true);

  -- Фото-пост 4
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Портретная съёмка без ретуши: мой взгляд', 'Почему я отказалась от тяжёлой постобработки и что это дало.', 'syomka', 'photo', 72, 16, now() - interval '17 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/portrait4/600/750', NULL, 0, true);

  -- Фото-пост 5
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Осенняя лента: как создаю единый стиль', 'Цветокоррекция, выбор локаций и реквизита для тёплой осенней эстетики.', 'syomka', 'photo', 63, 11, now() - interval '18 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/autumn5/600/750', NULL, 0, true);

  -- Фото-пост 6
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Рабочее место контент-мейкера: минимализм и функциональность', 'Что лежит на моём столе и почему я избавилась от лишнего.', 'insight', 'photo', 41, 8, now() - interval '19 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/workspace6/800/600', NULL, 0, true);

  -- Фото-пост 7
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Естественный свет: когда и как использовать', 'Разбираю три вида освещения для lifestyle-фото и видео.', 'syomka', 'photo', 29, 5, now() - interval '20 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/light7/600/750', NULL, 0, true);

  -- Фото-пост 8
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Мудборд для нового сезона контента', 'Как собираю вдохновение и переношу его в конкретные идеи для съёмок.', 'insight', 'photo', 85, 19, now() - interval '21 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/moodboard8/800/600', NULL, 0, true);

  -- Фото-пост 9
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Детали решают всё: макросъёмка в контенте', 'Покупки, флэтлеи, фуд-фото — как крупный план меняет восприятие публикации.', 'syomka', 'photo', 37, 6, now() - interval '22 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/macro9/600/750', NULL, 0, true);

  -- Фото-пост 10
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Коллаборация с другим контент-мейкером: фотосессия', 'Как организовали совместную съёмку и разделили контент.', 'brendy', 'photo', 54, 12, now() - interval '23 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/collab10/600/750', NULL, 0, true);

  -- Видео-пост 1 (постер используется как превью через thumbnail_url, AC 7)
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Reels с первого дубля: мой метод быстрой съёмки', 'Снимаю вертикальное видео без стресса — покажу весь процесс от идеи до монтажа.', 'reels', 'video', 97, 28, now() - interval '24 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'https://picsum.photos/seed/reel1/800/450', 0, true);

  -- Видео-пост 2 (постер используется как превью через thumbnail_url, AC 7)
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Влог: день съёмки для бренда одежды', 'Показываю весь рабочий день — от брифа до финального экспорта.', 'brendy', 'video', 118, 34, now() - interval '25 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 'https://picsum.photos/seed/vlog2/800/450', 0, true);

  RAISE NOTICE 'Seed завершён: текстовые посты и 12 медиапостов добавлено (10 фото + 2 видео с post_media)';
END $$;
