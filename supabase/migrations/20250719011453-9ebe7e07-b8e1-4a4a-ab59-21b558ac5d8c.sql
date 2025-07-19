-- First, let's ensure the chunks table has proper permissions for the edge functions
-- Edge functions use the service role which should bypass RLS, but let's make sure

-- Check if there are any issues with the chunks table
GRANT ALL ON TABLE public.chunks TO service_role;
GRANT ALL ON TABLE public.chunks TO supabase_admin;

-- Also ensure the RLS policies are correct
-- Since edge functions use service_role, they should bypass RLS anyway
-- But let's make sure the policies are correctly set up

-- Drop existing policies and recreate them
DROP POLICY IF EXISTS "Users can view their own chunks" ON public.chunks;
DROP POLICY IF EXISTS "Users can create their own chunks" ON public.chunks;  
DROP POLICY IF EXISTS "Users can update their own chunks" ON public.chunks;
DROP POLICY IF EXISTS "Users can delete their own chunks" ON public.chunks;

-- Recreate policies with correct syntax
CREATE POLICY "Users can view their own chunks" 
ON public.chunks 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chunks" 
ON public.chunks 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chunks" 
ON public.chunks 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chunks" 
ON public.chunks 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Allow service_role to bypass RLS (this should already be the case, but let's be explicit)
GRANT ALL ON public.chunks TO service_role;

-- Insert a test chunk to verify the system works
INSERT INTO public.chunks (
  user_id, 
  chunk_id, 
  text, 
  page_number, 
  source_file,
  embedding
) VALUES (
  'f42e02fb-06bf-4068-9bb8-c5118d700bb7',
  'test_chunk_1',
  'This is a test chunk about calculus. Calculus is a branch of mathematics that deals with continuous change.',
  1,
  'test.pdf',
  '[0.1, 0.2, 0.3]'::vector
) ON CONFLICT (chunk_id) DO NOTHING;