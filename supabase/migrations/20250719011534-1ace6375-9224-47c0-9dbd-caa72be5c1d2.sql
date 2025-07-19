-- Fix the permissions and insert a proper test chunk
-- First ensure service role has proper access
GRANT ALL ON TABLE public.chunks TO service_role;

-- Create a proper 1536-dimension embedding vector for testing
WITH sample_embedding AS (
  SELECT array_agg(random())::vector(1536) as embedding_vector
  FROM generate_series(1, 1536)
)
INSERT INTO public.chunks (
  user_id, 
  chunk_id, 
  text, 
  page_number, 
  source_file,
  embedding
)
SELECT 
  'f42e02fb-06bf-4068-9bb8-c5118d700bb7',
  'test_chunk_calculus_1',
  'Calculus is a branch of mathematics focused on limits, functions, derivatives, integrals, and infinite series. Differential calculus studies the rate at which quantities change.',
  1,
  'calculus_textbook.pdf',
  embedding_vector
FROM sample_embedding
ON CONFLICT (chunk_id) DO NOTHING;