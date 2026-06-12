-- Agent tee time bookings for the admin portal.
-- Run in Supabase SQL Editor after bookings_schema.sql (cliffview-golf).

-- Allow walk-in / phone bookings without Square payment.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'guest_app';

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_source_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_source_check
  CHECK (source IN ('guest_app', 'agent'));

ALTER TABLE public.bookings
  ALTER COLUMN square_payment_id DROP NOT NULL;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_amount_cents_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_amount_cents_check
  CHECK (amount_cents >= 0);

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_source_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_source_check
  CHECK (
    (source = 'guest_app' AND square_payment_id IS NOT NULL AND amount_cents > 0)
    OR (source = 'agent' AND square_payment_id IS NULL)
  );

-- Portal anon key: read confirmed tee time bookings.
DROP POLICY IF EXISTS "Allow anon read tee time bookings" ON public.bookings;
CREATE POLICY "Allow anon read tee time bookings"
  ON public.bookings
  FOR SELECT
  TO anon
  USING (booking_type = 'tee_time' AND status = 'confirmed');

GRANT SELECT ON public.bookings TO anon;

-- Atomic agent booking: insert row + decrement spots_remaining.
CREATE OR REPLACE FUNCTION public.book_tee_time_agent(
  p_tee_time_id uuid,
  p_guest_name text,
  p_phone text,
  p_golfers integer
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
  v_phone text := trim(p_phone);
BEGIN
  IF v_guest_name IS NULL OR v_guest_name = '' THEN
    RAISE EXCEPTION 'Guest name is required';
  END IF;

  IF v_phone IS NULL OR v_phone = '' THEN
    RAISE EXCEPTION 'Phone number is required';
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
    golfers,
    amount_cents,
    square_payment_id,
    status,
    source
  )
  VALUES (
    'tee_time',
    p_tee_time_id,
    v_guest_name,
    v_phone,
    p_golfers,
    0,
    NULL,
    'confirmed',
    'agent'
  )
  RETURNING id INTO v_booking_id;

  RETURN json_build_object(
    'booking_id', v_booking_id,
    'spots_remaining', v_spots_remaining - p_golfers
  );
END;
$$;

REVOKE ALL ON FUNCTION public.book_tee_time_agent(uuid, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_tee_time_agent(uuid, text, text, integer) TO anon, authenticated;
