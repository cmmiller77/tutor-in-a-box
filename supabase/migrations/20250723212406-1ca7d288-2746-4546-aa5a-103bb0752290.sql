-- Add role and school columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN role TEXT CHECK (role IN ('teacher', 'student')),
ADD COLUMN school TEXT;

-- Update the handle_new_user function to include role and school
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER set search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, date_of_birth, school, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    (NEW.raw_user_meta_data ->> 'date_of_birth')::DATE,
    NEW.raw_user_meta_data ->> 'school',
    NEW.raw_user_meta_data ->> 'role'
  );
  RETURN NEW;
END;
$$;