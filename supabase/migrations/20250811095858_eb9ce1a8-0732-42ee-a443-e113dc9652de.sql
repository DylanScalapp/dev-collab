-- Remove due_date column from tasks table
ALTER TABLE public.tasks DROP COLUMN IF EXISTS due_date;