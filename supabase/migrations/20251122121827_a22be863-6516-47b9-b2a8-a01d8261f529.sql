-- Create table for export settings
CREATE TABLE IF NOT EXISTS public.export_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  school_name TEXT,
  school_logo_url TEXT,
  header_color TEXT DEFAULT '#1e40af',
  font_family TEXT DEFAULT 'Arial',
  include_logo BOOLEAN DEFAULT true,
  include_header BOOLEAN DEFAULT true,
  footer_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.export_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users view own export settings" 
ON public.export_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own export settings" 
ON public.export_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own export settings" 
ON public.export_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own export settings" 
ON public.export_settings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_export_settings_updated_at
BEFORE UPDATE ON public.export_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for school logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('school-logos', 'school-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for logos
CREATE POLICY "Users can upload their own school logo" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'school-logos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "School logos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'school-logos');

CREATE POLICY "Users can update their own school logo" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'school-logos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own school logo" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'school-logos' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);