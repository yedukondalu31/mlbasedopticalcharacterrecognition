import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, 
  Users, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  TrendingDown,
  Award,
  AlertTriangle
} from "lucide-react";
import { BatchProcessingItem } from "@/components/BatchProcessor";

interface BatchSummaryProps {
  items: BatchProcessingItem[];
}

const BatchSummary = ({ items }: BatchSummaryProps) => {
  const completedItems = items.filter(item => item.status === 'completed');
  const errorItems = items.filter(item => item.status === 'error');
  
  if (completedItems.length === 0) return null;

  // Calculate statistics
  const scores = completedItems
    .filter(item => item.score !== undefined && item.totalQuestions !== undefined)
    .map(item => ({
      score: item.score!,
      total: item.totalQuestions!,
      accuracy: item.accuracy || (item.score! / item.totalQuestions!) * 100,
      rollNumber: item.rollNumber,
      fileName: item.fileName,
    }));

  const avgAccuracy = scores.length > 0 
    ? scores.reduce((sum, s) => sum + s.accuracy, 0) / scores.length 
    : 0;

  const avgScore = scores.length > 0
    ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
    : 0;

  const totalQuestions = scores.length > 0 ? scores[0].total : 0;
  
  const highestScore = scores.length > 0 
    ? scores.reduce((max, s) => s.score > max.score ? s : max, scores[0])
    : null;
    
  const lowestScore = scores.length > 0 
    ? scores.reduce((min, s) => s.score < min.score ? s : min, scores[0])
    : null;

  // Grade distribution
  const gradeDistribution = {
    excellent: scores.filter(s => s.accuracy >= 90).length,
    good: scores.filter(s => s.accuracy >= 75 && s.accuracy < 90).length,
    average: scores.filter(s => s.accuracy >= 50 && s.accuracy < 75).length,
    needsImprovement: scores.filter(s => s.accuracy < 50).length,
  };

  const passRate = scores.length > 0 
    ? (scores.filter(s => s.accuracy >= 50).length / scores.length) * 100 
    : 0;

  return (
    <Card className="p-6 bg-gradient-to-br from-success/5 via-primary/5 to-accent/5 border-2 border-success/30 animate-fade-in">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-success/20 rounded-full">
            <Trophy className="h-6 w-6 text-success" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Batch Complete!</h3>
            <p className="text-sm text-muted-foreground">
              Successfully processed {completedItems.length} answer sheets
            </p>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-background/80 rounded-lg p-4 text-center border">
            <Users className="h-5 w-5 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold text-foreground">{completedItems.length}</p>
            <p className="text-xs text-muted-foreground">Students</p>
          </div>
          
          <div className="bg-background/80 rounded-lg p-4 text-center border">
            <TrendingUp className="h-5 w-5 mx-auto mb-2 text-accent" />
            <p className="text-2xl font-bold text-foreground">{avgAccuracy.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Avg Accuracy</p>
          </div>
          
          <div className="bg-background/80 rounded-lg p-4 text-center border">
            <Award className="h-5 w-5 mx-auto mb-2 text-success" />
            <p className="text-2xl font-bold text-foreground">{avgScore.toFixed(1)}/{totalQuestions}</p>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </div>
          
          <div className="bg-background/80 rounded-lg p-4 text-center border">
            <CheckCircle className="h-5 w-5 mx-auto mb-2 text-success" />
            <p className="text-2xl font-bold text-foreground">{passRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Pass Rate</p>
          </div>
        </div>

        {/* Top & Bottom Performers */}
        {(highestScore || lowestScore) && (
          <div className="grid md:grid-cols-2 gap-4">
            {highestScore && (
              <div className="flex items-center gap-3 p-4 bg-success/10 rounded-lg border border-success/20">
                <TrendingUp className="h-8 w-8 text-success shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-success font-medium">Highest Score</p>
                  <p className="font-bold text-foreground truncate">
                    {highestScore.rollNumber || highestScore.fileName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {highestScore.score}/{highestScore.total} ({highestScore.accuracy.toFixed(1)}%)
                  </p>
                </div>
              </div>
            )}
            
            {lowestScore && (
              <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                <TrendingDown className="h-8 w-8 text-destructive shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-destructive font-medium">Needs Attention</p>
                  <p className="font-bold text-foreground truncate">
                    {lowestScore.rollNumber || lowestScore.fileName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {lowestScore.score}/{lowestScore.total} ({lowestScore.accuracy.toFixed(1)}%)
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Grade Distribution */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Grade Distribution</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default" className="bg-success/20 text-success border-success/30 gap-1">
              <span className="font-bold">{gradeDistribution.excellent}</span> Excellent (90%+)
            </Badge>
            <Badge variant="default" className="bg-primary/20 text-primary border-primary/30 gap-1">
              <span className="font-bold">{gradeDistribution.good}</span> Good (75-89%)
            </Badge>
            <Badge variant="default" className="bg-accent/20 text-accent-foreground border-accent/30 gap-1">
              <span className="font-bold">{gradeDistribution.average}</span> Average (50-74%)
            </Badge>
            <Badge variant="default" className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
              <span className="font-bold">{gradeDistribution.needsImprovement}</span> Below 50%
            </Badge>
          </div>
        </div>

        {/* Errors Warning */}
        {errorItems.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">
                {errorItems.length} sheet{errorItems.length !== 1 ? 's' : ''} failed to process
              </p>
              <p className="text-xs text-muted-foreground">
                Check the list above for details and try re-uploading
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default BatchSummary;