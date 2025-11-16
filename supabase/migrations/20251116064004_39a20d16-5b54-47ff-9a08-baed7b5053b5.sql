-- Add subject_code column to evaluations table
ALTER TABLE public.evaluations 
ADD COLUMN subject_code text;

-- Add unique constraint to prevent duplicate entries for same roll_number + subject_code
-- Note: This will only work for future entries, existing duplicates need to be handled separately
CREATE UNIQUE INDEX idx_unique_roll_subject ON public.evaluations(roll_number, subject_code) 
WHERE roll_number IS NOT NULL AND subject_code IS NOT NULL;

-- Add index for better query performance on subject_code
CREATE INDEX idx_evaluations_subject_code ON public.evaluations(subject_code);

-- Add index for better query performance on combined roll_number and subject_code
CREATE INDEX idx_evaluations_roll_subject ON public.evaluations(roll_number, subject_code);