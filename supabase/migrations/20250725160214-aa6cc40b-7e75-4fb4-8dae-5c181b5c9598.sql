-- Add admin role support
-- First, let's update your specific profile to have admin role
UPDATE profiles 
SET role = 'admin' 
WHERE user_id = auth.uid();