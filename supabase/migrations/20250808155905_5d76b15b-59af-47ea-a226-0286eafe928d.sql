-- Add ai_enabled column to classes table
ALTER TABLE public.classes 
ADD COLUMN ai_enabled boolean NOT NULL DEFAULT true;