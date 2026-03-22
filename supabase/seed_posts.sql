-- Seed: testni objave za razvoj
-- Story: 2.3 Optimiziran prikaz medije v karticah (LazyMediaWrapper)
-- Opomba: zaženite samo v dev/staging okolju
-- Zahteva: obstoječi uporabnik v auth.users

DO $$
DECLARE
  v_author_id UUID;
  v_post_id UUID;
BEGIN
  -- Vzamemo prvega uporabnika iz auth.users
  SELECT id INTO v_author_id FROM auth.users LIMIT 1;

  IF v_author_id IS NULL THEN
    RAISE NOTICE 'V auth.users ni uporabnikov — seed je preskočen';
    RETURN;
  END IF;

  -- Besedilne objave (brez medije)
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at) VALUES
  (v_author_id, 'Kako sem si zgradila strategijo vsebine za leto naprej', 'Analiziram svoj proces načrtovanja: od analize občinstva do konkretnih rubrик in formatov.', 'zacetek', 'text', 24, 5, now() - interval '1 day'),
  (v_author_id, 'Analiza: zakaj Reels niso več učinkoviti kot nekoč', 'Algoritem se je spremenil. To sem opazila na svojem profilu in takole sem prilagodila pristop.', 'objavljanje', 'text', 41, 12, now() - interval '2 days'),
  (v_author_id, 'Snemanje brez študija: moj domač setup za lifestyle fotografijo', 'Pokazujem opremo, ki jo uporabljam doma, in kako doseči čisto svetlobo.', 'snemanje', 'text', 67, 8, now() - interval '3 days'),
  (v_author_id, 'Zakaj sem prenehala spremljati trende v Reels', 'Tri mesece eksperimentiranja z navpičnim videom — kaj deluje in kaj ne.', 'izrezi', 'text', 33, 6, now() - interval '4 days'),
  (v_author_id, 'Sodelovanja s blagajnamii: kako se ne izgubiti v procesu', 'Moj seznam preverke za oceno predlogov partnerstva in pogajanja o pogojih.', 'komercialni', 'text', 19, 3, now() - interval '5 days'),
  (v_author_id, 'Tema meseca: izgorelost ustvarjalca vsebine', 'Kaj mi je pomagalo, da sem se vrnila k delu po dveh mesecih molka.', 'tema', 'text', 88, 21, now() - interval '6 days'),
  (v_author_id, 'Vpogled: občinstvo ne potrebuje popolnosti', 'Zakaj moje "nepopolne" objave zberejo večji doseg kot temeljito polirane.', 'zacetek', 'text', 55, 14, now() - interval '7 days'),
  (v_author_id, 'Analiza profila: kaj bi bila drugače storila', 'Analiziram enega od najboljših profilov v svoji niši z vidika strategije in vsebine.', 'objavljanje', 'text', 29, 7, now() - interval '8 days'),
  (v_author_id, 'Lightroom predfiltri za toplo jesensko estetiko', 'Delim predfiltri, ki jih uporabljam za enotni stil v lenti.', 'snemanje', 'text', 74, 18, now() - interval '9 days'),
  (v_author_id, 'Struktura mojega mesečnega načrta vsebine', 'Predloga in postopek načrtovanja: kako ohranjam ravnovesje med osebnim in prodajnim.', 'zacetek', 'text', 62, 11, now() - interval '10 days'),
  (v_author_id, 'Reels v 30 minutah: moj hiter setup', 'Kako snemati video brez nepotrebne porabe časa in ohranjati kakovost.', 'izrezi', 'text', 47, 9, now() - interval '11 days'),
  (v_author_id, 'Kako izbiram blagajne za dolgoročno sodelovanje', 'Kriteriji, ki mi pomagajo, da se pri izboru oglaševalca ne zmotim.', 'komercialni', 'text', 38, 4, now() - interval '12 days'),
  (v_author_id, 'Ustvarjalni kriza: norma in kako živeti z njo', 'Iskrena beseda o obdobjih, ko sploh ne želim snemati ali pisati.', 'tema', 'text', 91, 25, now() - interval '13 days');

  -- Story 2.3: medijske objave za vizualno testiranje LazyMediaWrapper (AC 5, AC 9)
  -- Uporabljamo post_media namesto zastarelenega image_url v posts
  -- Slike: picsum.photos (determinističnih semen, portret 4/5 in krajina 16/9)

  -- Fotografska objava 1
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Jutranja rutina: kako se začne moj delovni dan', 'Pokazujem, kako se pripravljam na snemanje in načrtujem vsebino zjutraj.', 'snemanje', 'photo', 34, 7, now() - interval '14 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/morning1/600/750', NULL, 0, true);

  -- Fotografska objava 2
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Za sceno: moj študijski setup 2024', 'Vsa svetloba, ozadja in oprema, ki jo uporabljam za snemanje vsebine.', 'snemanje', 'photo', 56, 13, now() - interval '15 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/studio2/600/750', NULL, 0, true);

  -- Fotografska objava 3
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Flat lay za blagovne znamke: moj proces', 'Kako konstruiram kompozicijo, izberam rekvizit in dosegam čistost kadra.', 'komercialni', 'photo', 48, 9, now() - interval '16 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/flatlay3/800/600', NULL, 0, true);

  -- Fotografska objava 4
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Portretna fotografija brez retuše: moj pogled', 'Zakaj sem se odrekla težki obdelavi in kaj je to dalo.', 'snemanje', 'photo', 72, 16, now() - interval '17 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/portrait4/600/750', NULL, 0, true);

  -- Fotografska objava 5
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Jesenski feed: kako ustvarim enotni stil', 'Korekcija barv, izbor lokacij in rekvizita za toplo jesensko estetiko.', 'estetski-kadri', 'photo', 63, 11, now() - interval '18 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/autumn5/600/750', NULL, 0, true);

  -- Fotografska objava 6
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Delovna miza ustvarjalca vsebine: minimalizam in funkcionalnost', 'Kaj je na moji mizi in zakaj sem se znebila nepotrebnega.', 'zacetek', 'photo', 41, 8, now() - interval '19 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/workspace6/800/600', NULL, 0, true);

  -- Fotografska objava 7
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Naravna svetloba: kdaj in kako je uporabiti', 'Analiziram tri vrste razsvetljave za lifestyle fotografijo in video.', 'snemanje', 'photo', 29, 5, now() - interval '20 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/light7/600/750', NULL, 0, true);

  -- Fotografska objava 8
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Mood board za novo sezono vsebine', 'Kako zbierem inspiracijo in jo prenesem v konkretne ideje za snemanja.', 'zacetek', 'photo', 85, 19, now() - interval '21 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/moodboard8/800/600', NULL, 0, true);

  -- Fotografska objava 9
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Podrobnosti odločajo o vsem: makrofotografija v vsebini', 'Nakupi, flat layi, food fotografija — kako se detajl spremeni percepcija publikacije.', 'estetski-kadri', 'photo', 37, 6, now() - interval '22 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/macro9/600/750', NULL, 0, true);

  -- Fotografska objava 10
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Sodelovanje s drugim ustvarjalcem vsebine: fotografska seja', 'Kako smo organizirali skupno snemanje in razdelili vsebino.', 'komercialni', 'photo', 54, 12, now() - interval '23 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'image', 'https://picsum.photos/seed/collab10/600/750', NULL, 0, true);

  -- Video objava 1 (plakat se uporablja kot predogled preko thumbnail_url, AC 7)
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Reels na prvi posnetek: moja metoda hitrega snemanja', 'Snemam navpično video brez stresa — pokažem ves proces od ideje do urejanja.', 'izrezi', 'video', 97, 28, now() - interval '24 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 'https://picsum.photos/seed/reel1/800/450', 0, true);

  -- Video objava 2 (plakat se uporablja kot predogled preko thumbnail_url, AC 7)
  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at)
  VALUES (v_author_id, 'Vlog: dan snemanja za blagajno obleke', 'Pokazujem ves delovni dan — od briefa do finalne izvozitve.', 'komercialni', 'video', 118, 34, now() - interval '25 days')
  RETURNING id INTO v_post_id;
  INSERT INTO public.post_media (post_id, media_type, url, thumbnail_url, order_index, is_cover)
  VALUES (v_post_id, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 'https://picsum.photos/seed/vlog2/800/450', 0, true);

  RAISE NOTICE 'Seed je zaključen: besedilne objave in 12 medijaskih objav dodano (10 fotografij + 2 videov s post_media)';
END $$;
