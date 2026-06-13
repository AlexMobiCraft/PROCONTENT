-- 045_add_is_vip_to_profiles.sql
-- VIP-доступ: независимый источник доступа к закрытому порталу, выдаётся
-- администратором без оплаты через Stripe. Взаимоисключающий с активной подпиской.

-- 1) Колонка is_vip (по умолчанию false, NOT NULL).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false;

-- 2) Инвариант взаимного исключения VIP ↔ активная подписка.
--    Сначала гасим возможных нарушителей, затем закрепляем CHECK.
--    NULL-статус (новый пользователь) проходит: NULL IN (...) → NULL → CHECK satisfied.
UPDATE public.profiles
  SET is_vip = false
  WHERE is_vip AND subscription_status IN ('active', 'trialing');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_vip_xor_active;
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_vip_xor_active
  CHECK (NOT (is_vip AND subscription_status IN ('active', 'trialing')));

-- 3) Защита записи is_vip: менять флаг может только доверенная инфраструктура
--    (service_role / миграции / definer-триггеры). Конечные роли PostgREST
--    (authenticated/anon) не могут самостоятельно выдать себе VIP — иначе обход оплаты.
--    SECURITY INVOKER (без DEFINER): current_user = роль вызывающего.
CREATE OR REPLACE FUNCTION public.enforce_is_vip_service_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.is_vip IS DISTINCT FROM OLD.is_vip)
     OR (TG_OP = 'INSERT' AND NEW.is_vip IS TRUE) THEN
    IF current_user IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION 'is_vip lahko spreminja samo service_role'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_is_vip_service_role ON public.profiles;
CREATE TRIGGER trg_enforce_is_vip_service_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_is_vip_service_role();
