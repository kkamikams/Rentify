CREATE OR REPLACE FUNCTION public.prevent_booking_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  item_buffer integer;
  booking_buffer integer;
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

  IF EXISTS (
    SELECT 1
    FROM public.bookings existing
    WHERE existing.item_id = NEW.item_id
      AND existing.id IS DISTINCT FROM NEW.id
      AND lower(coalesce(existing.status, '')) NOT IN ('cancelled', 'canceled', 'declined')
      AND existing.start_date <= NEW.end_date + booking_buffer
      AND existing.end_date >= NEW.start_date - booking_buffer
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'DATES_UNAVAILABLE';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_booking_overlap() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bookings_prevent_overlap ON public.bookings;
CREATE TRIGGER bookings_prevent_overlap
BEFORE INSERT OR UPDATE OF item_id, start_date, end_date, buffer_days, status
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.prevent_booking_overlap();
