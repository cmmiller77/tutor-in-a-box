-- Update existing classes to have Miller University as the school
UPDATE public.classes 
SET school = 'Miller University' 
WHERE school IS NULL OR school = '';