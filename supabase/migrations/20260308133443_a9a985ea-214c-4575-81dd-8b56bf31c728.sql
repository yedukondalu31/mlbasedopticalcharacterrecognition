ALTER TABLE public.export_settings ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#3b82f6';
ALTER TABLE public.export_settings ADD COLUMN IF NOT EXISTS border_style TEXT DEFAULT 'thin';