-- Add user_id column to evaluations table
ALTER TABLE public.evaluations 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Set a default value for existing rows (if any) - they will be orphaned but functional
UPDATE public.evaluations 
SET user_id = '00000000-0000-0000-0000-000000000000'::uuid
WHERE user_id IS NULL;

-- Make user_id NOT NULL after setting defaults
ALTER TABLE public.evaluations 
ALTER COLUMN user_id SET NOT NULL;

-- Drop all public policies
DROP POLICY IF EXISTS "Anyone can view evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Anyone can insert evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Anyone can update evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Anyone can delete evaluations" ON public.evaluations;

-- Create secure user-scoped policies
CREATE POLICY "Users view own evaluations"
  ON public.evaluations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own evaluations"
  ON public.evaluations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own evaluations"
  ON public.evaluations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own evaluations"
  ON public.evaluations FOR DELETE
  USING (auth.uid() = user_id);