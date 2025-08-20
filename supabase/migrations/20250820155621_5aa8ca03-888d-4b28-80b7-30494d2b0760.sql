-- Add derived subject and topics columns to question_analytics table
ALTER TABLE public.question_analytics 
ADD COLUMN derived_subject TEXT,
ADD COLUMN derived_topics TEXT[];

-- Add an index for better performance on derived_subject queries
CREATE INDEX idx_question_analytics_derived_subject ON public.question_analytics(derived_subject);

-- Add an index for better performance on derived_topics queries
CREATE INDEX idx_question_analytics_derived_topics ON public.question_analytics USING GIN(derived_topics);