import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Loader2, FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

export interface BatchProcessingItem {
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  rollNumber?: string;
  subjectCode?: string;
  score?: number;
  totalQuestions?: number;
  accuracy?: number;
  error?: string;
}

interface BatchProcessorProps {
  items: BatchProcessingItem[];
  currentIndex: number;
  onCancel?: () => void;
  isProcessing: boolean;
  answerKey?: string[];
}

const BatchProcessor = ({ items, currentIndex, onCancel, isProcessing, answerKey }: BatchProcessorProps) => {
  const progress = items.length > 0 ? ((currentIndex) / items.length) * 100 : 0;
  const completedCount = items.filter(item => item.status === 'completed').length;
  const errorCount = items.filter(item => item.status === 'error').length;
  const isComplete = !isProcessing && currentIndex >= items.length;

  const handleExportBatch = () => {
    try {
      const completedItems = items.filter(item => item.status === 'completed');
      
      if (completedItems.length === 0) {
        toast({
          title: "No completed evaluations",
          description: "There are no successfully processed sheets to export",
          variant: "destructive",
        });
        return;
      }

      // Create workbook
      const wb = XLSX.utils.book_new();

      // === BATCH SUMMARY SHEET ===
      const summaryData = [
        { 'Metric': 'Batch Date', 'Value': new Date().toLocaleString() },
        { 'Metric': 'Total Sheets Processed', 'Value': items.length },
        { 'Metric': 'Successful', 'Value': completedCount },
        { 'Metric': 'Failed', 'Value': errorCount },
        { 'Metric': '', 'Value': '' },
        { 'Metric': 'Average Score', 'Value': completedItems.length > 0 
          ? `${(completedItems.reduce((sum, item) => sum + (item.score || 0), 0) / completedItems.length).toFixed(2)}/${completedItems[0]?.totalQuestions || 'N/A'}`
          : 'N/A' },
        { 'Metric': 'Average Accuracy', 'Value': completedItems.length > 0
          ? `${(completedItems.reduce((sum, item) => sum + (item.accuracy || 0), 0) / completedItems.length).toFixed(2)}%`
          : 'N/A' },
        { 'Metric': 'Unique Students', 'Value': new Set(completedItems.map(item => item.rollNumber).filter(Boolean)).size },
        { 'Metric': 'Unique Subjects', 'Value': new Set(completedItems.map(item => item.subjectCode).filter(Boolean)).size },
      ];
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      summaryWs['!cols'] = [{ wch: 25 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Batch Summary');

      // === ALL RESULTS SHEET ===
      const allResultsData = completedItems.map(item => ({
        'File Name': item.fileName,
        'Roll Number': item.rollNumber || 'N/A',
        'Subject Code': item.subjectCode || 'N/A',
        'Score': item.score || 0,
        'Total': item.totalQuestions || 0,
        'Accuracy %': item.accuracy ? Number(item.accuracy).toFixed(2) : 'N/A',
      }));
      const allResultsWs = XLSX.utils.json_to_sheet(allResultsData);
      allResultsWs['!cols'] = [
        { wch: 30 }, { wch: 15 }, { wch: 15 }, 
        { wch: 8 }, { wch: 8 }, { wch: 12 }
      ];
      XLSX.utils.book_append_sheet(wb, allResultsWs, 'All Results');

      // === SUBJECT-WISE SHEETS ===
      const groupedBySubject: { [key: string]: any[] } = {};
      completedItems.forEach(item => {
        const subjectCode = item.subjectCode || 'NO_SUBJECT';
        if (!groupedBySubject[subjectCode]) {
          groupedBySubject[subjectCode] = [];
        }
        groupedBySubject[subjectCode].push(item);
      });

      Object.keys(groupedBySubject).sort().forEach(subjectCode => {
        const sheetData = groupedBySubject[subjectCode].map(item => ({
          'REGD NO': item.rollNumber || 'N/A',
          'File Name': item.fileName,
          'Score': `${item.score}/${item.totalQuestions}`,
          'Accuracy': `${item.accuracy?.toFixed(1)}%`,
        }));
        
        const ws = XLSX.utils.json_to_sheet(sheetData);
        ws['!cols'] = [
          { wch: 15 }, // REGD NO
          { wch: 30 }, // File Name
          { wch: 10 }, // Score
          { wch: 10 }, // Accuracy
        ];
        XLSX.utils.book_append_sheet(wb, ws, subjectCode.substring(0, 31));
      });

      // === ANSWER KEY REFERENCE ===
      if (answerKey && answerKey.length > 0) {
        const answerKeyData: any[] = [{ 'Info': 'Answer Key Used' }];
        const keyRow: any = {};
        answerKey.forEach((ans, idx) => {
          keyRow[`Q${idx + 1}`] = ans;
        });
        answerKeyData.push(keyRow);
        
        const answerKeyWs = XLSX.utils.json_to_sheet(answerKeyData);
        const akColWidths = [{ wch: 15 }];
        for (let i = 0; i < answerKey.length; i++) {
          akColWidths.push({ wch: 5 });
        }
        answerKeyWs['!cols'] = akColWidths;
        XLSX.utils.book_append_sheet(wb, answerKeyWs, 'Answer Key');
      }

      // === FAILED SHEETS LOG ===
      if (errorCount > 0) {
        const failedItems = items.filter(item => item.status === 'error');
        const failedData = failedItems.map(item => ({
          'File Name': item.fileName,
          'Error': item.error || 'Unknown error',
        }));
        const failedWs = XLSX.utils.json_to_sheet(failedData);
        failedWs['!cols'] = [{ wch: 30 }, { wch: 50 }];
        XLSX.utils.book_append_sheet(wb, failedWs, 'Failed Sheets');
      }

      // Generate file and download
      const fileName = `Batch_Results_${new Date().toISOString().split('T')[0]}_${completedCount}students.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Batch export successful! 📊",
        description: `Exported ${completedCount} student results with summary and subject-wise sheets`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export batch results",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/20">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Batch Processing</h3>
            <p className="text-sm text-muted-foreground">
              Processing {items.length} answer sheet{items.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            {isComplete && completedCount > 0 && (
              <Button onClick={handleExportBatch} variant="default" size="sm" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Export Batch
              </Button>
            )}
            {isProcessing && onCancel && (
              <Button onClick={onCancel} variant="outline" size="sm">
                Cancel
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {completedCount} of {items.length} completed
            </span>
            <span className="font-semibold text-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {errorCount > 0 && (
          <div className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            {errorCount} error{errorCount !== 1 ? 's' : ''} occurred
          </div>
        )}

        <div className="max-h-64 overflow-y-auto space-y-2 mt-4">
          {items.map((item, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                item.status === 'completed'
                  ? 'bg-green-500/10 border-green-500/20'
                  : item.status === 'error'
                  ? 'bg-red-500/10 border-red-500/20'
                  : item.status === 'processing'
                  ? 'bg-blue-500/10 border-blue-500/20'
                  : 'bg-muted/30 border-border'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {item.status === 'completed' && (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                )}
                {item.status === 'error' && (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
                {item.status === 'processing' && (
                  <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
                )}
                {item.status === 'pending' && (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.fileName}
                </p>
                
                {item.status === 'completed' && (
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {item.rollNumber && (
                      <p>Roll: <span className="font-mono">{item.rollNumber}</span></p>
                    )}
                    {item.subjectCode && (
                      <p>Subject: <span className="font-mono">{item.subjectCode}</span></p>
                    )}
                    {item.score !== undefined && item.totalQuestions !== undefined && (
                      <p>
                        Score: <span className="font-semibold">
                          {item.score}/{item.totalQuestions}
                        </span>
                        {item.accuracy !== undefined && (
                          <span className="ml-2">({item.accuracy.toFixed(1)}%)</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
                
                {item.status === 'error' && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {item.error || 'Processing failed'}
                  </p>
                )}
                
                {item.status === 'processing' && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Processing...
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default BatchProcessor;
