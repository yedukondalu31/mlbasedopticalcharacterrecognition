import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface SavedAnswerKey {
  id: string;
  name: string;
  answers: string[];
  grid_rows: number | null;
  grid_columns: number | null;
  detect_roll_number: boolean;
  detect_subject_code: boolean;
  created_at: string;
  updated_at: string;
}

export const useSavedAnswerKeys = () => {
  const [savedKeys, setSavedKeys] = useState<SavedAnswerKey[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSavedKeys = async () => {
    try {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      // If auth session isn't ready yet, don't treat as an error — just show empty list.
      if (!user) {
        setSavedKeys([]);
        return;
      }

      const { data, error } = await supabase
        .from('saved_answer_keys' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setSavedKeys((data as unknown as SavedAnswerKey[]) || []);
    } catch (error) {
      console.error('Error fetching saved keys:', error);
      toast({
        title: "Couldn't load saved keys",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveAnswerKey = async (
    name: string,
    answers: string[],
    gridConfig?: { rows: number; columns: number },
    detectRollNumber: boolean = true,
    detectSubjectCode: boolean = true
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to save answer keys",
          variant: "destructive",
        });
        return null;
      }

      const { data, error } = await supabase
        .from('saved_answer_keys' as any)
        .insert({
          user_id: user.id,
          name,
          answers,
          grid_rows: gridConfig?.rows || null,
          grid_columns: gridConfig?.columns || null,
          detect_roll_number: detectRollNumber,
          detect_subject_code: detectSubjectCode,
        })
        .select()
        .single();

      if (error) throw error;

      setSavedKeys(prev => [data as unknown as SavedAnswerKey, ...prev]);
      toast({
        title: "Answer key saved",
        description: `"${name}" has been saved successfully`,
      });
      return data;
    } catch (error) {
      console.error('Error saving answer key:', error);
      toast({
        title: "Failed to save",
        description: "Could not save the answer key",
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteAnswerKey = async (id: string) => {
    try {
      const { error } = await supabase
        .from('saved_answer_keys' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSavedKeys(prev => prev.filter(key => key.id !== id));
      toast({
        title: "Deleted",
        description: "Answer key has been removed",
      });
    } catch (error) {
      console.error('Error deleting answer key:', error);
      toast({
        title: "Failed to delete",
        description: "Could not delete the answer key",
        variant: "destructive",
      });
    }
  };

  const updateAnswerKey = async (
    id: string,
    updates: Partial<Omit<SavedAnswerKey, 'id' | 'created_at' | 'updated_at'>>
  ) => {
    try {
      const { data, error } = await supabase
        .from('saved_answer_keys' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setSavedKeys(prev => prev.map(key => key.id === id ? (data as unknown as SavedAnswerKey) : key));
      toast({
        title: "Updated",
        description: "Answer key has been updated",
      });
      return data;
    } catch (error) {
      console.error('Error updating answer key:', error);
      toast({
        title: "Failed to update",
        description: "Could not update the answer key",
        variant: "destructive",
      });
      return null;
    }
  };

  useEffect(() => {
    fetchSavedKeys();

    // Refresh keys when auth state changes (initial session load, login/logout).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchSavedKeys();
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    savedKeys,
    loading,
    saveAnswerKey,
    deleteAnswerKey,
    updateAnswerKey,
    refreshKeys: fetchSavedKeys,
  };
};
