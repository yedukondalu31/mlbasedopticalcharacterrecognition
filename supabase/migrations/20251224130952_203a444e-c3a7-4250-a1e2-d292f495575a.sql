-- Create table for saved answer keys
CREATE TABLE public.saved_answer_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  answers TEXT[] NOT NULL,
  grid_rows INTEGER,
  grid_columns INTEGER,
  detect_roll_number BOOLEAN DEFAULT true,
  detect_subject_code BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.saved_answer_keys ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own saved keys" 
ON public.saved_answer_keys 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own saved keys" 
ON public.saved_answer_keys 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved keys" 
ON public.saved_answer_keys 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved keys" 
ON public.saved_answer_keys 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_saved_answer_keys_updated_at
BEFORE UPDATE ON public.saved_answer_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();