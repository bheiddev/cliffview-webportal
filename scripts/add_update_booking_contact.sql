-- Let staff edit a reservation's phone/email after it is saved.
-- Run in the Supabase SQL Editor. Idempotent: safe to run more than once.

CREATE OR REPLACE FUNCTION public.update_booking_contact(
  p_booking_id uuid,
  p_phone text,
  p_email text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := nullif(trim(p_phone), '');
  v_email text := nullif(trim(p_email), '');
  v_id uuid;
BEGIN
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Phone number is required';
  END IF;

  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email address is invalid';
  END IF;

  UPDATE public.bookings
  SET phone = v_phone,
      email = v_email
  WHERE id = p_booking_id
    AND booking_type = 'tee_time'
  RETURNING id INTO v_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  RETURN json_build_object(
    'booking_id', v_id,
    'phone', v_phone,
    'email', v_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_booking_contact(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_booking_contact(uuid, text, text) TO anon, authenticated;
