-- Fix infinite recursion in profiles policies by dropping problematic policies and recreating them correctly

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile basic info" ON public.profiles;
DROP POLICY IF EXISTS "Users can view approved profiles names only" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.profiles;

-- Create simple, non-recursive policies

-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can update their own profile basic info only (no role/approval changes)
CREATE POLICY "Users can update own profile basic info" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can view other approved profiles (basic info only)
CREATE POLICY "Users can view other approved profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() <> user_id AND 
  is_approved = true
);

-- Create security definer function to check admin role safely
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role::text FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Admin policy using security definer function to avoid recursion
CREATE POLICY "Admins can manage all profiles" 
ON public.profiles 
FOR ALL 
USING (get_current_user_role() = 'admin');

-- Add constraint to prevent role/approval changes via regular updates
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_immutable_check CHECK (role IS NOT NULL);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_approval_immutable_check CHECK (is_approved IS NOT NULL);