import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Key, Play, Loader2, GripVertical, ClipboardPaste, Grid3X3, List, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import SavedAnswerKeySelector from "./SavedAnswerKeySelector";

interface AnswerKeyFormProps {
  onSubmit: (answers: string[], gridConfig?: { rows: number; columns: number }, detectRollNumber?: boolean, detectSubjectCode?: boolean) => void;
  disabled: boolean;
  isProcessing: boolean;
  initialAnswers?: string[];
  initialGridConfig?: { rows: number; columns: number };
  initialDetectRollNumber?: boolean;
  initialDetectSubjectCode?: boolean;
}

type EntryMode = "individual" | "bulk";

const AnswerKeyForm = ({ 
  onSubmit, 
  disabled, 
  isProcessing,
  initialAnswers,
  initialGridConfig,
  initialDetectRollNumber,
  initialDetectSubjectCode,
}: AnswerKeyFormProps) => {
  const [gridMode, setGridMode] = useState(!!initialGridConfig);
  const [detectRollNumber, setDetectRollNumber] = useState(initialDetectRollNumber ?? true);
  const [detectSubjectCode, setDetectSubjectCode] = useState(initialDetectSubjectCode ?? true);
  const [rows, setRows] = useState(initialGridConfig?.rows ?? 5);
  const [columns, setColumns] = useState(initialGridConfig?.columns ?? 4);
  const [numQuestions, setNumQuestions] = useState(initialAnswers?.length ?? 10);
  const [answers, setAnswers] = useState<string[]>(initialAnswers ?? Array(10).fill(''));
  const [entryMode, setEntryMode] = useState<EntryMode>("individual");
  const [bulkText, setBulkText] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showGridPreview, setShowGridPreview] = useState(false);

  const handleLoadKey = (
    loadedAnswers: string[],
    gridConfig?: { rows: number; columns: number },
    loadedDetectRollNumber?: boolean,
    loadedDetectSubjectCode?: boolean
  ) => {
    setAnswers(loadedAnswers);
    setNumQuestions(loadedAnswers.length);
    setDetectRollNumber(loadedDetectRollNumber ?? true);
    setDetectSubjectCode(loadedDetectSubjectCode ?? true);
    setBulkText(loadedAnswers.join(', '));
    
    if (gridConfig) {
      setGridMode(true);
      setRows(gridConfig.rows);
      setColumns(gridConfig.columns);
    } else {
      setGridMode(false);
    }
  };

  const handleNumQuestionsChange = (value: string) => {
    const num = parseInt(value) || 0;
    if (num >= 0 && num <= 200) {
      setNumQuestions(num);
      const newAnswers = Array(num).fill('').map((_, i) => answers[i] || '');
      setAnswers(newAnswers);
    }
  };

  const handleGridDimensionChange = (newRows: number, newCols: number) => {
    const safeRows = Math.max(0, newRows);
    const safeCols = Math.max(0, newCols);
    const totalQuestions = safeRows * safeCols;
    
    setRows(safeRows);
    setColumns(safeCols);
    setNumQuestions(totalQuestions);
    const newAnswers = Array(Math.max(0, totalQuestions)).fill('').map((_, i) => answers[i] || '');
    setAnswers(newAnswers);
  };

  const handleAnswerChange = (index: number, value: string) => {
    const upperValue = value.toUpperCase();
    if (upperValue === '' || ['A', 'B', 'C', 'D', 'E'].includes(upperValue)) {
      const newAnswers = [...answers];
      newAnswers[index] = upperValue;
      setAnswers(newAnswers);
    }
  };

  // Bulk entry
  const handleBulkApply = () => {
    const parsed = bulkText
      .toUpperCase()
      .split(/[\s,;]+/)
      .map(s => s.trim())
      .filter(s => /^[A-E]$/.test(s));

    if (parsed.length === 0) {
      toast({
        title: "No valid answers found",
        description: "Enter answers as A, B, C, D, or E separated by commas or spaces",
        variant: "destructive",
      });
      return;
    }

    setAnswers(parsed);
    setNumQuestions(parsed.length);
    if (!gridMode) {
      // keep grid mode off
    }
    toast({
      title: `${parsed.length} answers applied`,
      description: "Bulk entry applied successfully",
    });
    setEntryMode("individual");
  };

  // Reorder
  const moveQuestion = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= answers.length) return;
    const newAnswers = [...answers];
    const [moved] = newAnswers.splice(fromIndex, 1);
    newAnswers.splice(toIndex, 0, moved);
    setAnswers(newAnswers);
  };

  const addQuestion = () => {
    if (answers.length >= 200) return;
    setAnswers([...answers, '']);
    setNumQuestions(answers.length + 1);
  };

  const removeQuestion = (index: number) => {
    if (answers.length <= 1) return;
    const newAnswers = answers.filter((_, i) => i !== index);
    setAnswers(newAnswers);
    setNumQuestions(newAnswers.length);
  };

  // Drag and drop
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    moveQuestion(dragIndex, index);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const handleSubmit = () => {
    if (numQuestions === 0) {
      toast({
        title: "No questions configured",
        description: "Please set at least 1 question to evaluate",
        variant: "destructive",
      });
      return;
    }
    
    const filledAnswers = answers.filter(a => a !== '');
    
    if (filledAnswers.length !== numQuestions) {
      toast({
        title: "Incomplete answer key",
        description: `Please fill all ${numQuestions} answers`,
        variant: "destructive",
      });
      return;
    }

    const gridConfig = gridMode ? { rows, columns } : undefined;
    onSubmit(answers, gridConfig, detectRollNumber, detectSubjectCode);
  };

  const quickFill = (option: string) => {
    setAnswers(Array(numQuestions).fill(option));
    toast({
      title: "Quick filled",
      description: `All answers set to ${option}`,
    });
  };

  const filledCount = answers.filter(a => a !== '').length;

  return (
    <section className="w-full">
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-1 md:mb-2">Set Answer Key</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Configure the correct answers or load a saved key
          </p>
        </div>
        <SavedAnswerKeySelector
          currentAnswers={answers}
          currentGridConfig={gridMode ? { rows, columns } : undefined}
          detectRollNumber={detectRollNumber}
          detectSubjectCode={detectSubjectCode}
          onLoadKey={handleLoadKey}
          disabled={disabled || isProcessing}
        />
      </div>

      <Card className="p-4 md:p-6 bg-gradient-card border-2 transition-all hover:shadow-lg">
        <div className="space-y-4 md:space-y-6">
          {/* Detection toggles */}
          <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 flex-1">
              <input
                id="detect-roll"
                type="checkbox"
                checked={detectRollNumber}
                onChange={(e) => setDetectRollNumber(e.target.checked)}
                className="w-4 h-4 cursor-pointer accent-primary"
              />
              <Label htmlFor="detect-roll" className="cursor-pointer font-medium">
                Detect Roll Number from Answer Sheet
              </Label>
            </div>
            <div className="text-xs text-muted-foreground hidden sm:block">
              AI will extract 10-box alphanumeric roll number
            </div>
          </div>

          <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 flex-1">
              <input
                id="detect-subject"
                type="checkbox"
                checked={detectSubjectCode}
                onChange={(e) => setDetectSubjectCode(e.target.checked)}
                className="w-4 h-4 cursor-pointer accent-primary"
              />
              <Label htmlFor="detect-subject" className="cursor-pointer font-medium">
                Detect Subject Code from Answer Sheet
              </Label>
            </div>
            <div className="text-xs text-muted-foreground hidden sm:block">
              AI will extract subject/course code
            </div>
          </div>

          {/* Grid / Question Config */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label htmlFor="grid-mode" className="cursor-pointer">Grid Mode</Label>
              <input
                id="grid-mode"
                type="checkbox"
                checked={gridMode}
                onChange={(e) => setGridMode(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
            </div>
            
            {gridMode ? (
              <>
                <div className="flex-1 min-w-[120px]">
                  <Label htmlFor="rows">Rows (m)</Label>
                  <Input
                    id="rows"
                    type="number"
                    min="0"
                    max="50"
                    value={rows}
                    onChange={(e) => handleGridDimensionChange(parseInt(e.target.value) || 0, columns)}
                    className="mt-1"
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <Label htmlFor="columns">Columns (n)</Label>
                  <Input
                    id="columns"
                    type="number"
                    min="0"
                    max="50"
                    value={columns}
                    onChange={(e) => handleGridDimensionChange(rows, parseInt(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <Label className={numQuestions === 0 ? "text-muted-foreground" : ""}>
                    Total: {rows} × {columns} = {numQuestions}
                  </Label>
                  {numQuestions === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Set rows and columns to create questions
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1">
                <Label htmlFor="num-questions">Number of Questions</Label>
                <Input
                  id="num-questions"
                  type="number"
                  min="0"
                  max="200"
                  value={numQuestions}
                  onChange={(e) => handleNumQuestionsChange(e.target.value)}
                  className="mt-1"
                />
                {numQuestions === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Set to at least 1 to create answer fields
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Entry Mode Toggle + Quick Fill */}
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <div className="flex rounded-lg border border-border overflow-hidden">
              <Button
                variant={entryMode === "individual" ? "default" : "ghost"}
                size="sm"
                onClick={() => setEntryMode("individual")}
                className="rounded-none gap-1.5"
              >
                <List className="h-3.5 w-3.5" />
                Individual
              </Button>
              <Button
                variant={entryMode === "bulk" ? "default" : "ghost"}
                size="sm"
                onClick={() => setEntryMode("bulk")}
                className="rounded-none gap-1.5"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                Bulk Paste
              </Button>
            </div>

            {gridMode && numQuestions > 0 && (
              <Button
                variant={showGridPreview ? "default" : "outline"}
                size="sm"
                onClick={() => setShowGridPreview(!showGridPreview)}
                className="gap-1.5"
              >
                <Grid3X3 className="h-3.5 w-3.5" />
                Grid Preview
              </Button>
            )}

            <div className="ml-auto flex gap-1">
              {['A', 'B', 'C', 'D', 'E'].map(opt => (
                <Button key={opt} variant="outline" size="sm" onClick={() => quickFill(opt)} className="min-h-[36px] w-10">
                  {opt}
                </Button>
              ))}
            </div>
          </div>

          {/* Progress indicator */}
          {numQuestions > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${(filledCount / numQuestions) * 100}%` }}
                />
              </div>
              <span className="text-muted-foreground font-medium whitespace-nowrap">
                {filledCount}/{numQuestions} filled
              </span>
            </div>
          )}

          {/* Bulk Entry Mode */}
          {entryMode === "bulk" && (
            <Card className="p-4 bg-muted/30 border-dashed border-2">
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-semibold">Paste Answers</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter answers separated by commas, spaces, or new lines. Example: <code className="bg-muted px-1 rounded">A, B, C, D, A, B, C, D, A, B</code>
                  </p>
                </div>
                <Textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="A, B, C, D, A, B, C, D, A, B..."
                  className="font-mono text-sm min-h-[100px]"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {bulkText.toUpperCase().split(/[\s,;]+/).filter(s => /^[A-E]$/.test(s.trim())).length} valid answers detected
                  </span>
                  <Button onClick={handleBulkApply} size="sm" className="gap-1.5">
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    Apply Answers
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Individual Entry Mode */}
          {entryMode === "individual" && (
            <div>
              <Label className="text-sm md:text-base font-semibold mb-2 md:mb-3 block">
                Answer Key (A–E) {gridMode && `— ${rows}×${columns}`}
              </Label>
              {numQuestions === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg mb-2">No questions configured</p>
                  <p className="text-sm">
                    {gridMode 
                      ? "Set rows and columns above to create answer fields"
                      : "Set number of questions above to create answer fields"
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                  {answers.map((answer, index) => (
                    <div
                      key={index}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all group ${
                        dragIndex === index
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-transparent hover:border-border hover:bg-muted/30'
                      }`}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab active:cursor-grabbing shrink-0" />
                      <span className="text-xs text-muted-foreground font-mono w-8 text-right shrink-0">
                        Q{index + 1}
                      </span>
                      
                      {/* Option buttons */}
                      <div className="flex gap-1">
                        {['A', 'B', 'C', 'D', 'E'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleAnswerChange(index, opt)}
                            className={`w-9 h-9 rounded-md text-sm font-bold transition-all border ${
                              answer === opt
                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>

                      {/* Reorder + Remove */}
                      <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveQuestion(index, index - 1)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveQuestion(index, index + 1)}
                          disabled={index === answers.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        {!gridMode && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeQuestion(index)}
                            disabled={answers.length <= 1}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add question button (non-grid mode only) */}
              {!gridMode && numQuestions > 0 && numQuestions < 200 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addQuestion}
                  className="mt-3 gap-1.5 w-full border-dashed"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Question
                </Button>
              )}
            </div>
          )}

          {/* Visual Grid Preview */}
          {showGridPreview && gridMode && numQuestions > 0 && (
            <Card className="p-4 bg-muted/20 border-2 border-dashed">
              <div className="flex items-center gap-2 mb-3">
                <Grid3X3 className="h-4 w-4 text-primary" />
                <Label className="font-semibold text-sm">Grid Preview ({rows}×{columns})</Label>
              </div>
              <div className="overflow-x-auto">
                <table className="border-collapse mx-auto">
                  <thead>
                    <tr>
                      <th className="p-1 text-xs text-muted-foreground"></th>
                      {Array.from({ length: columns }).map((_, c) => (
                        <th key={c} className="p-1 text-xs text-muted-foreground font-medium text-center min-w-[40px]">
                          C{c + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: rows }).map((_, r) => (
                      <tr key={r}>
                        <td className="p-1 text-xs text-muted-foreground font-medium pr-2">R{r + 1}</td>
                        {Array.from({ length: columns }).map((_, c) => {
                          const idx = r * columns + c;
                          const val = answers[idx] || '';
                          const filled = val !== '';
                          return (
                            <td key={c} className="p-0.5">
                              <div className={`w-10 h-10 rounded-md border-2 flex items-center justify-center text-sm font-bold transition-colors ${
                                filled
                                  ? 'bg-primary/10 border-primary/40 text-primary'
                                  : 'bg-background border-border text-muted-foreground/30'
                              }`}>
                                {filled ? val : `${idx + 1}`}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Questions are numbered left-to-right, top-to-bottom
              </p>
            </Card>
          )}

          <div className="flex justify-center pt-4">
            <Button
              onClick={handleSubmit}
              disabled={disabled || isProcessing}
              size="lg"
              className="w-full sm:w-auto sm:min-w-[200px] min-h-[48px] shadow-md hover:shadow-lg transition-all touch-manipulation"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  Evaluate Sheet
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
};

export default AnswerKeyForm;
