import { CheckCircle, XCircle, Download, RotateCcw, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EvaluationResult } from "@/pages/Index";
import { toast } from "@/hooks/use-toast";

interface ResultsDashboardProps {
  result: EvaluationResult;
  uploadedImage: string | null;
  onReset: () => void;
}

const ResultsDashboard = ({ result, uploadedImage, onReset }: ResultsDashboardProps) => {
  const { extractedAnswers, correctAnswers, score, totalQuestions, accuracy, confidence, lowConfidenceCount, detailedResults } = result;

  const handleExport = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      score: `${score}/${totalQuestions}`,
      accuracy: `${accuracy.toFixed(2)}%`,
      answers: extractedAnswers.map((extracted, index) => ({
        question: index + 1,
        extracted,
        correct: correctAnswers[index],
        isCorrect: extracted === correctAnswers[index],
      })),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluation-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Report exported",
      description: "Evaluation report downloaded successfully",
    });
  };

  return (
    <section className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Evaluation Results</h2>
          <p className="text-muted-foreground">
            Detailed analysis of the answer sheet
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Start Over
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4 mb-6">
        <StatCard
          title="Score"
          value={`${score}/${totalQuestions}`}
          icon={<TrendingUp className="h-5 w-5" />}
          color="primary"
        />
        <StatCard
          title="Accuracy"
          value={`${accuracy.toFixed(1)}%`}
          icon={<CheckCircle className="h-5 w-5" />}
          color={accuracy >= 75 ? "success" : accuracy >= 50 ? "accent" : "destructive"}
        />
        <StatCard
          title="Confidence"
          value={confidence?.toUpperCase() || "N/A"}
          icon={<AlertCircle className="h-5 w-5" />}
          color={confidence === "high" ? "success" : confidence === "medium" ? "accent" : "destructive"}
        />
        <StatCard
          title="Incorrect"
          value={`${totalQuestions - score}`}
          icon={<XCircle className="h-5 w-5" />}
          color="destructive"
        />
      </div>

      <Card className="p-6 bg-gradient-card border-2">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Overall Performance</span>
            <span className="text-sm font-bold text-foreground">{accuracy.toFixed(1)}%</span>
          </div>
          <Progress value={accuracy} className="h-3" />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-4">Answer Comparison</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {detailedResults ? (
              detailedResults.map((result) => {
                const confidenceColor = result.confidence === "high" ? "text-success" :
                                      result.confidence === "medium" ? "text-accent" : "text-destructive";
                
                return (
                  <div
                    key={result.question}
                    className={`flex flex-col p-4 rounded-lg border-2 transition-all ${
                      result.isCorrect
                        ? 'bg-success/5 border-success/30'
                        : 'bg-destructive/5 border-destructive/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background text-sm font-bold">
                          {result.question}
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Extracted</div>
                          <div className="text-lg font-bold">{result.extracted}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div>
                          <div className="text-sm text-muted-foreground text-right">Correct</div>
                          <div className="text-lg font-bold">{result.correct}</div>
                        </div>
                        {result.isCorrect ? (
                          <CheckCircle className="h-6 w-6 text-success" />
                        ) : (
                          <XCircle className="h-6 w-6 text-destructive" />
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                      <span className={`text-xs font-semibold ${confidenceColor}`}>
                        {result.confidence.toUpperCase()}
                      </span>
                      {result.note && (
                        <span className="text-xs text-muted-foreground">• {result.note}</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              extractedAnswers.map((extracted, index) => {
                const correct = correctAnswers[index];
                const isCorrect = extracted === correct;
                
                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                      isCorrect
                        ? 'bg-success/5 border-success/30'
                        : 'bg-destructive/5 border-destructive/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Extracted</div>
                        <div className="text-lg font-bold">{extracted}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-sm text-muted-foreground text-right">Correct</div>
                        <div className="text-lg font-bold">{correct}</div>
                      </div>
                      {isCorrect ? (
                        <CheckCircle className="h-6 w-6 text-success" />
                      ) : (
                        <XCircle className="h-6 w-6 text-destructive" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>
    </section>
  );
};

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: "primary" | "success" | "accent" | "destructive";
}

const StatCard = ({ title, value, icon, color }: StatCardProps) => {
  const colorClasses = {
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-success/10 text-success border-success/20",
    accent: "bg-accent/10 text-accent border-accent/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <Card className={`p-6 border-2 ${colorClasses[color]} transition-all hover:shadow-lg`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium opacity-80">{title}</span>
        {icon}
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </Card>
  );
};

export default ResultsDashboard;
