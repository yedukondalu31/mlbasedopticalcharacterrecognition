import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ExportSettings {
  id?: string;
  schoolName?: string;
  schoolLogoUrl?: string;
  headerColor: string;
  fontFamily: string;
  includeLogo: boolean;
  includeHeader: boolean;
  footerText?: string;
}

const DEFAULT_SETTINGS: ExportSettings = {
  headerColor: '#1e40af',
  fontFamily: 'Arial',
  includeLogo: true,
  includeHeader: true,
};

export const useExportSettings = () => {
  const [settings, setSettings] = useState<ExportSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('export_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          id: data.id,
          schoolName: data.school_name || undefined,
          schoolLogoUrl: data.school_logo_url || undefined,
          headerColor: data.header_color || DEFAULT_SETTINGS.headerColor,
          fontFamily: data.font_family || DEFAULT_SETTINGS.fontFamily,
          includeLogo: data.include_logo ?? DEFAULT_SETTINGS.includeLogo,
          includeHeader: data.include_header ?? DEFAULT_SETTINGS.includeHeader,
          footerText: data.footer_text || undefined,
        });
      }
    } catch (error) {
      console.error('Error fetching export settings:', error);
      toast({
        title: 'Error loading settings',
        description: 'Using default export settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: Partial<ExportSettings>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const settingsData = {
        user_id: user.id,
        school_name: newSettings.schoolName,
        school_logo_url: newSettings.schoolLogoUrl,
        header_color: newSettings.headerColor,
        font_family: newSettings.fontFamily,
        include_logo: newSettings.includeLogo,
        include_header: newSettings.includeHeader,
        footer_text: newSettings.footerText,
      };

      const { error } = await supabase
        .from('export_settings')
        .upsert(settingsData, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      await fetchSettings();
      
      toast({
        title: 'Settings saved',
        description: 'Export template updated successfully',
      });
    } catch (error) {
      console.error('Error saving export settings:', error);
      toast({
        title: 'Error saving settings',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive',
      });
    }
  };

  const uploadLogo = async (file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/logo.${fileExt}`;

      // Delete old logo if exists
      if (settings.schoolLogoUrl) {
        const oldPath = settings.schoolLogoUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('school-logos')
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('school-logos')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('school-logos')
        .getPublicUrl(fileName);

      await saveSettings({ ...settings, schoolLogoUrl: publicUrl });

      toast({
        title: 'Logo uploaded',
        description: 'School logo updated successfully',
      });

      return publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Error uploading logo',
        description: error instanceof Error ? error.message : 'Failed to upload logo',
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    saveSettings,
    uploadLogo,
    refreshSettings: fetchSettings,
  };
};
