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
