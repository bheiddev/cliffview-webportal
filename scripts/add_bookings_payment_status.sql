-- Add payment tracking to public.bookings so staff can mark whether a
-- reservation has been paid in the pro shop. Run in the Supabase SQL Editor.
-- Idempotent: safe to run more than once.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS paid_at timestamptz NULL;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('unpaid', 'paid'));

-- Staff mark a reservation paid/unpaid when the golfer settles up in the shop.
CREATE OR REPLACE FUNCTION public.set_booking_payment_status(
  p_booking_id uuid,
  p_paid boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_status text := CASE WHEN p_paid THEN 'paid' ELSE 'unpaid' END;
  v_paid_at timestamptz := CASE WHEN p_paid THEN now() ELSE NULL END;
  v_id uuid;
BEGIN
  UPDATE public.bookings
  SET payment_status = v_payment_status,
      paid_at = v_paid_at
  WHERE id = p_booking_id
    AND booking_type = 'tee_time'
  RETURNING id INTO v_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  RETURN json_build_object(
    'booking_id', v_id,
    'payment_status', v_payment_status,
    'paid_at', v_paid_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_booking_payment_status(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_booking_payment_status(uuid, boolean) TO anon, authenticated;
