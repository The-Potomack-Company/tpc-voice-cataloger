-- Allow any authenticated user to insert into analytics_events.
-- Telemetry tables should accept writes from any signed-in client of any TPC app.
-- Reads remain controlled by whatever existing SELECT policy the table has;
-- this policy only grants INSERT.

DROP POLICY IF EXISTS "authenticated users can insert analytics events" ON public.analytics_events;
CREATE POLICY "authenticated users can insert analytics events"
  ON public.analytics_events FOR INSERT
  TO authenticated
  WITH CHECK (true);
