-- ui_interactions: fine-grained UI friction events (page views, button clicks, walkthrough steps).
-- Kept separate from analytics_events because volume is ~10-100x higher, schema is UI-specific,
-- and retention policy differs (prune at 30 days vs keep business events forever).

CREATE TABLE IF NOT EXISTS public.ui_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_source TEXT NOT NULL DEFAULT 'tpc-app',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('click','view','focus','blur','submit','walkthrough_step')),
  page_path TEXT,
  element_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ui_interactions_created_at_idx ON public.ui_interactions (created_at DESC);
CREATE INDEX IF NOT EXISTS ui_interactions_user_id_idx ON public.ui_interactions (user_id);
CREATE INDEX IF NOT EXISTS ui_interactions_element_id_idx ON public.ui_interactions (element_id);
CREATE INDEX IF NOT EXISTS ui_interactions_page_path_idx ON public.ui_interactions (page_path);

ALTER TABLE public.ui_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own interactions"
  ON public.ui_interactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "users read own interactions; admins read all"
  ON public.ui_interactions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
