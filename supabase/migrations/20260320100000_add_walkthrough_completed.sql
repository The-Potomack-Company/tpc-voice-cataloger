-- Add walkthrough completion flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN walkthrough_completed boolean NOT NULL DEFAULT false;

-- Allow users to update their own walkthrough_completed column
-- (Existing RLS only allows admin UPDATE on profiles)
CREATE POLICY "Users can update own walkthrough status"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ( (SELECT auth.uid()) = id )
  WITH CHECK ( (SELECT auth.uid()) = id );
