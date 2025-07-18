-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create storage bucket for PDF files
INSERT INTO storage.buckets (id, name, public) VALUES ('pdfs', 'pdfs', false);

-- Create policies for PDF uploads (users can only access their own files)
CREATE POLICY "Users can upload their own PDFs" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own PDFs" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create chunks table for storing text chunks with embeddings
CREATE TABLE public.chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chunk_id TEXT NOT NULL,
  text TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  source_file TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;

-- Create policies for chunks access
CREATE POLICY "Users can view their own chunks" 
ON public.chunks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chunks" 
ON public.chunks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chunks" 
ON public.chunks 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chunks" 
ON public.chunks 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for vector similarity search
CREATE INDEX chunks_embedding_idx ON public.chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_chunks_updated_at
BEFORE UPDATE ON public.chunks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();