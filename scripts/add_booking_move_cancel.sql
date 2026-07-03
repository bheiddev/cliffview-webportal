-- Cancel and move tee time reservations from the admin portal.
-- Run in the Supabase SQL Editor. Idempotent: safe to run more than once.

-- Cancel a reservation and return its spots to the tee time.
CREATE OR REPLACE FUNCTION public.cancel_tee_time_booking(
  p_booking_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tee_time_id uuid;
  v_golfers integer;
  v_status text;
  v_spots_remaining integer;
BEGIN
  SELECT tee_time_id, golfers, status
  INTO v_tee_time_id, v_golfers, v_status
  FROM public.bookings
  WHERE id = p_booking_id
    AND booking_type = 'tee_time'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'Booking is already cancelled';
  END IF;

  UPDATE public.bookings
  SET status = 'cancelled'
  WHERE id = p_booking_id;

  UPDATE public.tee_times
  SET spots_remaining = LEAST(spots_total, spots_remaining + v_golfers),
      updated_at = now()
  WHERE id = v_tee_time_id
  RETURNING spots_remaining INTO v_spots_remaining;

  RETURN json_build_object(
    'booking_id', p_booking_id,
    'tee_time_id', v_tee_time_id,
    'spots_remaining', v_spots_remaining
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_tee_time_booking(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_tee_time_booking(uuid) TO anon, authenticated;

-- Move a reservation to a different tee time (atomic spot transfer).
CREATE OR REPLACE FUNCTION public.move_tee_time_booking(
  p_booking_id uuid,
  p_new_tee_time_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_tee_time_id uuid;
  v_golfers integer;
  v_status text;
  v_new_spots integer;
  v_old_spots integer;
  v_new_available boolean;
BEGIN
  SELECT tee_time_id, golfers, status
  INTO v_old_tee_time_id, v_golfers, v_status
  FROM public.bookings
  WHERE id = p_booking_id
    AND booking_type = 'tee_time'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed bookings can be moved';
  END IF;

  IF p_new_tee_time_id = v_old_tee_time_id THEN
    RAISE EXCEPTION 'Select a different tee time';
  END IF;

  SELECT spots_remaining, is_available
  INTO v_new_spots, v_new_available
  FROM public.tee_times
  WHERE id = p_new_tee_time_id
  FOR UPDATE;

  IF NOT FOUND OR v_new_available IS NOT TRUE THEN
    RAISE EXCEPTION 'Target tee time not found or is not available';
  END IF;

  IF v_new_spots < v_golfers THEN
    RAISE EXCEPTION 'Not enough spots remaining on the target tee time';
  END IF;

  UPDATE public.tee_times
  SET spots_remaining = spots_remaining - v_golfers,
      updated_at = now()
  WHERE id = p_new_tee_time_id
  RETURNING spots_remaining INTO v_new_spots;

  UPDATE public.tee_times
  SET spots_remaining = LEAST(spots_total, spots_remaining + v_golfers),
      updated_at = now()
  WHERE id = v_old_tee_time_id
  RETURNING spots_remaining INTO v_old_spots;

  UPDATE public.bookings
  SET tee_time_id = p_new_tee_time_id
  WHERE id = p_booking_id;

  RETURN json_build_object(
    'booking_id', p_booking_id,
    'old_tee_time_id', v_old_tee_time_id,
    'new_tee_time_id', p_new_tee_time_id,
    'old_spots_remaining', v_old_spots,
    'new_spots_remaining', v_new_spots
  );
END;
$$;

REVOKE ALL ON FUNCTION public.move_tee_time_booking(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_tee_time_booking(uuid, uuid) TO anon, authenticated;
