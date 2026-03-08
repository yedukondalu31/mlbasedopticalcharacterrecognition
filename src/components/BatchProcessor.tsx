import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Loader2, FileText, FileSpreadsheet, Plus, Play, ChevronDown, RotateCcw, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatBatchExport } from '@/lib/excelFormatter';
import { useExportSettings } from '@/hooks/useExportSettings';
import { Badge } from "@/components/ui/badge";
import BatchSummary from "@/components/BatchSummary";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  expectedCount?: number | null;
  onAddMore?: () => void;
  onProcessNewSheets?: () => void;
  onRetryFailed?: () => void;
  onRetryItem?: (index: number) => void;
  hasPendingSheets?: boolean;
  startTime?: number | null;
}

const BatchProcessor = ({ 
  items, 
  currentIndex, 
  onCancel, 
  isProcessing, 
  answerKey, 
  expectedCount,
  onAddMore,
  onProcessNewSheets,
  onRetryFailed,
  onRetryItem,
  hasPendingSheets,
  startTime,
}: BatchProcessorProps) => {
  const { settings } = useExportSettings();
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'completed' | 'error' | 'pending'>('all');
  const listRef = useRef<HTMLDivElement>(null);
  
  const completedCount = items.filter(item => item.status === 'completed').length;
  const errorCount = items.filter(item => item.status === 'error').length;
  const pendingCount = items.filter(item => item.status === 'pending').length;
  const processingCount = items.filter(item => item.status === 'processing').length;
  const isComplete = !isProcessing && currentIndex >= items.length && pendingCount === 0;
  
  const totalTarget = expectedCount || items.length;
  const progress = totalTarget > 0 ? ((completedCount + errorCount) / totalTarget) * 100 : 0;
  const remainingCount = totalTarget - completedCount;

  // ETA calculation
  const [eta, setEta] = useState<string | null>(null);
  useEffect(() => {
    if (!isProcessing || !startTime || completedCount === 0) {
      setEta(null);
      return;
    }
    const elapsed = (Date.now() - startTime) / 1000;
    const avgPerItem = elapsed / (completedCount + errorCount);
    const remaining = (pendingCount + processingCount) * avgPerItem;
    
    if (remaining < 60) {
      setEta(`~${Math.ceil(remaining)}s remaining`);
    } else {
      setEta(`~${Math.ceil(remaining / 60)}m remaining`);
    }
  }, [isProcessing, startTime, completedCount, errorCount, pendingCount, processingCount]);

  // Auto-scroll to active item
  useEffect(() => {
    if (isProcessing && listRef.current) {
      const activeItem = listRef.current.querySelector('[data-status="processing"]');
      activeItem?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentIndex, isProcessing]);

  const subjectCodes = [...new Set(
    items
      .filter(item => item.status === 'completed' && item.subjectCode)
      .map(item => item.subjectCode!)
  )].sort();

  const filteredItems = filter === 'all' 
    ? items 
    : items.filter(item => item.status === filter);

  const handleExportBatch = (filterSubject?: string) => {
    try {
      setExporting(true);
      let itemsToExport = items.filter(item => item.status === 'completed');
      
      if (filterSubject) {
        itemsToExport = itemsToExport.filter(item => item.subjectCode === filterSubject);
      }
      
      if (itemsToExport.length === 0) {
        toast({
          title: "No completed evaluations",
          description: filterSubject 
            ? `No results found for subject: ${filterSubject}`
            : "There are no successfully processed sheets to export",
          variant: "destructive",
        });
        return;
      }

      formatBatchExport(settings, filterSubject ? itemsToExport : items, answerKey);

      toast({
        title: "Batch export successful! 📊",
        description: filterSubject
          ? `Exported ${itemsToExport.length} results for ${filterSubject}`
          : `Exported ${itemsToExport.length} student results with custom formatting`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export batch results",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/20">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Batch Processing</h3>
            <p className="text-sm text-muted-foreground">
              Processing {items.length} answer sheet{items.length !== 1 ? 's' : ''}
              {eta && isProcessing && (
                <span className="ml-2 text-primary font-medium inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {eta}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isProcessing && onAddMore && (
              <Button onClick={onAddMore} variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add More
              </Button>
            )}
            
            {!isProcessing && hasPendingSheets && onProcessNewSheets && (
              <Button onClick={onProcessNewSheets} variant="default" size="sm" className="gap-2">
                <Play className="h-4 w-4" />
                Process New
              </Button>
            )}

            {/* Retry Failed Button */}
            {!isProcessing && errorCount > 0 && onRetryFailed && (
              <Button onClick={onRetryFailed} variant="outline" size="sm" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
                <RotateCcw className="h-4 w-4" />
                Retry Failed ({errorCount})
              </Button>
            )}
            
            {/* Export Button */}
            {isComplete && completedCount > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" size="sm" className="gap-2" disabled={exporting}>
                    {exporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                    Export Batch
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => handleExportBatch()}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export All Results
                  </DropdownMenuItem>
                  
                  {subjectCodes.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Export by Subject
                      </DropdownMenuLabel>
                      {subjectCodes.map((code) => {
                        const count = items.filter(i => i.status === 'completed' && i.subjectCode === code).length;
                        return (
                          <DropdownMenuItem 
                            key={code} 
                            onClick={() => handleExportBatch(code)}
                          >
                            <Badge variant="outline" className="mr-2 font-mono text-xs">
                              {code}
                            </Badge>
                            <span className="text-muted-foreground text-xs">
                              ({count} student{count !== 1 ? 's' : ''})
                            </span>
                          </DropdownMenuItem>
                        );
                      })}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* Cancel with confirmation */}
            {isProcessing && onCancel && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30">
                    Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel batch processing?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {completedCount} of {items.length} sheets have been processed. 
                      Completed results will be kept, but remaining sheets will stop processing.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Continue Processing</AlertDialogCancel>
                    <AlertDialogAction onClick={onCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Stop Processing
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {completedCount} of {totalTarget} completed
              {expectedCount && remainingCount > 0 && !isComplete && (
                <span className="ml-2 text-primary font-medium">
                  ({remainingCount} remaining)
                </span>
              )}
            </span>
            <span className="font-semibold text-foreground">{Math.min(Math.round(progress), 100)}%</span>
          </div>
          <Progress value={Math.min(progress, 100)} className="h-2.5" />
          {expectedCount && items.length < expectedCount && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {expectedCount - items.length} more sheet{expectedCount - items.length !== 1 ? 's' : ''} to upload
            </p>
          )}
        </div>

        {/* Status Summary Badges */}
        {(completedCount > 0 || errorCount > 0) && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              All ({items.length})
            </button>
            {completedCount > 0 && (
              <button
                onClick={() => setFilter('completed')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  filter === 'completed' ? 'bg-green-600 text-white' : 'bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20'
                }`}
              >
                <CheckCircle className="h-3 w-3" /> {completedCount}
              </button>
            )}
            {errorCount > 0 && (
              <button
                onClick={() => setFilter('error')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  filter === 'error' ? 'bg-red-600 text-white' : 'bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20'
                }`}
              >
                <XCircle className="h-3 w-3" /> {errorCount}
              </button>
            )}
            {pendingCount > 0 && (
              <button
                onClick={() => setFilter('pending')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  filter === 'pending' ? 'bg-muted-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <FileText className="h-3 w-3" /> {pendingCount}
              </button>
            )}
          </div>
        )}

        {/* Items List */}
        <div ref={listRef} className="max-h-72 overflow-y-auto space-y-2 mt-4 scroll-smooth">
          {filteredItems.map((item, _filteredIndex) => {
            const originalIndex = items.indexOf(item);
            return (
              <div
                key={originalIndex}
                data-status={item.status}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                  item.status === 'completed'
                    ? 'bg-green-500/10 border-green-500/20'
                    : item.status === 'error'
                    ? 'bg-red-500/10 border-red-500/20'
                    : item.status === 'processing'
                    ? 'bg-blue-500/10 border-blue-500/20 ring-1 ring-blue-500/30'
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
                    <div className="mt-1 space-y-1">
                      <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        {item.error || 'Processing failed'}
                      </p>
                      {!isProcessing && onRetryItem && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-500/10 gap-1"
                          onClick={() => onRetryItem(originalIndex)}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Retry
                        </Button>
                      )}
                    </div>
                  )}
                  
                  {item.status === 'processing' && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 animate-pulse">
                      Analyzing answer sheet...
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Completion Summary */}
        {isComplete && completedCount > 0 && (
          <BatchSummary items={items} />
        )}
      </div>
    </Card>
  );
};

export default BatchProcessor;
