import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Key, ChevronDown, Loader2, Play, Zap } from "lucide-react";
import { SavedAnswerKey, useSavedAnswerKeys } from "@/hooks/useSavedAnswerKeys";

interface QuickApplyKeyProps {
  onApplyKey: (
    answers: string[],
    gridConfig?: { rows: number; columns: number },
    detectRollNumber?: boolean,
    detectSubjectCode?: boolean
  ) => void;
  disabled?: boolean;
  sheetsCount: number;
}

const QuickApplyKey = ({ onApplyKey, disabled, sheetsCount }: QuickApplyKeyProps) => {
  const { savedKeys, loading } = useSavedAnswerKeys();

  const handleApplyKey = (key: SavedAnswerKey) => {
    const gridConfig = key.grid_rows && key.grid_columns 
      ? { rows: key.grid_rows, columns: key.grid_columns }
      : undefined;
    
    onApplyKey(
      key.answers,
      gridConfig,
      key.detect_roll_number,
      key.detect_subject_code
    );
  };

  if (savedKeys.length === 0 && !loading) {
    return null;
  }

  return (
    <Card className="p-4 bg-gradient-to-r from-accent/30 to-accent/10 border-2 border-accent/30">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 bg-accent rounded-full">
            <Zap className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Quick Apply Saved Key</p>
            <p className="text-sm text-muted-foreground">
              Apply a saved answer key to process {sheetsCount} sheet{sheetsCount !== 1 ? 's' : ''} instantly
            </p>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              disabled={disabled || loading}
              className="gap-2 min-w-[180px]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Apply & Process
                  <ChevronDown className="h-3 w-3 ml-1" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {savedKeys.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No saved answer keys
              </div>
            ) : (
              savedKeys.map((key) => (
                <DropdownMenuItem
                  key={key.id}
                  className="flex flex-col items-start gap-1 cursor-pointer py-3"
                  onClick={() => handleApplyKey(key)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Key className="h-4 w-4 text-primary" />
                    <span className="font-medium truncate flex-1">{key.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground pl-6">
                    {key.answers.length} questions
                    {key.grid_rows && key.grid_columns && ` • ${key.grid_rows}×${key.grid_columns} grid`}
                    {key.detect_roll_number && ' • Roll No.'}
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
};

export default QuickApplyKey;
