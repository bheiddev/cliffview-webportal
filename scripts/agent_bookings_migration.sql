-- Tee time reservations for the admin portal.
-- Site bookings do NOT process payment: we only capture name/phone/email/golfers.
-- Payment is collected in the pro shop when golfers arrive.
-- Run in Supabase SQL Editor against the existing public.bookings table.

-- Allow no-payment reservations: amount can be 0.
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_amount_cents_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_amount_cents_check
  CHECK (amount_cents >= 0);

-- Allow no-payment reservations: no Square payment id required.
ALTER TABLE public.bookings
  ALTER COLUMN square_payment_id DROP NOT NULL;

-- Track whether payment was remitted in the pro shop.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS paid_at timestamptz NULL;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('unpaid', 'paid'));

-- Portal anon key: read confirmed tee time bookings.
DROP POLICY IF EXISTS "Allow anon read tee time bookings" ON public.bookings;
CREATE POLICY "Allow anon read tee time bookings"
  ON public.bookings
  FOR SELECT
  TO anon
  USING (booking_type = 'tee_time' AND status = 'confirmed');

GRANT SELECT ON public.bookings TO anon;

-- Atomic reservation: insert row + decrement spots_remaining. No payment.
CREATE OR REPLACE FUNCTION public.book_tee_time_agent(
  p_tee_time_id uuid,
  p_guest_name text,
  p_phone text,
  p_golfers integer,
  p_email text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spots_remaining integer;
  v_booking_id uuid;
  v_guest_name text := trim(p_guest_name);
  v_phone text := nullif(trim(p_phone), '');
  v_email text := nullif(trim(p_email), '');
BEGIN
  IF v_guest_name IS NULL OR v_guest_name = '' THEN
    RAISE EXCEPTION 'Guest name is required';
  END IF;

  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Phone number is required';
  END IF;

  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email address is invalid';
  END IF;

  IF p_golfers IS NULL OR p_golfers < 1 THEN
    RAISE EXCEPTION 'At least one golfer is required';
  END IF;

  SELECT spots_remaining
  INTO v_spots_remaining
  FROM public.tee_times
  WHERE id = p_tee_time_id
    AND is_available = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tee time not found or is not available';
  END IF;

  IF v_spots_remaining < p_golfers THEN
    RAISE EXCEPTION 'Not enough spots remaining for this booking';
  END IF;

  UPDATE public.tee_times
  SET spots_remaining = spots_remaining - p_golfers,
      updated_at = now()
  WHERE id = p_tee_time_id;

  INSERT INTO public.bookings (
    booking_type,
    tee_time_id,
    guest_name,
    phone,
    email,
    golfers,
    amount_cents,
    square_payment_id,
    status
  )
  VALUES (
    'tee_time',
    p_tee_time_id,
    v_guest_name,
    v_phone,
    v_email,
    p_golfers,
    0,
    NULL,
    'confirmed'
  )
  RETURNING id INTO v_booking_id;

  RETURN json_build_object(
    'booking_id', v_booking_id,
    'spots_remaining', v_spots_remaining - p_golfers
  );
END;
$$;

-- Drop any previous overload so the RPC call resolves unambiguously.
DROP FUNCTION IF EXISTS public.book_tee_time_agent(uuid, text, text, integer);

REVOKE ALL ON FUNCTION public.book_tee_time_agent(uuid, text, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_tee_time_agent(uuid, text, text, integer, text) TO anon, authenticated;

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
