-- Create RLS policy for profiles table to allow users to update their own role
CREATE POLICY "Users can update their own role and school" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);