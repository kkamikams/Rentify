ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS return_grace_days integer NOT NULL DEFAULT 7;

DROP TRIGGER IF EXISTS bookings_enforce_return_grace ON public.bookings;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_return_grace_days_check;

UPDATE public.bookings
SET return_grace_days = 7
WHERE return_grace_days IS DISTINCT FROM 7;

ALTER TABLE public.bookings
  ALTER COLUMN return_grace_days SET DEFAULT 7,
  ALTER COLUMN return_grace_days SET NOT NULL;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_return_grace_days_check
  CHECK (return_grace_days = 7);

CREATE OR REPLACE FUNCTION public.enforce_booking_return_grace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.return_grace_days := 7;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_booking_return_grace() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bookings_enforce_return_grace ON public.bookings;
CREATE TRIGGER bookings_enforce_return_grace
BEFORE INSERT OR UPDATE OF return_grace_days
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_booking_return_grace();

CREATE OR REPLACE FUNCTION public.prevent_booking_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  item_buffer integer;
  booking_buffer integer;
  return_grace integer;
BEGIN
  IF lower(coalesce(NEW.status, '')) IN ('cancelled', 'canceled', 'declined') THEN
    RETURN NEW;
  END IF;

  IF NEW.start_date IS NULL OR NEW.end_date IS NULL OR NEW.start_date > NEW.end_date THEN
    RAISE EXCEPTION 'Invalid booking date range';
  END IF;

  SELECT coalesce(buffer_days, 0)
  INTO item_buffer
  FROM public.items
  WHERE id = NEW.item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking item not found';
  END IF;

  booking_buffer := coalesce(NEW.buffer_days, item_buffer, 0);
  return_grace := coalesce(NEW.return_grace_days, 7);

  IF EXISTS (
    SELECT 1
    FROM public.bookings existing
    WHERE existing.item_id = NEW.item_id
      AND existing.id IS DISTINCT FROM NEW.id
      AND lower(coalesce(existing.status, '')) NOT IN ('cancelled', 'canceled', 'declined')
      AND existing.start_date - coalesce(existing.buffer_days, item_buffer, 0)
        <= NEW.end_date + return_grace + booking_buffer
      AND existing.end_date
        + coalesce(existing.return_grace_days, 7)
        + coalesce(existing.buffer_days, item_buffer, 0)
        >= NEW.start_date - booking_buffer
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'DATES_UNAVAILABLE';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_booking_overlap() FROM PUBLIC, anon, authenticated;
