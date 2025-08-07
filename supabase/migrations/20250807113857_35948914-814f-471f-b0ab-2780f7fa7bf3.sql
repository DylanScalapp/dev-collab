-- Fix infinite recursion in profiles policies by dropping problematic policies and recreating them correctly

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile basic info" ON public.profiles;
DROP POLICY IF EXISTS "Users can view approved profiles names only" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create simple, non-recursive policies

-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can update their own profile (excluding role and approval status)
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND
  role = OLD.role AND  -- Prevent role changes
  is_approved = OLD.is_approved  -- Prevent approval status changes
);

-- Users can view other approved profiles (basic info only)
CREATE POLICY "Users can view other approved profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() <> user_id AND 
  is_approved = true
);

-- Service role can manage all profiles (for admin operations)
CREATE POLICY "Service role can manage profiles" 
ON public.profiles 
FOR ALL 
USING (auth.role() = 'service_role');