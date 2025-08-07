-- Fix security warnings by properly updating the function

-- First drop the policy that depends on the function
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Drop and recreate the function with proper search_path
DROP FUNCTION IF EXISTS public.get_current_user_role();

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
SET search_path = ''
AS $$
  SELECT role::text FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Recreate the admin policy using the updated function
CREATE POLICY "Admins can manage all profiles" 
ON public.profiles 
FOR ALL 
USING (get_current_user_role() = 'admin');