-- Create missing user_role enum type
CREATE TYPE user_role AS ENUM ('developer', 'admin');

-- Fix profiles table RLS policies to prevent privilege escalation
DROP POLICY IF EXISTS "Users can view approved profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Create secure RLS policies for profiles table
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view approved profiles names only" 
ON public.profiles 
FOR SELECT 
USING (is_approved = true AND auth.uid() != user_id);

CREATE POLICY "Users can update own profile basic info" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND 
  role = OLD.role AND 
  is_approved = OLD.is_approved
);

CREATE POLICY "Admins can manage all profiles" 
ON public.profiles 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role = 'admin' 
    AND p.is_approved = true
  )
);

-- Add database constraints to prevent invalid role assignments
ALTER TABLE public.profiles 
ADD CONSTRAINT check_valid_role 
CHECK (role IN ('developer', 'admin'));

-- Update handle_new_user function to use correct enum
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    'developer'::user_role,
    false  -- Requires admin approval
  );
  RETURN NEW;
END;
$$;