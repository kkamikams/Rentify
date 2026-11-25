ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS quoted_item_name text,
  ADD COLUMN IF NOT EXISTS quoted_start_date date,
  ADD COLUMN IF NOT EXISTS quoted_end_date date,
  ADD COLUMN IF NOT EXISTS quoted_daily_rate numeric(12, 2),
  ADD COLUMN IF NOT EXISTS quoted_rental_total numeric(12, 2),
  ADD COLUMN IF NOT EXISTS quoted_deposit_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS quoted_late_fee_per_day numeric(12, 2);

UPDATE public.bookings AS booking
SET
  quoted_item_name = coalesce(booking.quoted_item_name, item.name),
  quoted_start_date = coalesce(booking.quoted_start_date, booking.start_date),
  quoted_end_date = coalesce(booking.quoted_end_date, booking.end_date),
  quoted_daily_rate = coalesce(booking.quoted_daily_rate, item.price_per_day, 0),
  quoted_rental_total = coalesce(
    booking.quoted_rental_total,
    coalesce(item.price_per_day, 0) * (booking.end_date - booking.start_date + 1)
  ),
  quoted_deposit_amount = coalesce(
    booking.quoted_deposit_amount,
    item.deposit,
    0
  ),
  quoted_late_fee_per_day = coalesce(booking.quoted_late_fee_per_day, item.late_fee_per_day, 0)
FROM public.items AS item
WHERE item.id = booking.item_id;

CREATE OR REPLACE FUNCTION public.enforce_booking_receipt_terms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  item_name text;
  daily_rate numeric(12, 2);
  item_deposit numeric(12, 2);
  late_fee_per_day numeric(12, 2);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.quoted_item_name := OLD.quoted_item_name;
    NEW.quoted_start_date := OLD.quoted_start_date;
    NEW.quoted_end_date := OLD.quoted_end_date;
    NEW.quoted_daily_rate := OLD.quoted_daily_rate;
    NEW.quoted_rental_total := OLD.quoted_rental_total;
    NEW.quoted_deposit_amount := OLD.quoted_deposit_amount;
    NEW.quoted_late_fee_per_day := OLD.quoted_late_fee_per_day;
    RETURN NEW;
  END IF;

  SELECT
    item.name,
    coalesce(item.price_per_day, 0),
    coalesce(item.deposit, 0),
    coalesce(item.late_fee_per_day, 0)
  INTO item_name, daily_rate, item_deposit, late_fee_per_day
  FROM public.items AS item
  WHERE item.id = NEW.item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking item not found';
  END IF;

  NEW.quoted_item_name := item_name;
  NEW.quoted_start_date := NEW.start_date;
  NEW.quoted_end_date := NEW.end_date;
  NEW.quoted_daily_rate := daily_rate;
  NEW.quoted_rental_total := daily_rate * (NEW.end_date - NEW.start_date + 1);
  NEW.quoted_deposit_amount := item_deposit;
  NEW.quoted_late_fee_per_day := late_fee_per_day;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_booking_receipt_terms() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER bookings_enforce_receipt_terms
BEFORE INSERT OR UPDATE OF
  quoted_item_name,
  quoted_start_date,
  quoted_end_date,
  quoted_daily_rate,
  quoted_rental_total,
  quoted_deposit_amount,
  quoted_late_fee_per_day
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_booking_receipt_terms();
