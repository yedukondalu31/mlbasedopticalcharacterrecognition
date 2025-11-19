import { CheckCircle, XCircle, Download, RotateCcw, TrendingUp, AlertCircle, Flag, ThumbsUp, ThumbsDown, FileSpreadsheet, User, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EvaluationResult } from "@/pages/Index";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";

interface ResultsDashboardProps {
  result: EvaluationResult;
  uploadedImage: string | null;
  onReset: () => void;
}

const ResultsDashboard = ({ result, uploadedImage, onReset }: ResultsDashboardProps) => {
  const { extractedAnswers, correctAnswers, score, totalQuestions, accuracy, confidence, lowConfidenceCount, detailedResults, qualityIssues, imageQuality, rollNumber, gridConfig, subjectCode } = result;
  const [feedback, setFeedback] = useState<{[key: number]: 'correct' | 'incorrect' | null}>({});
  
  const handleFeedback = (questionNum: number, isCorrect: boolean) => {
    setFeedback(prev => ({
      ...prev,
      [questionNum]: isCorrect ? 'correct' : 'incorrect'
    }));
    
    // Log feedback for model improvement
    console.log("=== USER FEEDBACK ===");
    console.log({
      question: questionNum,
      userSaysCorrect: isCorrect,
      extractedAnswer: detailedResults?.[questionNum - 1]?.extracted || extractedAnswers[questionNum - 1],
      correctAnswer: correctAnswers[questionNum - 1],
      confidence: detailedResults?.[questionNum - 1]?.confidence,
      timestamp: new Date().toISOString()
    });
    console.log("=== END FEEDBACK ===");
    
    toast({
      title: "Feedback recorded",
      description: `Thank you! Your feedback helps improve accuracy. ${!isCorrect ? "We'll learn from this error." : ""}`,
    });
  };

  const handleExport = () => {
    // Create workbook for current evaluation
    const wb = XLSX.utils.book_new();

    // === EVALUATION SUMMARY ===
    const summaryData = [
      { 'Field': 'Roll Number', 'Value': rollNumber || 'Not Detected' },
      { 'Field': 'Subject Code', 'Value': subjectCode || 'Not Detected' },
      { 'Field': 'Date & Time', 'Value': new Date().toLocaleString() },
      { 'Field': 'Grid Configuration', 'Value': gridConfig ? `${gridConfig.rows}×${gridConfig.columns}` : 'Sequential' },
      { 'Field': '', 'Value': '' },
      { 'Field': 'Score', 'Value': `${score}/${totalQuestions}` },
      { 'Field': 'Accuracy', 'Value': `${accuracy.toFixed(2)}%` },
      { 'Field': 'Confidence', 'Value': confidence?.toUpperCase() || 'N/A' },
      { 'Field': 'Image Quality', 'Value': imageQuality?.toUpperCase() || 'N/A' },
      { 'Field': 'Low Confidence Answers', 'Value': lowConfidenceCount || 0 },
    ];
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 25 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // === DETAILED ANSWERS ===
    const answersData = extractedAnswers.map((extracted, index) => ({
      'Question': index + 1,
      'Extracted': extracted,
      'Correct': correctAnswers[index],
      'Result': extracted === correctAnswers[index] ? '✓ Correct' : '✗ Wrong',
      'Confidence': detailedResults?.[index]?.confidence?.toUpperCase() || 'UNKNOWN',
      'Notes': detailedResults?.[index]?.note || '-',
    }));
    const answersWs = XLSX.utils.json_to_sheet(answersData);
    answersWs['!cols'] = [
      { wch: 10 }, { wch: 10 }, { wch: 10 }, 
      { wch: 12 }, { wch: 12 }, { wch: 40 }
    ];
    XLSX.utils.book_append_sheet(wb, answersWs, 'Detailed Answers');

    // === STATISTICS ===
    const correctCount = extractedAnswers.filter((ans, idx) => ans === correctAnswers[idx]).length;
    const wrongCount = totalQuestions - correctCount;
    const statsData = [
      { 'Category': 'Correct Answers', 'Count': correctCount, 'Percentage': `${((correctCount / totalQuestions) * 100).toFixed(2)}%` },
      { 'Category': 'Wrong Answers', 'Count': wrongCount, 'Percentage': `${((wrongCount / totalQuestions) * 100).toFixed(2)}%` },
      { 'Category': '', 'Count': '', 'Percentage': '' },
      { 'Category': 'High Confidence', 'Count': detailedResults?.filter(r => r.confidence === 'high').length || 0, 'Percentage': '' },
      { 'Category': 'Medium Confidence', 'Count': detailedResults?.filter(r => r.confidence === 'medium').length || 0, 'Percentage': '' },
      { 'Category': 'Low Confidence', 'Count': detailedResults?.filter(r => r.confidence === 'low').length || 0, 'Percentage': '' },
    ];
    const statsWs = XLSX.utils.json_to_sheet(statsData);
    statsWs['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, statsWs, 'Statistics');

    // Generate file and download
    const filename = rollNumber 
      ? `Evaluation_${rollNumber}_${subjectCode || 'Unknown'}_${new Date().toISOString().split('T')[0]}.xlsx`
      : `Evaluation_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);

    toast({
      title: "Report exported 📊",
      description: `Evaluation report ${rollNumber ? `for ${rollNumber} ` : ""}exported as Excel with multiple sheets`,
    });
  };

  const handleExportAllResults = async () => {
    try {
      toast({
        title: "Exporting...",
        description: "Fetching all evaluations from database",
      });

      // Fetch all evaluations with complete data
      const { data: evaluations, error } = await supabase
        .from('evaluations')
        .select('*')
        .eq('user_id', (await supabase.auth.getSession()).data.session?.user.id)
        .order('subject_code', { ascending: true })
        .order('roll_number', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!evaluations || evaluations.length === 0) {
        toast({
          title: "No data found",
          description: "There are no evaluations to export",
          variant: "destructive",
        });
        return;
      }

      // Create workbook
      const wb = XLSX.utils.book_new();

      // === SUMMARY SHEET ===
      const summaryData = [
        { 'Metric': 'Total Evaluations', 'Value': evaluations.length },
        { 'Metric': 'Export Date', 'Value': new Date().toLocaleString() },
        { 'Metric': 'Subjects', 'Value': new Set(evaluations.map(e => e.subject_code || 'N/A')).size },
        { 'Metric': 'Students', 'Value': new Set(evaluations.map(e => e.roll_number)).size },
        { 'Metric': '', 'Value': '' },
        { 'Metric': 'Average Score', 'Value': `${(evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length).toFixed(2)}/${evaluations[0]?.total_questions || 'N/A'}` },
        { 'Metric': 'Average Accuracy', 'Value': `${(evaluations.reduce((sum, e) => sum + e.accuracy, 0) / evaluations.length).toFixed(2)}%` },
        { 'Metric': 'High Confidence', 'Value': evaluations.filter(e => e.confidence === 'high').length },
        { 'Metric': 'Medium Confidence', 'Value': evaluations.filter(e => e.confidence === 'medium').length },
        { 'Metric': 'Low Confidence', 'Value': evaluations.filter(e => e.confidence === 'low').length },
      ];
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      summaryWs['!cols'] = [{ wch: 20 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

      // === DETAILED RESULTS SHEET ===
      const detailedData = evaluations.map(e => ({
        'Roll Number': e.roll_number || 'N/A',
        'Subject Code': e.subject_code || 'N/A',
        'Score': e.score,
        'Total': e.total_questions,
        'Accuracy %': Number(e.accuracy).toFixed(2),
        'Confidence': e.confidence?.toUpperCase() || 'N/A',
        'Date': new Date(e.created_at).toLocaleDateString(),
        'Time': new Date(e.created_at).toLocaleTimeString(),
      }));
      const detailedWs = XLSX.utils.json_to_sheet(detailedData);
      detailedWs['!cols'] = [
        { wch: 15 }, { wch: 15 }, { wch: 8 }, { wch: 8 }, 
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }
      ];
      XLSX.utils.book_append_sheet(wb, detailedWs, 'Detailed Results');

      // === SUBJECT-WISE SHEETS WITH ANSWERS ===
      const groupedBySubject: { [key: string]: any[] } = {};
      evaluations.forEach(evaluation => {
        const subjectCode = evaluation.subject_code || 'NO_SUBJECT';
        if (!groupedBySubject[subjectCode]) {
          groupedBySubject[subjectCode] = [];
        }
        
        const maxQuestions = Math.max(20, evaluation.total_questions || 20);
        const row: any = {
          'REGD NO': evaluation.roll_number || 'N/A',
          'Date': new Date(evaluation.created_at).toLocaleDateString(),
          'Score': `${evaluation.score}/${evaluation.total_questions}`,
          'Accuracy': `${Number(evaluation.accuracy).toFixed(1)}%`,
        };
        
        // Add answers Q1-QN
        for (let i = 0; i < maxQuestions; i++) {
          const extracted = evaluation.extracted_answers[i] || '-';
          const correct = evaluation.correct_answers[i] || '-';
          const isCorrect = extracted === correct;
          row[`Q${i + 1}`] = extracted;
          row[`Q${i + 1}_Status`] = isCorrect ? '✓' : extracted === '-' ? '-' : '✗';
        }
        
        groupedBySubject[subjectCode].push(row);
      });

      // Add sheets for each subject
      Object.keys(groupedBySubject).sort().forEach(subjectCode => {
        const sheetData = groupedBySubject[subjectCode];
        const ws = XLSX.utils.json_to_sheet(sheetData);
        
        // Set column widths
        const colWidths = [
          { wch: 15 }, // REGD NO
          { wch: 12 }, // Date
          { wch: 10 }, // Score
          { wch: 10 }, // Accuracy
        ];
        
        // Question columns
        const maxQuestions = Math.max(...sheetData.map(row => {
          return Object.keys(row).filter(k => k.startsWith('Q') && !k.includes('_Status')).length;
        }));
        
        for (let i = 0; i < maxQuestions; i++) {
          colWidths.push({ wch: 5 });  // Answer
          colWidths.push({ wch: 4 });  // Status
        }
        
        ws['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, ws, subjectCode.substring(0, 31));
      });

      // === ANSWER KEY REFERENCE SHEET ===
      const answerKeyData: any[] = [];
      const subjectAnswerKeys = new Map<string, string[]>();
      
      evaluations.forEach(e => {
        const key = e.subject_code || 'NO_SUBJECT';
        if (!subjectAnswerKeys.has(key)) {
          subjectAnswerKeys.set(key, e.correct_answers);
        }
      });
      
      subjectAnswerKeys.forEach((answers, subject) => {
        const row: any = { 'Subject': subject };
        answers.forEach((ans, idx) => {
          row[`Q${idx + 1}`] = ans;
        });
        answerKeyData.push(row);
      });
      
      if (answerKeyData.length > 0) {
        const answerKeyWs = XLSX.utils.json_to_sheet(answerKeyData);
        const akColWidths = [{ wch: 15 }];
        for (let i = 0; i < 20; i++) {
          akColWidths.push({ wch: 5 });
        }
        answerKeyWs['!cols'] = akColWidths;
        XLSX.utils.book_append_sheet(wb, answerKeyWs, 'Answer Keys');
      }

      // Generate file and download
      const fileName = `OMR_Advanced_Results_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Export successful! 📊",
        description: `Exported ${evaluations.length} evaluations with Summary, Detailed Results, Answer Keys, and ${new Set(evaluations.map(e => e.subject_code || 'N/A')).size} Subject sheets`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export results",
        variant: "destructive",
      });
    }
  };

  return (
    <section className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-4 md:mb-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-1 md:mb-2">Results</h2>
            <p className="text-sm md:text-base text-muted-foreground hidden sm:block">
              Detailed analysis
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleExportAllResults} variant="default" size="sm" className="gap-2 min-h-[40px]">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Export All to Excel</span>
            <span className="sm:hidden">Export All</span>
          </Button>
          <Button variant="outline" onClick={handleExport} size="sm" className="flex-1 sm:flex-none min-h-[40px]">
            <FileSpreadsheet className="mr-1 md:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Export Current (Excel)</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Button variant="outline" onClick={onReset} size="sm" className="flex-1 sm:flex-none min-h-[40px]">
            <RotateCcw className="mr-1 md:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Start Over</span>
            <span className="sm:hidden">Reset</span>
          </Button>
        </div>
      </div>

      {/* Detection Preview Card */}
      {(rollNumber || subjectCode) && (
        <Card className="p-4 md:p-6 mb-4 md:mb-6 bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Detected Information</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rollNumber ? (
              <div className="flex items-start gap-3 p-3 bg-background/60 rounded-lg border border-border/50">
                <User className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Roll Number</p>
                  <p className="font-mono text-lg font-bold text-foreground tracking-wider break-all">
                    {rollNumber}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-dashed border-border">
                <User className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Roll Number</p>
                  <p className="text-sm text-muted-foreground italic">Not detected</p>
                </div>
              </div>
            )}

            {subjectCode ? (
              <div className="flex items-start gap-3 p-3 bg-background/60 rounded-lg border border-border/50">
                <BookOpen className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Subject Code</p>
                  <p className="font-mono text-lg font-bold text-foreground tracking-wider break-all">
                    {subjectCode}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-dashed border-border">
                <BookOpen className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Subject Code</p>
                  <p className="text-sm text-muted-foreground italic">Not detected</p>
                </div>
              </div>
            )}
          </div>
          {gridConfig && (
            <div className="mt-3 pt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Grid Configuration:</span> {gridConfig.rows}×{gridConfig.columns}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Quality Warnings */}
      {(qualityIssues && qualityIssues.length > 0) || imageQuality === "poor" || imageQuality === "fair" ? (
        <Card className="p-4 mb-4 bg-amber-500/10 border-amber-500/30 border-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1 text-amber-900 dark:text-amber-100">Quality Notice</h4>
              <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                {imageQuality === "poor" 
                  ? "The image quality is poor. Results may not be fully accurate."
                  : imageQuality === "fair"
                  ? "The image quality is fair. Some answers may need verification."
                  : "Some quality issues were detected during processing."}
              </p>
              {qualityIssues && qualityIssues.length > 0 && (
                <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  {qualityIssues.map((issue: string, idx: number) => (
                    <li key={idx}>• {issue}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-2 font-medium">
                💡 Tip: For better accuracy, use good lighting and ensure the paper is flat and straight.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-4 md:mb-6">
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

      <Card className="p-4 md:p-6 bg-gradient-card border-2">
        <div className="mb-4 md:mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs md:text-sm font-medium text-muted-foreground">Performance</span>
            <span className="text-sm md:text-base font-bold text-foreground">{accuracy.toFixed(1)}%</span>
          </div>
          <Progress value={accuracy} className="h-2 md:h-3" />
        </div>

        <div className="space-y-3 md:space-y-4">
          <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Answers</h3>
          
          <div className="grid grid-cols-1 gap-3 md:gap-4">
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
                    
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${confidenceColor}`}>
                          {result.confidence.toUpperCase()}
                        </span>
                        {result.note && (
                          <span className="text-xs text-muted-foreground">• {result.note}</span>
                        )}
                      </div>
                      
                      {/* Feedback buttons */}
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={feedback[result.question] === 'correct' ? "default" : "ghost"}
                          className="h-7 px-2"
                          onClick={() => handleFeedback(result.question, true)}
                          title="Mark as correctly extracted"
                        >
                          <ThumbsUp className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant={feedback[result.question] === 'incorrect' ? "destructive" : "ghost"}
                          className="h-7 px-2"
                          onClick={() => handleFeedback(result.question, false)}
                          title="Report incorrect extraction"
                        >
                          <ThumbsDown className="h-3 w-3" />
                        </Button>
                      </div>
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
    <Card className={`p-3 md:p-6 border-2 ${colorClasses[color]} transition-all hover:shadow-lg`}>
      <div className="flex items-center justify-between mb-1 md:mb-2">
        <span className="text-xs md:text-sm font-medium opacity-80">{title}</span>
        <span className="opacity-80">{icon}</span>
      </div>
      <div className="text-xl md:text-3xl font-bold">{value}</div>
    </Card>
  );
};

export default ResultsDashboard;
