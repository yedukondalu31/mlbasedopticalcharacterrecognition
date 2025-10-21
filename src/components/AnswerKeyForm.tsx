import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Play, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AnswerKeyFormProps {
  onSubmit: (answers: string[], gridConfig?: { rows: number; columns: number }, detectRollNumber?: boolean) => void;
  disabled: boolean;
  isProcessing: boolean;
}

const AnswerKeyForm = ({ onSubmit, disabled, isProcessing }: AnswerKeyFormProps) => {
  const [gridMode, setGridMode] = useState(false);
  const [detectRollNumber, setDetectRollNumber] = useState(true);
  const [rows, setRows] = useState(5);
  const [columns, setColumns] = useState(4);
  const [numQuestions, setNumQuestions] = useState(10);
  const [answers, setAnswers] = useState<string[]>(Array(10).fill(''));

  const handleNumQuestionsChange = (value: string) => {
    const num = parseInt(value) || 0;
    if (num > 0 && num <= 100) {
      setNumQuestions(num);
      setAnswers(Array(num).fill(''));
    }
  };

  const handleGridDimensionChange = (newRows: number, newCols: number) => {
    const totalQuestions = newRows * newCols;
    if (totalQuestions > 0 && totalQuestions <= 100) {
      setRows(newRows);
      setColumns(newCols);
      setNumQuestions(totalQuestions);
      setAnswers(Array(totalQuestions).fill(''));
    }
  };

  const handleAnswerChange = (index: number, value: string) => {
    const upperValue = value.toUpperCase();
    if (upperValue === '' || ['A', 'B', 'C', 'D'].includes(upperValue)) {
      const newAnswers = [...answers];
      newAnswers[index] = upperValue;
      setAnswers(newAnswers);
    }
  };

  const handleSubmit = () => {
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
    onSubmit(answers, gridConfig, detectRollNumber);
  };

  const quickFill = (option: string) => {
    setAnswers(Array(numQuestions).fill(option));
    toast({
      title: "Quick filled",
      description: `All answers set to ${option}`,
    });
  };

  return (
    <section className="w-full">
      <div className="mb-4 md:mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-1 md:mb-2">Set Answer Key</h2>
        <p className="text-sm md:text-base text-muted-foreground">
          Configure the correct answers
        </p>
      </div>

      <Card className="p-4 md:p-6 bg-gradient-card border-2 transition-all hover:shadow-lg">
        <div className="space-y-4 md:space-y-6">
          {/* Roll Number Detection */}
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
                    min="1"
                    max="20"
                    value={rows}
                    onChange={(e) => handleGridDimensionChange(parseInt(e.target.value) || 1, columns)}
                    className="mt-1"
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <Label htmlFor="columns">Columns (n)</Label>
                  <Input
                    id="columns"
                    type="number"
                    min="1"
                    max="20"
                    value={columns}
                    onChange={(e) => handleGridDimensionChange(rows, parseInt(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <Label>Total: {rows} × {columns} = {numQuestions}</Label>
                </div>
              </>
            ) : (
              <div className="flex-1">
                <Label htmlFor="num-questions">Number of Questions</Label>
                <Input
                  id="num-questions"
                  type="number"
                  min="1"
                  max="100"
                  value={numQuestions}
                  onChange={(e) => handleNumQuestionsChange(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
            
            <div className="grid grid-cols-4 gap-2 pt-4 md:pt-6">
              <Button variant="outline" size="sm" onClick={() => quickFill('A')} className="min-h-[40px]">Fill A</Button>
              <Button variant="outline" size="sm" onClick={() => quickFill('B')} className="min-h-[40px]">Fill B</Button>
              <Button variant="outline" size="sm" onClick={() => quickFill('C')} className="min-h-[40px]">Fill C</Button>
              <Button variant="outline" size="sm" onClick={() => quickFill('D')} className="min-h-[40px]">Fill D</Button>
            </div>
          </div>

          <div className="border-t pt-4 md:pt-6">
            <Label className="text-sm md:text-base font-semibold mb-2 md:mb-3 block">
              Answer Key (A, B, C, or D) {gridMode && `- ${rows}×${columns}`}
            </Label>
            {gridMode ? (
              <div className="space-y-2">
                {Array.from({ length: rows }).map((_, rowIndex) => (
                  <div key={rowIndex} className="flex gap-2 justify-center">
                    {Array.from({ length: columns }).map((_, colIndex) => {
                      const index = rowIndex * columns + colIndex;
                      if (index >= numQuestions) return null;
                      return (
                        <div key={index} className="space-y-1">
                          <Label htmlFor={`answer-${index}`} className="text-xs text-muted-foreground block text-center">
                            Q{index + 1}
                          </Label>
                          <Input
                            id={`answer-${index}`}
                            value={answers[index]}
                            onChange={(e) => handleAnswerChange(index, e.target.value)}
                            maxLength={1}
                            className="text-center font-bold text-lg uppercase h-12 w-12"
                            placeholder="-"
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2 md:gap-3">
                {answers.map((answer, index) => (
                  <div key={index} className="space-y-1">
                    <Label htmlFor={`answer-${index}`} className="text-[10px] md:text-xs text-muted-foreground text-center block">
                      {index + 1}
                    </Label>
                    <Input
                      id={`answer-${index}`}
                      value={answer}
                      onChange={(e) => handleAnswerChange(index, e.target.value)}
                      maxLength={1}
                      className="text-center font-bold text-base md:text-lg uppercase h-10 md:h-12 touch-manipulation"
                      placeholder="-"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

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
