-- Add role column to profiles table (school already exists)
ALTER TABLE public.profiles 
ADD COLUMN role TEXT CHECK (role IN ('teacher', 'student'));