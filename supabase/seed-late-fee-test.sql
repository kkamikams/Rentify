-- Run this in the Supabase SQL Editor while connected to this project.
-- It targets the existing "Gown 1" item and the named test customers only.

UPDATE public.items
SET late_fee_per_day = 200,
    buffer_days = 2
WHERE name = 'Gown 1'
  AND shop_id = 'ee2abeaf-dc6a-4a8c-a085-38f3ad92a7a1';

DELETE FROM public.bookings
WHERE shop_id = 'ee2abeaf-dc6a-4a8c-a085-38f3ad92a7a1'
  AND customer_name IN (
    'Late Fee Test Customer',
    'Late Fee Next Pickup Test Customer'
  );

INSERT INTO public.bookings (
  shop_id,
  item_id,
  customer_name,
  customer_phone,
  start_date,
  end_date,
  buffer_days,
  status,
  deposit_amount
)
SELECT
  'ee2abeaf-dc6a-4a8c-a085-38f3ad92a7a1',
  i.id,
  'Late Fee Test Customer',
  '09123456789',
  '2026-11-16',
  '2026-11-22',
  2,
  'out',
  500
FROM public.items i
WHERE i.shop_id = 'ee2abeaf-dc6a-4a8c-a085-38f3ad92a7a1'
  AND i.name = 'Gown 1'
LIMIT 1;

INSERT INTO public.bookings (
  shop_id,
  item_id,
  customer_name,
  customer_phone,
  start_date,
  end_date,
  buffer_days,
  status,
  deposit_amount
)
SELECT
  'ee2abeaf-dc6a-4a8c-a085-38f3ad92a7a1',
  i.id,
  'Late Fee Next Pickup Test Customer',
  '09987654321',
  '2026-11-25',
  '2026-11-26',
  2,
  'reserved',
  500
FROM public.items i
WHERE i.shop_id = 'ee2abeaf-dc6a-4a8c-a085-38f3ad92a7a1'
  AND i.name = 'Gown 1'
LIMIT 1;
