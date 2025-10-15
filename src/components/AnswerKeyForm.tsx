import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Play, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AnswerKeyFormProps {
  onSubmit: (answers: string[]) => void;
  disabled: boolean;
  isProcessing: boolean;
}

const AnswerKeyForm = ({ onSubmit, disabled, isProcessing }: AnswerKeyFormProps) => {
  const [numQuestions, setNumQuestions] = useState(10);
  const [answers, setAnswers] = useState<string[]>(Array(10).fill(''));

  const handleNumQuestionsChange = (value: string) => {
    const num = parseInt(value) || 0;
    if (num > 0 && num <= 100) {
      setNumQuestions(num);
      setAnswers(Array(num).fill(''));
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

    onSubmit(answers);
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
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-foreground mb-2">Set Answer Key</h2>
        <p className="text-muted-foreground">
          Configure the correct answers for evaluation
        </p>
      </div>

      <Card className="p-6 bg-gradient-card border-2 transition-all hover:shadow-lg">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
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
            <div className="flex gap-2 pt-6">
              <Button variant="outline" size="sm" onClick={() => quickFill('A')}>Fill A</Button>
              <Button variant="outline" size="sm" onClick={() => quickFill('B')}>Fill B</Button>
              <Button variant="outline" size="sm" onClick={() => quickFill('C')}>Fill C</Button>
              <Button variant="outline" size="sm" onClick={() => quickFill('D')}>Fill D</Button>
            </div>
          </div>

          <div className="border-t pt-6">
            <Label className="text-base font-semibold mb-3 block">Answer Key (A, B, C, or D)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-3">
              {answers.map((answer, index) => (
                <div key={index} className="space-y-1">
                  <Label htmlFor={`answer-${index}`} className="text-xs text-muted-foreground">
                    Q{index + 1}
                  </Label>
                  <Input
                    id={`answer-${index}`}
                    value={answer}
                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                    maxLength={1}
                    className="text-center font-bold text-lg uppercase h-12"
                    placeholder="-"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <Button
              onClick={handleSubmit}
              disabled={disabled || isProcessing}
              size="lg"
              className="min-w-[200px] shadow-md hover:shadow-lg transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  Evaluate Answer Sheet
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
