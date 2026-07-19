-- Let staff edit a reservation's name, phone, email, and golfer count after it is saved.
-- Adjusts tee_times.spots_remaining when golfers change.
-- Run in the Supabase SQL Editor. Idempotent: safe to run more than once.

DROP FUNCTION IF EXISTS public.update_booking_contact(uuid, text, text);

CREATE OR REPLACE FUNCTION public.update_booking_contact(
  p_booking_id uuid,
  p_guest_name text,
  p_phone text,
  p_email text DEFAULT NULL,
  p_golfers integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_name text := nullif(trim(p_guest_name), '');
  v_phone text := nullif(trim(p_phone), '');
  v_email text := nullif(trim(p_email), '');
  v_old_golfers integer;
  v_new_golfers integer;
  v_delta integer;
  v_tee_time_id uuid;
  v_status text;
  v_spots_remaining integer;
  v_spots_total integer;
BEGIN
  IF v_guest_name IS NULL THEN
    RAISE EXCEPTION 'Guest name is required';
  END IF;

  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Phone number is required';
  END IF;

  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email address is invalid';
  END IF;

  IF p_golfers IS NULL OR p_golfers < 1 THEN
    RAISE EXCEPTION 'Number of golfers must be at least 1';
  END IF;

  v_new_golfers := p_golfers;

  SELECT tee_time_id, golfers, status
  INTO v_tee_time_id, v_old_golfers, v_status
  FROM public.bookings
  WHERE id = p_booking_id
    AND booking_type = 'tee_time'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed bookings can be edited';
  END IF;

  v_delta := v_new_golfers - v_old_golfers;

  IF v_delta <> 0 THEN
    SELECT spots_remaining, spots_total
    INTO v_spots_remaining, v_spots_total
    FROM public.tee_times
    WHERE id = v_tee_time_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tee time not found';
    END IF;

    IF v_delta > 0 AND v_spots_remaining < v_delta THEN
      RAISE EXCEPTION 'Not enough spots remaining on this tee time';
    END IF;

    UPDATE public.tee_times
    SET spots_remaining = CASE
          WHEN v_delta > 0 THEN spots_remaining - v_delta
          ELSE LEAST(spots_total, spots_remaining + abs(v_delta))
        END,
        updated_at = now()
    WHERE id = v_tee_time_id
    RETURNING spots_remaining INTO v_spots_remaining;
  ELSE
    SELECT spots_remaining
    INTO v_spots_remaining
    FROM public.tee_times
    WHERE id = v_tee_time_id;
  END IF;

  UPDATE public.bookings
  SET guest_name = v_guest_name,
      phone = v_phone,
      email = v_email,
      golfers = v_new_golfers
  WHERE id = p_booking_id;

  RETURN json_build_object(
    'booking_id', p_booking_id,
    'guest_name', v_guest_name,
    'phone', v_phone,
    'email', v_email,
    'golfers', v_new_golfers,
    'tee_time_id', v_tee_time_id,
    'spots_remaining', v_spots_remaining
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_booking_contact(uuid, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_booking_contact(uuid, text, text, text, integer) TO anon, authenticated;
