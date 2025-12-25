import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Save, FolderOpen, Trash2, ChevronDown, Key, Loader2, Pencil } from "lucide-react";
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
  const { savedKeys, loading, saveAnswerKey, deleteAnswerKey, updateAnswerKey } = useSavedAnswerKeys();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingKey, setEditingKey] = useState<SavedAnswerKey | null>(null);
  const [editName, setEditName] = useState("");
  const [editAnswers, setEditAnswers] = useState<string[]>([]);
  const [editDetectRollNumber, setEditDetectRollNumber] = useState(true);
  const [editDetectSubjectCode, setEditDetectSubjectCode] = useState(true);

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

  const handleEditClick = (e: React.MouseEvent, key: SavedAnswerKey) => {
    e.stopPropagation();
    setEditingKey(key);
    setEditName(key.name);
    setEditAnswers([...key.answers]);
    setEditDetectRollNumber(key.detect_roll_number ?? true);
    setEditDetectSubjectCode(key.detect_subject_code ?? true);
    setEditDialogOpen(true);
  };

  const handleEditAnswerChange = (index: number, value: string) => {
    const upperValue = value.toUpperCase();
    if (upperValue === '' || /^[A-E]$/.test(upperValue)) {
      setEditAnswers(prev => {
        const newAnswers = [...prev];
        newAnswers[index] = upperValue;
        return newAnswers;
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingKey) return;
    
    if (!editName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the answer key",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    await updateAnswerKey(editingKey.id, {
      name: editName.trim(),
      answers: editAnswers,
      detect_roll_number: editDetectRollNumber,
      detect_subject_code: editDetectSubjectCode,
    });
    setIsSaving(false);
    setEditDialogOpen(false);
    setEditingKey(null);
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
        <DropdownMenuContent align="start" className="w-72">
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
                className="flex items-center justify-between cursor-pointer py-2"
                onClick={() => handleLoadKey(key)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{key.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {key.answers.length} questions
                    {key.grid_rows && key.grid_columns && ` • ${key.grid_rows}×${key.grid_columns}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                    onClick={(e) => handleEditClick(e, key)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={(e) => handleDelete(e, key)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
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

      {/* Edit Key Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Answer Key</DialogTitle>
            <DialogDescription>
              Modify the name, answers, and settings for this saved answer key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-key-name">Name</Label>
              <Input
                id="edit-key-name"
                placeholder="e.g., Math Final Exam 2024"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            {/* Detection Settings */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-detect-roll"
                  checked={editDetectRollNumber}
                  onCheckedChange={(checked) => setEditDetectRollNumber(checked === true)}
                />
                <Label htmlFor="edit-detect-roll" className="text-sm">Detect Roll Number</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-detect-subject"
                  checked={editDetectSubjectCode}
                  onCheckedChange={(checked) => setEditDetectSubjectCode(checked === true)}
                />
                <Label htmlFor="edit-detect-subject" className="text-sm">Detect Subject Code</Label>
              </div>
            </div>

            {/* Answer Grid */}
            <div className="space-y-2">
              <Label>Answers ({editAnswers.length} questions)</Label>
              <Card className="p-3 bg-muted/30">
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 max-h-64 overflow-y-auto">
                  {editAnswers.map((answer, index) => (
                    <div key={index} className="flex flex-col items-center">
                      <span className="text-xs text-muted-foreground mb-1">{index + 1}</span>
                      <Input
                        value={answer}
                        onChange={(e) => handleEditAnswerChange(index, e.target.value)}
                        maxLength={1}
                        className="w-10 h-10 text-center text-lg font-bold p-0"
                      />
                    </div>
                  ))}
                </div>
              </Card>
              <p className="text-xs text-muted-foreground">
                Valid answers: A, B, C, D, E (case insensitive)
              </p>
            </div>

            {editingKey?.grid_rows && editingKey?.grid_columns && (
              <Card className="p-3 bg-muted/50">
                <p className="text-sm">
                  <span className="font-medium">Grid Configuration:</span> {editingKey.grid_rows} × {editingKey.grid_columns}
                </p>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
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
