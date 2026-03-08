import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Settings, Upload, Image as ImageIcon, Save, Palette, Type,
  Layout, Eye, Sparkles, Building2, FileSpreadsheet, RotateCcw, Check
} from 'lucide-react';
import { useExportSettings, ExportSettings as ExportSettingsType } from '@/hooks/useExportSettings';
import { toast } from '@/hooks/use-toast';

const PRESET_THEMES = [
  { name: 'Professional Blue', headerColor: '#1e40af', accentColor: '#3b82f6', icon: '🔵' },
  { name: 'Modern Green', headerColor: '#166534', accentColor: '#22c55e', icon: '🟢' },
  { name: 'Classic Red', headerColor: '#991b1b', accentColor: '#ef4444', icon: '🔴' },
  { name: 'Royal Purple', headerColor: '#581c87', accentColor: '#a855f7', icon: '🟣' },
  { name: 'Warm Orange', headerColor: '#9a3412', accentColor: '#f97316', icon: '🟠' },
  { name: 'Elegant Teal', headerColor: '#115e59', accentColor: '#14b8a6', icon: '🔷' },
] as const;

const FONT_OPTIONS = [
  { value: 'Arial', label: 'Arial', style: 'font-sans' },
  { value: 'Calibri', label: 'Calibri', style: 'font-sans' },
  { value: 'Times New Roman', label: 'Times New Roman', style: 'font-serif' },
  { value: 'Georgia', label: 'Georgia', style: 'font-serif' },
  { value: 'Verdana', label: 'Verdana', style: 'font-sans' },
  { value: 'Courier New', label: 'Courier New', style: 'font-mono' },
];

