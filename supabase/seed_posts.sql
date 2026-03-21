-- Seed: testne objave za razvoj
-- Story: 2.1 Osnovni vir vsebine z neskončnim pomikanjem
-- Opomba: zaženi samo v dev/staging okolju
-- Zahteva: obstoječi uporabnik v auth.users — zamenjaj UUID z realnim

-- Uporablja se blok DO za dinamično pridobivanje id prvega uporabnika
DO $$
DECLARE
  v_author_id UUID;
BEGIN
  -- Vzemimo prvega uporabnika iz auth.users
  SELECT id INTO v_author_id FROM auth.users LIMIT 1;

  IF v_author_id IS NULL THEN
    RAISE NOTICE 'V auth.users ni uporabnikov — seed preskočen';
    RETURN;
  END IF;

  INSERT INTO public.posts (author_id, title, excerpt, category, type, likes_count, comments_count, created_at) VALUES
  (v_author_id, 'Kako sem zgradila strategijo vsebine za leto vnaprej', 'Razčlenjujem svoj proces načrtovanja: od analize občinstva do konkretnih rubrik in formatov.', 'insight', 'text', 24, 5, now() - interval '1 day'),
  (v_author_id, 'Analiza: zakaj Reels ne delujejo več kot včasih', 'Algoritem se je spremenil. To sem opazila na svojem profilu in tako sem prilagodila pristop.', 'razobory', 'text', 41, 12, now() - interval '2 days'),
  (v_author_id, 'Snemanje brez studia: moja domača nastavitev za lifestyle fotografije', 'Prikazujem opremo, ki jo uporabljam doma, in kako doseči čisto svetlobo.', 'syomka', 'photo', 67, 8, now() - interval '3 days'),
  (v_author_id, 'Zakaj sem nehala slediti trendom v Reels', 'Tri meseci eksperimentov z vertikalnim videom — kaj deluje in kaj ne.', 'reels', 'video', 33, 6, now() - interval '4 days'),
  (v_author_id, 'Sodelovanje z blagovnimi znamkami: kako ne izgubiti sebe', 'Moj kontrolni seznam za ocenjevanje partnerskih ponudb in pogajanja o pogojih.', 'brendy', 'text', 19, 3, now() - interval '5 days'),
  (v_author_id, 'Tema meseca: izgorelost ustvarjalca vsebine', 'Kaj mi je pomagalo vrniti se na delo po dveh mesecih molka.', 'tema', 'text', 88, 21, now() - interval '6 days'),
  (v_author_id, 'Vpogled: občinstvo ne želi popolnosti', 'Zakaj moje "nepopolne" objave dosegajo večji doseg kot tiste skrbno urejene.', 'insight', 'text', 55, 14, now() - interval '7 days'),
  (v_author_id, 'Analiza profila: kaj bi naredila drugače', 'Analiziram enega najboljših profilov v niši z vidika strategije in vsebine.', 'razobory', 'text', 29, 7, now() - interval '8 days'),
  (v_author_id, 'Lightroom prednastavitve za toplo jesensko estetiko', 'Delim prednastavitve, ki jih uporabljam za enoten slog v viru.', 'syomka', 'photo', 74, 18, now() - interval '9 days'),
  (v_author_id, 'Struktura mojega načrta vsebine za mesec', 'Predloga in proces načrtovanja: kako vzdržujem ravnovesje med osebnim in prodajnim.', 'insight', 'text', 62, 11, now() - interval '10 days'),
  (v_author_id, 'Reels v 30 minutah: moja hitra nastavitev', 'Kako snemati videoposnetke brez odvečne porabe časa ob ohranjanju kakovosti.', 'reels', 'video', 47, 9, now() - interval '11 days'),
  (v_author_id, 'Kako izbiram blagovne znamke za dolgoročno sodelovanje', 'Merila, ki mi pomagajo, da se ne zmotim pri izbiri oglaševalca.', 'brendy', 'text', 38, 4, now() - interval '12 days'),
  (v_author_id, 'Ustvarjalna kriza: običajno in kako z njo živeti', 'Iskren pogovor o obdobjih, ko si sploh ne želiš snemati ali pisati.', 'tema', 'text', 91, 25, now() - interval '13 days');

  -- Story 2.2: medijske objave za vizualno testiranje LazyMediaWrapper (AC 5)
  -- Slike: picsum.photos (deterministična semena, portret 4/5 in pokrajina 16/9)
  INSERT INTO public.posts (author_id, title, excerpt, category, type, image_url, likes_count, comments_count, created_at) VALUES
  (v_author_id, 'Jutranja rutina: kako se začne moj delovni dan', 'Prikazujem, kako se pripravim na snemanje in načrtujem vsebino zjutraj.', 'syomka', 'photo', 'https://picsum.photos/seed/morning1/600/750', 34, 7, now() - interval '14 days'),
  (v_author_id, 'V ozadju: moja studijska nastavitev 2024', 'Vsa luč, ozadja in oprema, ki jo uporabljam za snemanje vsebine.', 'syomka', 'photo', 'https://picsum.photos/seed/studio2/600/750', 56, 13, now() - interval '15 days'),
  (v_author_id, 'Flatlay za produktne blagovne znamke: moj proces', 'Kako gradim kompozicijo, izbiram rekvizite in dosegam čistost posnetka.', 'brendy', 'photo', 'https://picsum.photos/seed/flatlay3/800/600', 48, 9, now() - interval '16 days'),
  (v_author_id, 'Portretno fotografiranje brez retuširanja: moj pogled', 'Zakaj sem opustila težko postprodukcijo in kaj je to prineslo.', 'syomka', 'photo', 'https://picsum.photos/seed/portrait4/600/750', 72, 16, now() - interval '17 days'),
  (v_author_id, 'Jesenski vir: kako ustvarjam enoten slog', 'Barvna korekcija, izbira lokacij in rekviziti za toplo jesensko estetiko.', 'syomka', 'photo', 'https://picsum.photos/seed/autumn5/600/750', 63, 11, now() - interval '18 days'),
  (v_author_id, 'Delovno mesto ustvarjalca vsebine: minimalizem in funkcionalnost', 'Kaj je na moji mizi in zakaj sem se znebila odvečnega.', 'insight', 'photo', 'https://picsum.photos/seed/workspace6/800/600', 41, 8, now() - interval '19 days'),
  (v_author_id, 'Naravna svetloba: kdaj in kako jo uporabiti', 'Razčlenjujem tri vrste osvetlitve za lifestyle fotografije in videe.', 'syomka', 'photo', 'https://picsum.photos/seed/light7/600/750', 29, 5, now() - interval '20 days'),
  (v_author_id, 'Moodboard za novo sezono vsebine', 'Kako zbiram navdih in ga prenašam v konkretne ideje za snemanja.', 'insight', 'photo', 'https://picsum.photos/seed/moodboard8/800/600', 85, 19, now() - interval '21 days'),
  (v_author_id, 'Podrobnosti odločajo o vsem: makro snemanje v vsebini', 'Nakupi, flatlayi, fotografije hrane — kako bližnji načrt spremeni dojemanje objave.', 'syomka', 'photo', 'https://picsum.photos/seed/macro9/600/750', 37, 6, now() - interval '22 days'),
  (v_author_id, 'Sodelovanje z drugim ustvarjalcem vsebine: fotošuting', 'Kako sva organizirala skupno snemanje in si razdelila vsebino.', 'brendy', 'photo', 'https://picsum.photos/seed/collab10/600/750', 54, 12, now() - interval '23 days'),
  -- Video objave (poster slika se uporablja kot predogled, type = video)
  (v_author_id, 'Reels v enem poskusu: moja metoda hitrega snemanja', 'Snemam vertikalni video brez stresa — pokazala bom celoten proces od ideje do montaže.', 'reels', 'video', 'https://picsum.photos/seed/reel1/800/450', 97, 28, now() - interval '24 days'),
  (v_author_id, 'Vlog: dan snemanja za blagovno znamko oblačil', 'Prikazujem celoten delovni dan — od navodil do končnega izvoza.', 'brendy', 'video', 'https://picsum.photos/seed/vlog2/800/450', 118, 34, now() - interval '25 days');
END $$;
