-- Add roll_number and grid configuration columns to evaluations table
ALTER TABLE public.evaluations
ADD COLUMN IF NOT EXISTS roll_number TEXT,
ADD COLUMN IF NOT EXISTS grid_rows INTEGER,
ADD COLUMN IF NOT EXISTS grid_columns INTEGER;