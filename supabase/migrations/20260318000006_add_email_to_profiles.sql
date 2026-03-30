-- Add email column to profiles for efficient account listing
ALTER TABLE public.profiles ADD COLUMN email text;

-- Update handle_new_user trigger to populate email from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role, is_active)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', 'User'),
    coalesce(new.raw_user_meta_data ->> 'role', 'specialist'),
    true
  );
  RETURN new;
END;
$$;
