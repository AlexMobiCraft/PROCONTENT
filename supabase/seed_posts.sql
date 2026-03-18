-- Seed: тестовые посты для разработки
-- Story: 2.1 Базовая лента контента с бесконечным скроллом
-- Примечание: запускать только в dev/staging окружении
-- Требует: существующий пользователь в auth.users — замени UUID на реальный

-- Используется DO-блок чтобы получить id первого пользователя динамически
DO $$
DECLARE
  v_author_id UUID;
BEGIN
  -- Берём первого пользователя из auth.users
  SELECT id INTO v_author_id FROM auth.users LIMIT 1;

  IF v_author_id IS NULL THEN
    RAISE NOTICE 'V auth.users ni uporabnikov — seed preskočen';
    RETURN;
  END IF;

  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at) VALUES
  (v_author_id, 'Kako sem zgradila strategijo vsebin za eno leto vnaprej', 'Razčlenjujem svoj proces načrtovanja: od analize občinstva do specifičnih rubrik in formatov.', 'insight', 'text', 24, 5, now() - interval '1 day'),
  (v_author_id, 'Analiza: zakaj Reels ne delujejo več kot nekoč', 'Algoritem se je spremenil. To sem opazila na svojem profilu in tako sem prilagodila svoj pristop.', 'razobory', 'text', 41, 12, now() - interval '2 days'),
  (v_author_id, 'Snemanje brez studia: moja postavitev za lifestyle fotografije', 'Predstavljam opremo, ki jo uporabljam doma, in kako doseči čisto svetlobo.', 'syomka', 'photo', 67, 8, now() - interval '3 days'),
  (v_author_id, 'Zakaj sem nehala slediti trendom v Reels', 'Trije meseci eksperimentiranja z vertikalnim videom – kaj deluje in kaj ne.', 'reels', 'video', 33, 6, now() - interval '4 days'),
  (v_author_id, 'Sodelovanje z blagovnimi znamkami: kako ne izgubiti sebe', 'Moj kontrolni seznam za oceno partnerskih ponudb in pogajanja o pogojih.', 'brendy', 'text', 19, 3, now() - interval '5 days'),
  (v_author_id, 'Tema meseca: izgorelost ustvarjalca vsebin', 'Kaj mi je pomagalo, da sem se vrnila k delu po dveh mesecih molka.', 'tema', 'text', 88, 21, now() - interval '6 days'),
  (v_author_id, 'Vpogled: občinstvo ne želi popolnosti', 'Zakaj moje "nepopolne" objave dobijo več pozornosti kot tiste, ki so bile skrbno urejene.', 'insight', 'text', 55, 14, now() - interval '7 days'),
  (v_author_id, 'Analiza profila: kaj bi naredila drugače', 'Analiziram enega najboljših profilov v niši z vidika strateškega načrtovanja in vsebin.', 'razobory', 'text', 29, 7, now() - interval '8 days'),
  (v_author_id, 'Lightroom prednastavitve za toplo jesensko estetiko', 'Delim prednastavitve, ki jih uporabljam za enoten slog v svojem viru objav.', 'syomka', 'photo', 74, 18, now() - interval '9 days'),
  (v_author_id, 'Struktura mojega načrta vsebin za mesec dni', 'Predloga in postopek načrtovanja: kako vzdržujem ravnovesje med osebnim in prodajnim.', 'insight', 'text', 62, 11, now() - interval '10 days'),
  (v_author_id, 'Reels v 30 minutah: moja hitra nastavitev', 'Kako ustvariti videoposnetke brez odvečnega časa z ohranitvijo kakovosti.', 'reels', 'video', 47, 9, now() - interval '11 days'),
  (v_author_id, 'Kako izbiram blagovne znamke za dolgoročna partnerstva', 'Merila, ki mi pomagajo, da se ne zmotim pri izbiri oglaševalca.', 'brendy', 'text', 38, 4, now() - interval '12 days'),
  (v_author_id, 'Ustvarjalna kriza: normalno in kako živeti s tem', 'Iskren pogovor o obdobjih, ko sploh nimaš želje po snemanju ali pisanju.', 'tema', 'text', 91, 25, now() - interval '13 days');
END $$;
