-- Enable RLS on User Tables (fixing critical security issue)
ALTER TABLE public."User Tables" ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policy for User Tables 
CREATE POLICY "Users can manage their own records" 
ON public."User Tables" 
FOR ALL 
USING (auth.uid()::bigint = id)
WITH CHECK (auth.uid()::bigint = id);