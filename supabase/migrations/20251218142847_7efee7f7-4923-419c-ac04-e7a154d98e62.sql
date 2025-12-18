-- Create storage bucket for answer sheets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('answer-sheets', 'answer-sheets', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: Users can upload their own sheets
CREATE POLICY "Users upload own answer sheets" 
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'answer-sheets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS policy: Users can view their own sheets
CREATE POLICY "Users view own answer sheets" 
ON storage.objects FOR SELECT
USING (bucket_id = 'answer-sheets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS policy: Users can delete their own sheets
CREATE POLICY "Users delete own answer sheets" 
ON storage.objects FOR DELETE
USING (bucket_id = 'answer-sheets' AND auth.uid()::text = (storage.foldername(name))[1]);