const ExportSettings = () => {
  const { settings, loading, saveSettings, uploadLogo } = useExportSettings();
  const [localSettings, setLocalSettings] = useState<ExportSettingsType>(settings);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setLocalSettings(settings);
  }, [open, settings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file type', description: 'Please upload an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please upload an image smaller than 2MB', variant: 'destructive' });
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
    setSaving(true);
    await saveSettings(localSettings);
    setSaving(false);
    setOpen(false);
  };

  const applyTheme = (theme: typeof PRESET_THEMES[number]) => {
    setLocalSettings({
      ...localSettings,
      headerColor: theme.headerColor,
      accentColor: theme.accentColor,
    });
  };

  const resetToDefaults = () => {
    setLocalSettings({
      headerColor: '#1e40af',
      accentColor: '#3b82f6',
      fontFamily: 'Arial',
      includeLogo: true,
      includeHeader: true,
      schoolName: undefined,
      schoolLogoUrl: undefined,
      footerText: undefined,
      borderStyle: 'thin',
    });
  };

  if (loading) return null;

  const sampleRows = [
    { roll: '001', total: 30, correct: 28, pct: '93.33%', marks: '28/30' },
    { roll: '002', total: 30, correct: 24, pct: '80.00%', marks: '24/30' },
    { roll: '003', total: 30, correct: 19, pct: '63.33%', marks: '19/30' },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Export Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Export Template Settings
          </DialogTitle>
          <DialogDescription>
            Customize branding, colors, fonts, and layout for your Excel reports
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="branding" className="px-6 pb-6">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="branding" className="gap-1.5 text-xs sm:text-sm">
              <Building2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Branding</span>
            </TabsTrigger>
            <TabsTrigger value="theme" className="gap-1.5 text-xs sm:text-sm">
              <Palette className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Theme</span>
            </TabsTrigger>
            <TabsTrigger value="layout" className="gap-1.5 text-xs sm:text-sm">
              <Layout className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Layout</span>
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5 text-xs sm:text-sm">
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </TabsTrigger>
          </TabsList>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-5 mt-0">
            <Card className="p-5 space-y-5 border-2">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">School Information</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="schoolName">School / Institution Name</Label>
                <Input
                  id="schoolName"
                  placeholder="e.g., Springfield Academy"
                  value={localSettings.schoolName || ''}
                  onChange={(e) => setLocalSettings({ ...localSettings, schoolName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>School Logo</Label>
                <div className="flex items-center gap-4 p-4 border-2 border-dashed rounded-xl bg-muted/20">
                  {localSettings.schoolLogoUrl ? (
                    <div className="relative w-20 h-20 border rounded-lg overflow-hidden bg-background shadow-sm">
                      <img src={localSettings.schoolLogoUrl} alt="School logo" className="w-full h-full object-contain p-1" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 border rounded-lg bg-muted/40 flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="gap-2"
                    >
                      {uploading ? (
                        <><Upload className="h-4 w-4 animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload className="h-4 w-4" /> {localSettings.schoolLogoUrl ? 'Change Logo' : 'Upload Logo'}</>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground">PNG or JPG, max 2MB</p>
                    {localSettings.schoolLogoUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive h-auto p-0"
                        onClick={() => setLocalSettings({ ...localSettings, schoolLogoUrl: undefined })}
                      >
                        Remove logo
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="footerText">Footer Text</Label>
                <Textarea
                  id="footerText"
                  placeholder="e.g., Confidential - For Internal Use Only"
                  value={localSettings.footerText || ''}
                  onChange={(e) => setLocalSettings({ ...localSettings, footerText: e.target.value })}
                  rows={2}
                  className="resize-none"
                />
              </div>
            </Card>
          </TabsContent>

          {/* Theme Tab */}
          <TabsContent value="theme" className="space-y-5 mt-0">
            {/* Preset Themes */}
            <Card className="p-5 space-y-4 border-2">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Quick Themes</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PRESET_THEMES.map((theme) => {
                  const isActive = localSettings.headerColor === theme.headerColor && localSettings.accentColor === theme.accentColor;
                  return (
                    <button
                      key={theme.name}
                      onClick={() => applyTheme(theme)}
                      className={`relative flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left text-sm ${
                        isActive
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex gap-1 shrink-0">
                        <div className="w-5 h-5 rounded-full shadow-sm" style={{ backgroundColor: theme.headerColor }} />
                        <div className="w-5 h-5 rounded-full shadow-sm" style={{ backgroundColor: theme.accentColor }} />
                      </div>
                      <span className="font-medium truncate">{theme.name}</span>
                      {isActive && <Check className="h-3.5 w-3.5 text-primary absolute top-1.5 right-1.5" />}
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Custom Colors */}
            <Card className="p-5 space-y-4 border-2">
              <div className="flex items-center gap-2 mb-1">
                <Palette className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Custom Colors</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Header Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={localSettings.headerColor}
                      onChange={(e) => setLocalSettings({ ...localSettings, headerColor: e.target.value })}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={localSettings.headerColor}
                      onChange={(e) => setLocalSettings({ ...localSettings, headerColor: e.target.value })}
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Accent Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={localSettings.accentColor || '#3b82f6'}
                      onChange={(e) => setLocalSettings({ ...localSettings, accentColor: e.target.value })}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={localSettings.accentColor || '#3b82f6'}
                      onChange={(e) => setLocalSettings({ ...localSettings, accentColor: e.target.value })}
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Typography */}
            <Card className="p-5 space-y-4 border-2">
              <div className="flex items-center gap-2 mb-1">
                <Type className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Typography</h3>
              </div>
              <div className="space-y-2">
                <Label>Font Family</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {FONT_OPTIONS.map((font) => (
                    <button
                      key={font.value}
                      onClick={() => setLocalSettings({ ...localSettings, fontFamily: font.value })}
                      className={`px-3 py-2.5 rounded-lg border-2 transition-all text-sm ${
                        localSettings.fontFamily === font.value
                          ? 'border-primary bg-primary/5 font-medium'
                          : 'border-border hover:border-primary/40'
                      }`}
                      style={{ fontFamily: font.value }}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Layout Tab */}
          <TabsContent value="layout" className="space-y-5 mt-0">
            <Card className="p-5 space-y-5 border-2">
              <div className="flex items-center gap-2 mb-1">
                <Layout className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Layout Options</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                  <div className="space-y-0.5">
                    <Label className="font-medium">Include Header</Label>
                    <p className="text-xs text-muted-foreground">Show school name and timestamp at top</p>
                  </div>
                  <Switch
                    checked={localSettings.includeHeader}
                    onCheckedChange={(checked) => setLocalSettings({ ...localSettings, includeHeader: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                  <div className="space-y-0.5">
                    <Label className="font-medium">Include Logo</Label>
                    <p className="text-xs text-muted-foreground">Display school logo in exports</p>
                  </div>
                  <Switch
                    checked={localSettings.includeLogo}
                    onCheckedChange={(checked) => setLocalSettings({ ...localSettings, includeLogo: checked })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Table Border Style</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['thin', 'medium', 'thick'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setLocalSettings({ ...localSettings, borderStyle: style })}
                      className={`px-3 py-2.5 rounded-lg border-2 transition-all text-sm capitalize ${
                        (localSettings.borderStyle || 'thin') === style
                          ? 'border-primary bg-primary/5 font-medium'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-5 mt-0">
            <Card className="p-5 border-2">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Live Excel Preview</h3>
              </div>

              <div className="border-2 rounded-xl overflow-hidden shadow-md bg-background" style={{ fontFamily: localSettings.fontFamily }}>
                {/* Header Section */}
                {localSettings.includeHeader && (
                  <div className="text-center p-5 border-b-2" style={{ backgroundColor: localSettings.headerColor + '10' }}>
                    {localSettings.includeLogo && localSettings.schoolLogoUrl && (
                      <div className="flex justify-center mb-2">
                        <img src={localSettings.schoolLogoUrl} alt="Logo" className="h-14 object-contain" />
                      </div>
                    )}
                    {localSettings.schoolName && (
                      <p className="font-bold text-lg" style={{ color: localSettings.headerColor }}>
                        {localSettings.schoolName}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">Evaluation Report • {new Date().toLocaleDateString()}</p>
                  </div>
                )}

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-px bg-border">
                  {[
                    { label: 'Total Students', value: '3' },
                    { label: 'Average Score', value: '78.89%' },
                    { label: 'Total Questions', value: '30' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-background p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                      <p className="font-bold text-lg" style={{ color: localSettings.accentColor || '#3b82f6' }}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Table Header */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: localSettings.headerColor }}>
                        {['Roll No', 'Total Q', 'Correct', 'Score %', 'Marks'].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-white font-semibold text-left text-xs">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sampleRows.map((row, i) => (
                        <tr
                          key={row.roll}
                          className={i % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                          style={{
                            borderBottom: `${
                              localSettings.borderStyle === 'thick' ? '2px' : localSettings.borderStyle === 'medium' ? '1.5px' : '1px'
                            } solid hsl(var(--border))`,
                          }}
                        >
                          <td className="px-3 py-2 font-mono text-xs">{row.roll}</td>
                          <td className="px-3 py-2 text-xs">{row.total}</td>
                          <td className="px-3 py-2 text-xs font-medium">{row.correct}</td>
                          <td className="px-3 py-2 text-xs">
                            <span
                              className="inline-block px-1.5 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: (localSettings.accentColor || '#3b82f6') + '18',
                                color: localSettings.accentColor || '#3b82f6',
                              }}
                            >
                              {row.pct}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs">{row.marks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                {localSettings.footerText && (
                  <div className="text-center py-3 border-t">
                    <p className="text-[10px] text-muted-foreground italic">{localSettings.footerText}</p>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Bar */}
        <div className="sticky bottom-0 flex items-center justify-between gap-2 px-6 py-4 border-t bg-background/95 backdrop-blur-sm">
          <Button variant="ghost" size="sm" onClick={resetToDefaults} className="gap-1.5 text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-[120px]">
              {saving ? (
                <><Save className="h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><Save className="h-4 w-4" /> Save Settings</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportSettings;
