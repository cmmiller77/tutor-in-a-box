-- Create class_documents table to link documents to specific classes
CREATE TABLE public.class_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL,
  document_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(class_id, document_id)
);

-- Enable RLS
ALTER TABLE public.class_documents ENABLE ROW LEVEL SECURITY;

-- Teachers can link/unlink documents to their own classes
CREATE POLICY "Teachers can manage documents for their classes" 
ON public.class_documents 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.classes 
    WHERE classes.id = class_documents.class_id 
    AND classes.teacher_id = auth.uid()
  )
);

-- Students and teachers can view documents for classes they have access to
CREATE POLICY "Users can view documents for accessible classes" 
ON public.class_documents 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.classes 
    WHERE classes.id = class_documents.class_id 
    AND classes.teacher_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.enrollments 
    WHERE enrollments.class_id = class_documents.class_id 
    AND enrollments.student_id = auth.uid()
  )
);