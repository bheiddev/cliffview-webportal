-- Seed tee times: July 1 – December 31, 2026
-- Run in Supabase SQL Editor or psql.
--
-- Rules:
--   • One slot every 10 minutes during operating hours (Eastern local wall-clock time)
--   • holes = NULL for every row
--   • Last slot is 10 minutes before close (e.g. 08:00–18:00 → 08:00 … 17:50)
--
-- Operating hours:
--   Summer : 08:00–18:00  May 18 – September 6   (this script: Jul 1 – Sep 6)
--   Fall   : 09:00–18:00  September 7 – November 1
--   Winter : 10:00–16:00  November 2 – end of year
--
-- Adjust DEFAULT_PRICE / DEFAULT_SPOTS below before running if needed.

DO $$
DECLARE
  d date;
  t time;
  open_t time;
  close_t time;
  slot_interval interval := '10 minutes';
  default_price integer := 35;
  default_spots integer := 4;
BEGIN
  FOR d IN
    SELECT generate_series('2026-07-01'::date, '2026-12-31'::date, '1 day'::interval)::date
  LOOP
    IF d <= '2026-09-06'::date THEN
      open_t := '08:00';
      close_t := '18:00';
    ELSIF d <= '2026-11-01'::date THEN
      open_t := '09:00';
      close_t := '18:00';
    ELSE
      open_t := '10:00';
      close_t := '16:00';
    END IF;

    t := open_t;
    WHILE t < close_t LOOP
      INSERT INTO public.tee_times (
        date,
        time,
        price,
        spots_total,
        spots_remaining,
        holes,
        description,
        is_available
      )
      SELECT
        d,
        t,
        default_price,
        default_spots,
        default_spots,
        NULL,
        NULL,
        true
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.tee_times existing
        WHERE existing.date = d
          AND existing.time = t
          AND existing.holes IS NULL
      );

      t := t + slot_interval;
    END LOOP;
  END LOOP;
END $$;

-- Optional: row count for the seeded range
SELECT
  COUNT(*) AS tee_time_count,
  MIN(date) AS first_date,
  MAX(date) AS last_date
FROM public.tee_times
WHERE date BETWEEN '2026-07-01' AND '2026-12-31'
  AND holes IS NULL;
