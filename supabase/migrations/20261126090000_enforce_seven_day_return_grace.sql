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

CREATE TRIGGER bookings_enforce_return_grace
BEFORE INSERT OR UPDATE OF return_grace_days
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_booking_return_grace();
