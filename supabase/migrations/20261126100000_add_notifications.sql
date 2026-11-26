CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'shop_booking_request',
    'booking_status',
    'shop_message',
    'customer_message',
    'shop_extension_request'
  )),
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_at_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_unread_user_idx
  ON public.notifications (user_id)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their notifications" ON public.notifications;
CREATE POLICY "Users can read their notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can mark their notifications read" ON public.notifications;
CREATE POLICY "Users can mark their notifications read"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON TABLE public.notifications FROM anon, authenticated;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT UPDATE (read_at) ON TABLE public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_booking_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  recipient_id uuid;
  rental_item_name text;
  status_message text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF lower(coalesce(NEW.status, '')) = 'pending' THEN
      SELECT item.name
      INTO rental_item_name
      FROM public.items AS item
      WHERE item.id = NEW.item_id;

      FOR recipient_id IN
        SELECT DISTINCT member.user_id
        FROM public.shop_members AS member
        WHERE member.shop_id = NEW.shop_id
          AND member.user_id IS NOT NULL
      LOOP
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
          recipient_id,
          'shop_booking_request',
          'New rental request',
          format('%s requested %s.', coalesce(NEW.customer_name, 'A customer'), coalesce(rental_item_name, 'a rental item')),
          jsonb_build_object('booking_id', NEW.id)
        );
      END LOOP;
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.customer_id IS NOT NULL
     AND auth.uid() IS DISTINCT FROM NEW.customer_id THEN
    status_message := CASE lower(coalesce(NEW.status, ''))
      WHEN 'reserved' THEN 'Your rental request has been confirmed.'
      WHEN 'cancelled' THEN 'Your rental request has been declined or cancelled.'
      WHEN 'canceled' THEN 'Your rental request has been declined or cancelled.'
      ELSE format('Your rental status is now %s.', replace(lower(coalesce(NEW.status, 'updated')), '_', ' '))
    END;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.customer_id,
      'booking_status',
      'Rental status updated',
      status_message,
      jsonb_build_object('booking_id', NEW.id)
    );
  END IF;

  IF NEW.extension_requested IS TRUE
     AND OLD.extension_requested IS DISTINCT FROM NEW.extension_requested THEN
    SELECT item.name
    INTO rental_item_name
    FROM public.items AS item
    WHERE item.id = NEW.item_id;

    FOR recipient_id IN
      SELECT DISTINCT member.user_id
      FROM public.shop_members AS member
      WHERE member.shop_id = NEW.shop_id
        AND member.user_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        recipient_id,
        'shop_extension_request',
        'Rental extension requested',
        format('%s requested one more day for %s.',
          coalesce(NEW.customer_name, 'A customer'),
          coalesce(rental_item_name, 'a rental item')),
        jsonb_build_object('booking_id', NEW.id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_booking_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bookings_notify_changes ON public.bookings;
CREATE TRIGGER bookings_notify_changes
AFTER INSERT OR UPDATE OF status, extension_requested
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.notify_booking_changes();

CREATE OR REPLACE FUNCTION public.notify_message_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  recipient_id uuid;
  notification_type text;
  notification_title text;
BEGIN
  IF NEW.sender = 'customer' THEN
    notification_type := 'shop_message';
    notification_title := 'New customer message';

    FOR recipient_id IN
      SELECT DISTINCT member.user_id
      FROM public.shop_members AS member
      WHERE member.shop_id = NEW.shop_id
        AND member.user_id IS NOT NULL
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        recipient_id,
        notification_type,
        notification_title,
        'A customer sent your shop a message.',
        jsonb_build_object('message_id', NEW.id, 'branch_id', NEW.branch_id)
      );
    END LOOP;
  ELSIF NEW.sender = 'shop' AND NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.customer_id,
      'customer_message',
      'New shop message',
      'Your rental shop sent you a message.',
      jsonb_build_object('message_id', NEW.id, 'branch_id', NEW.branch_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_message_received() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS messages_notify_received ON public.messages;
CREATE TRIGGER messages_notify_received
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_message_received();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'The supabase_realtime publication is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
