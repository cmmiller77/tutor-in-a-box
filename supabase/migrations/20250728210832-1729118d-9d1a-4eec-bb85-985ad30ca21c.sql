-- Create table for storing question analytics
CREATE TABLE public.question_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  subject TEXT,
  class_id UUID REFERENCES public.classes(id),
  sources_found INTEGER DEFAULT 0,
  response_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.question_analytics ENABLE ROW LEVEL SECURITY;

-- Create policies for question analytics
CREATE POLICY "Students can create their own question logs" 
ON public.question_analytics 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can view their own question logs" 
ON public.question_analytics 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Teachers can view question logs for their classes" 
ON public.question_analytics 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.classes 
    WHERE classes.id = question_analytics.class_id 
    AND classes.teacher_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 
    FROM public.enrollments 
    JOIN public.classes ON classes.id = enrollments.class_id 
    WHERE enrollments.student_id = question_analytics.user_id 
    AND classes.teacher_id = auth.uid()
  )
);

-- Create index for better performance
CREATE INDEX idx_question_analytics_user_id ON public.question_analytics(user_id);
CREATE INDEX idx_question_analytics_created_at ON public.question_analytics(created_at);
CREATE INDEX idx_question_analytics_class_id ON public.question_analytics(class_id);