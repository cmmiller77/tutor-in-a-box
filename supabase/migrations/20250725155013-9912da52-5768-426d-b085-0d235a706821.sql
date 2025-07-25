-- Fix the function to have proper search path security
CREATE OR REPLACE FUNCTION generate_class_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate a 6-character alphanumeric code
    code := UPPER(
      SUBSTRING(
        MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) 
        FROM 1 FOR 6
      )
    );
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.classes WHERE class_code = code) INTO exists_check;
    
    -- Exit loop if code is unique
    IF NOT exists_check THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN code;
END;
$$;