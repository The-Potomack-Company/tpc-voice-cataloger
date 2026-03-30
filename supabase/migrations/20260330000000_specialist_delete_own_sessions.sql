-- Allow specialists to delete sessions they created
CREATE POLICY "Specialists delete own sessions"
  ON sessions FOR DELETE TO authenticated
  USING (private.is_active_user() AND created_by = auth.uid());
