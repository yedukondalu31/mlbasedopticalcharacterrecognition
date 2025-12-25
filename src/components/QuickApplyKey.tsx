import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Key, ChevronDown, Loader2, Play, Zap, Search, Calendar, Hash } from "lucide-react";
import { SavedAnswerKey, useSavedAnswerKeys } from "@/hooks/useSavedAnswerKeys";
import { format } from "date-fns";

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
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredKeys = savedKeys.filter(key =>
    key.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    key.answers.length.toString().includes(searchQuery)
  );

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
          <DropdownMenuContent align="end" className="w-80">
            {/* Search Input */}
            {savedKeys.length > 3 && (
              <>
                <div className="p-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search keys..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-9"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            
            <div className="max-h-72 overflow-y-auto">
              {filteredKeys.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  {searchQuery ? "No matching keys found" : "No saved answer keys"}
                </div>
              ) : (
                filteredKeys.map((key) => (
                  <DropdownMenuItem
                    key={key.id}
                    className="flex flex-col items-start gap-1.5 cursor-pointer py-3 px-3"
                    onClick={() => handleApplyKey(key)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Key className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium truncate flex-1">{key.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-6 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {key.answers.length} questions
                      </span>
                      {key.grid_rows && key.grid_columns && (
                        <span className="bg-muted px-1.5 py-0.5 rounded">
                          {key.grid_rows}×{key.grid_columns} grid
                        </span>
                      )}
                      {key.detect_roll_number && (
                        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">Roll No.</span>
                      )}
                    </div>
                    <div className="pl-6 text-xs text-muted-foreground/70 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(key.updated_at), 'MMM d, yyyy')}
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </div>
            
            {savedKeys.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className="px-3 py-2 text-xs text-muted-foreground flex justify-between">
                  <span>{savedKeys.length} saved key{savedKeys.length !== 1 ? 's' : ''}</span>
                  {searchQuery && <span>{filteredKeys.length} shown</span>}
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
};

export default QuickApplyKey;
