-- Add foreign key constraints to class_documents table
ALTER TABLE public.class_documents
ADD CONSTRAINT fk_class_documents_class_id 
FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;

ALTER TABLE public.class_documents
ADD CONSTRAINT fk_class_documents_document_id 
FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;