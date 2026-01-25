-- Fix 1: otp_codes table - Block ALL client access (both anonymous and authenticated)
-- OTP codes should ONLY be accessed by service role from edge functions
-- Drop existing policies if any and create deny-all policy for client access

-- First, ensure no direct client access is possible
CREATE POLICY "Deny all client access to otp_codes"
ON public.otp_codes
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Fix 2: evaluations table - The existing RESTRICTIVE policies don't work without a permissive base
-- We need to convert to permissive policies so they properly restrict by user_id
-- and block anonymous access

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users delete own evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Users insert own evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Users update own evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Users view own evaluations" ON public.evaluations;

-- Create new PERMISSIVE policies that only allow authenticated users to access their own data
-- This inherently blocks anonymous access since auth.uid() will be NULL for anon users
CREATE POLICY "Users can view their own evaluations"
ON public.evaluations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own evaluations"
ON public.evaluations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own evaluations"
ON public.evaluations
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own evaluations"
ON public.evaluations
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);