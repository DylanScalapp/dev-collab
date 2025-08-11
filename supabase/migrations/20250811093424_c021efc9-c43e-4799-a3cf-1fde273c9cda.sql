-- Add new columns to projects table
ALTER TABLE public.projects 
ADD COLUMN start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN priority TEXT DEFAULT 'medium';

-- Add new columns to tasks table
ALTER TABLE public.tasks 
ADD COLUMN start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN end_date TIMESTAMP WITH TIME ZONE;

-- Remove the old assigned_to column from tasks (single assignment)
ALTER TABLE public.tasks DROP COLUMN IF EXISTS assigned_to;

-- Task assignments table already exists for multiple assignments