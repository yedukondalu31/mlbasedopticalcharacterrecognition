import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Save, FolderOpen, Trash2, ChevronDown, Key, Loader2 } from "lucide-react";
import { SavedAnswerKey, useSavedAnswerKeys } from "@/hooks/useSavedAnswerKeys";
import { toast } from "@/hooks/use-toast";

interface SavedAnswerKeySelectorProps {
  currentAnswers: string[];
  currentGridConfig?: { rows: number; columns: number };
  detectRollNumber: boolean;
  detectSubjectCode: boolean;
  onLoadKey: (
    answers: string[],
    gridConfig?: { rows: number; columns: number },
    detectRollNumber?: boolean,
    detectSubjectCode?: boolean
  ) => void;
  disabled?: boolean;
}

const SavedAnswerKeySelector = ({
  currentAnswers,
  currentGridConfig,
  detectRollNumber,
  detectSubjectCode,
  onLoadKey,
  disabled,
}: SavedAnswerKeySelectorProps) => {
  const { savedKeys, loading, saveAnswerKey, deleteAnswerKey } = useSavedAnswerKeys();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!keyName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the answer key",
        variant: "destructive",
      });
      return;
    }

    if (currentAnswers.filter(a => a !== '').length === 0) {
      toast({
        title: "No answers to save",
        description: "Please fill in at least one answer before saving",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    await saveAnswerKey(
      keyName.trim(),
      currentAnswers,
      currentGridConfig,
      detectRollNumber,
      detectSubjectCode
    );
    setIsSaving(false);
    setSaveDialogOpen(false);
    setKeyName("");
  };

  const handleLoadKey = (key: SavedAnswerKey) => {
    const gridConfig = key.grid_rows && key.grid_columns 
      ? { rows: key.grid_rows, columns: key.grid_columns }
      : undefined;
    
    onLoadKey(
      key.answers,
      gridConfig,
      key.detect_roll_number,
      key.detect_subject_code
    );
    
    toast({
      title: "Answer key loaded",
      description: `Loaded "${key.name}" with ${key.answers.length} questions`,
    });
  };

  const handleDelete = async (e: React.MouseEvent, key: SavedAnswerKey) => {
    e.stopPropagation();
    await deleteAnswerKey(key.id);
  };

  const filledCount = currentAnswers.filter(a => a !== '').length;

  return (
    <div className="flex items-center gap-2">
      {/* Load Saved Key */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={disabled || loading}
            className="gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            Load Key
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
              Loading saved keys...
            </div>
          ) : savedKeys.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No saved answer keys
            </div>
          ) : (
            savedKeys.map((key) => (
              <DropdownMenuItem
                key={key.id}
                className="flex items-center justify-between cursor-pointer"
                onClick={() => handleLoadKey(key)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{key.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {key.answers.length} questions
                    {key.grid_rows && key.grid_columns && ` • ${key.grid_rows}×${key.grid_columns}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 ml-2 text-destructive hover:text-destructive"
                  onClick={(e) => handleDelete(e, key)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </DropdownMenuItem>
            ))
          )}
          {savedKeys.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {savedKeys.length} saved key{savedKeys.length !== 1 ? 's' : ''}
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Current Key */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={disabled || filledCount === 0}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save Key
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Answer Key</DialogTitle>
            <DialogDescription>
              Save this answer key for future use. You can load it later for batch processing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="e.g., Math Final Exam 2024"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>
            <Card className="p-3 bg-muted/50">
              <div className="text-sm space-y-1">
                <p><span className="font-medium">Questions:</span> {filledCount}</p>
                {currentGridConfig && (
                  <p><span className="font-medium">Grid:</span> {currentGridConfig.rows} × {currentGridConfig.columns}</p>
                )}
                <p><span className="font-medium">Detect Roll Number:</span> {detectRollNumber ? 'Yes' : 'No'}</p>
                <p><span className="font-medium">Detect Subject Code:</span> {detectSubjectCode ? 'Yes' : 'No'}</p>
              </div>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SavedAnswerKeySelector;
