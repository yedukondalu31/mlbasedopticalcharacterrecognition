-- 1. Add missing index on evaluations.user_id for faster RLS lookups
CREATE INDEX IF NOT EXISTS idx_evaluations_user_id ON public.evaluations (user_id);

-- 2. Add missing index on saved_answer_keys.user_id
CREATE INDEX IF NOT EXISTS idx_saved_answer_keys_user_id ON public.saved_answer_keys (user_id);

-- 3. Add missing index on export_settings.user_id  
CREATE INDEX IF NOT EXISTS idx_export_settings_user_id ON public.export_settings (user_id);

-- 4. Add unique constraint on export_settings.user_id (one settings row per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_export_settings_unique_user ON public.export_settings (user_id);

-- 5. Fix RLS on export_settings: restrict to authenticated role instead of public
DROP POLICY IF EXISTS "Users delete own export settings" ON public.export_settings;
DROP POLICY IF EXISTS "Users insert own export settings" ON public.export_settings;
DROP POLICY IF EXISTS "Users update own export settings" ON public.export_settings;
DROP POLICY IF EXISTS "Users view own export settings" ON public.export_settings;

CREATE POLICY "Users view own export settings" ON public.export_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own export settings" ON public.export_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own export settings" ON public.export_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own export settings" ON public.export_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. Fix RLS on saved_answer_keys: restrict to authenticated role instead of public
DROP POLICY IF EXISTS "Users can create their own saved keys" ON public.saved_answer_keys;
DROP POLICY IF EXISTS "Users can delete their own saved keys" ON public.saved_answer_keys;
DROP POLICY IF EXISTS "Users can update their own saved keys" ON public.saved_answer_keys;
DROP POLICY IF EXISTS "Users can view their own saved keys" ON public.saved_answer_keys;

CREATE POLICY "Users can view their own saved keys" ON public.saved_answer_keys FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own saved keys" ON public.saved_answer_keys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own saved keys" ON public.saved_answer_keys FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own saved keys" ON public.saved_answer_keys FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 7. Add updated_at auto-update trigger for evaluations
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_evaluations ON public.evaluations;
CREATE TRIGGER set_updated_at_evaluations
  BEFORE UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_export_settings ON public.export_settings;
CREATE TRIGGER set_updated_at_export_settings
  BEFORE UPDATE ON public.export_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_saved_answer_keys ON public.saved_answer_keys;
CREATE TRIGGER set_updated_at_saved_answer_keys
  BEFORE UPDATE ON public.saved_answer_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();