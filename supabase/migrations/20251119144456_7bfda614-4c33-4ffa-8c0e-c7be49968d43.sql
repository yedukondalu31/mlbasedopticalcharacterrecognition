-- Drop the existing unique index that doesn't include user_id
DROP INDEX IF EXISTS public.idx_unique_roll_subject;

-- Create a new unique index that includes user_id for proper multi-user isolation
-- This allows different users to scan the same roll_number + subject_code combination
-- while preventing duplicate scans by the same user
CREATE UNIQUE INDEX idx_unique_roll_subject_per_user 
ON public.evaluations (user_id, roll_number, subject_code) 
WHERE roll_number IS NOT NULL AND subject_code IS NOT NULL;