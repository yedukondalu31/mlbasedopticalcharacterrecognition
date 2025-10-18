-- Create evaluations table to store answer sheet results
CREATE TABLE public.evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  answer_key TEXT[] NOT NULL,
  extracted_answers TEXT[] NOT NULL,
  correct_answers TEXT[] NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  accuracy NUMERIC(5,2) NOT NULL,
  confidence TEXT,
  low_confidence_count INTEGER DEFAULT 0,
  detailed_results JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert evaluations (public access for now)
CREATE POLICY "Anyone can insert evaluations"
ON public.evaluations
FOR INSERT
WITH CHECK (true);

-- Create policy to allow anyone to view evaluations
CREATE POLICY "Anyone can view evaluations"
ON public.evaluations
FOR SELECT
USING (true);

-- Create policy to allow anyone to update evaluations
CREATE POLICY "Anyone can update evaluations"
ON public.evaluations
FOR UPDATE
USING (true);

-- Create policy to allow anyone to delete evaluations
CREATE POLICY "Anyone can delete evaluations"
ON public.evaluations
FOR DELETE
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_evaluations_updated_at
BEFORE UPDATE ON public.evaluations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries by date
CREATE INDEX idx_evaluations_created_at ON public.evaluations(created_at DESC);