-- Create a function to log questions with class context
CREATE OR REPLACE FUNCTION public.log_question_with_class(
  p_user_id UUID,
  p_question TEXT,
  p_class_id UUID DEFAULT NULL,
  p_sources_found INTEGER DEFAULT 0,
  p_response_generated BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  question_id UUID;
  class_subject TEXT;
BEGIN
  -- Get class subject if class_id is provided
  IF p_class_id IS NOT NULL THEN
    SELECT subject INTO class_subject
    FROM public.classes
    WHERE id = p_class_id;
  END IF;
  
  -- Insert the question log
  INSERT INTO public.question_analytics (
    user_id,
    question,
    class_id,
    subject,
    sources_found,
    response_generated
  ) VALUES (
    p_user_id,
    p_question,
    p_class_id,
    class_subject,
    p_sources_found,
    p_response_generated
  )
  RETURNING id INTO question_id;
  
  RETURN question_id;
END;
$$;