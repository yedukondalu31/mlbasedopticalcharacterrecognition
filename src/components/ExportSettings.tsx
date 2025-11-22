import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Settings, Upload, Image as ImageIcon, Save } from 'lucide-react';
import { useExportSettings } from '@/hooks/useExportSettings';
import { toast } from '@/hooks/use-toast';

const ExportSettings = () => {
  const { settings, loading, saveSettings, uploadLogo } = useExportSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 2MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const url = await uploadLogo(file);
      setLocalSettings({ ...localSettings, schoolLogoUrl: url });
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    await saveSettings(localSettings);
    setOpen(false);
  };

  if (loading) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Export Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Template Settings</DialogTitle>
          <DialogDescription>
            Customize your Excel export templates with school branding and formatting options
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* School Information */}
          <Card className="p-4 space-y-4">
            <h3 className="font-semibold text-lg">School Information</h3>
            
            <div className="space-y-2">
              <Label htmlFor="schoolName">School Name</Label>
              <Input
                id="schoolName"
                placeholder="Enter your school name"
                value={localSettings.schoolName || ''}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, schoolName: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>School Logo</Label>
              <div className="flex items-center gap-4">
                {localSettings.schoolLogoUrl && (
                  <div className="relative w-24 h-24 border rounded-lg overflow-hidden bg-muted">
                    <img
                      src={localSettings.schoolLogoUrl}
                      alt="School logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="gap-2"
                  >
                    {uploading ? (
                      <>
                        <Upload className="h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="h-4 w-4" />
                        {localSettings.schoolLogoUrl ? 'Change Logo' : 'Upload Logo'}
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    Max 2MB, PNG or JPG recommended
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Appearance */}
          <Card className="p-4 space-y-4">
            <h3 className="font-semibold text-lg">Appearance</h3>
            
            <div className="space-y-2">
              <Label htmlFor="headerColor">Header Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="headerColor"
                  type="color"
                  value={localSettings.headerColor}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, headerColor: e.target.value })
                  }
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={localSettings.headerColor}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, headerColor: e.target.value })
                  }
                  placeholder="#1e40af"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fontFamily">Font Family</Label>
              <select
                id="fontFamily"
                value={localSettings.fontFamily}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, fontFamily: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="Arial">Arial</option>
                <option value="Calibri">Calibri</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Georgia">Georgia</option>
                <option value="Verdana">Verdana</option>
              </select>
            </div>
          </Card>

          {/* Layout Options */}
          <Card className="p-4 space-y-4">
            <h3 className="font-semibold text-lg">Layout Options</h3>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include Header</Label>
                <p className="text-xs text-muted-foreground">
                  Show school name and timestamp at top
                </p>
              </div>
              <Switch
                checked={localSettings.includeHeader}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, includeHeader: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Include Logo</Label>
                <p className="text-xs text-muted-foreground">
                  Display school logo in exports
                </p>
              </div>
              <Switch
                checked={localSettings.includeLogo}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, includeLogo: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="footerText">Footer Text (Optional)</Label>
              <Textarea
                id="footerText"
                placeholder="e.g., Confidential - For Internal Use Only"
                value={localSettings.footerText || ''}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, footerText: e.target.value })
                }
                rows={2}
              />
            </div>
          </Card>

          {/* Preview */}
          <Card className="p-4 space-y-2 bg-muted/30">
            <h3 className="font-semibold text-sm text-muted-foreground">Preview</h3>
            <div className="border rounded-lg p-4 bg-background space-y-2">
              {localSettings.includeHeader && (
                <div className="text-center space-y-1">
                  {localSettings.includeLogo && localSettings.schoolLogoUrl && (
                    <div className="flex justify-center mb-2">
                      <img
                        src={localSettings.schoolLogoUrl}
                        alt="Logo preview"
                        className="h-12 object-contain"
                      />
                    </div>
                  )}
                  {localSettings.schoolName && (
                    <p className="font-bold text-lg">{localSettings.schoolName}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Evaluation Report</p>
                </div>
              )}
              <div
                className="rounded px-3 py-1.5 text-sm text-white text-center"
                style={{ backgroundColor: localSettings.headerColor }}
              >
                Header Preview - {localSettings.fontFamily}
              </div>
              {localSettings.footerText && (
                <p className="text-xs text-center text-muted-foreground italic mt-2">
                  {localSettings.footerText}
                </p>
              )}
            </div>
          </Card>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportSettings;
