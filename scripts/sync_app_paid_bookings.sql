-- App bookings are paid via Square, so their payment_status should be 'paid'.
-- The guest app (separate repo) does not set payment_status, so we derive it
-- from square_payment_id here. Agent/walk-in bookings (no Square payment) are
-- left as-is so staff can still mark them paid in the shop.
-- Run in the Supabase SQL Editor. Idempotent: safe to run more than once.

-- 1) Backfill existing Square-paid bookings.
UPDATE public.bookings
SET payment_status = 'paid',
    paid_at = COALESCE(paid_at, created_at)
WHERE square_payment_id IS NOT NULL
  AND payment_status <> 'paid';

-- 2) Mark future Square-paid bookings paid automatically on insert.
CREATE OR REPLACE FUNCTION public.bookings_set_paid_on_square()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.square_payment_id IS NOT NULL THEN
    NEW.payment_status := 'paid';
    IF NEW.paid_at IS NULL THEN
      NEW.paid_at := COALESCE(NEW.created_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_set_paid_on_square ON public.bookings;
CREATE TRIGGER bookings_set_paid_on_square
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.bookings_set_paid_on_square();
