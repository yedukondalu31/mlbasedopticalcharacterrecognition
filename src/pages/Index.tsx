import { useState, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Session } from "@supabase/supabase-js";
import Hero from "@/components/Hero";
import ImageUpload from "@/components/ImageUpload";
import AnswerKeyForm from "@/components/AnswerKeyForm";
import PrivacyNotice from "@/components/PrivacyNotice";
import QuickApplyKey from "@/components/QuickApplyKey";
import AuthGuard from "@/components/AuthGuard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, User, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Lazy load heavy components
const ResultsDashboard = lazy(() => import("@/components/ResultsDashboard"));
const ExportSettings = lazy(() => import("@/components/ExportSettings"));

export interface EvaluationResult {
  extractedAnswers: string[];
  correctAnswers: string[];
  rollNumber?: string | null;
  subjectCode?: string | null;
  gridConfig?: { rows: number; columns: number };
  score: number;
  totalQuestions: number;
  accuracy: number;
  confidence?: string;
  imageQuality?: string;
  lowConfidenceCount?: number;
  qualityIssues?: string[];
  detailedResults?: Array<{
    question: number;
    extracted: string;
    correct: string;
    isCorrect: boolean;
    confidence: string;
    note: string;
  }>;
  metadata?: {
    timestamp: string;
    processingNotes: string;
  };
}

const IndexContent = ({ session }: { session: Session }) => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [answerKey, setAnswerKey] = useState<string[]>([]);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [expectedStudentCount, setExpectedStudentCount] = useState<number | null>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleImageUpload = (imageUrl: string) => {
    setUploadedImage(imageUrl);
    setEvaluationResult(null);
    toast({
      title: "Image uploaded successfully",
      description: "Now set your answer key to begin evaluation",
    });
  };

  const handleAnswerKeySubmit = (answers: string[], gridConfig?: { rows: number; columns: number }, detectRollNumber?: boolean, detectSubjectCode?: boolean) => {
    setAnswerKey(answers);
    if (uploadedImage) {
      processAnswerSheet(answers, gridConfig, detectRollNumber, detectSubjectCode);
    } else {
      toast({
        title: "Please upload an image first",
        variant: "destructive",
      });
    }
  };

  const processAnswerSheet = async (correctAnswers: string[], gridConfig?: { rows: number; columns: number }, detectRollNumber?: boolean, detectSubjectCode?: boolean) => {
    setIsProcessing(true);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-answer-sheet`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            image: uploadedImage,
            answerKey: correctAnswers,
            gridConfig,
            detectRollNumber,
            detectSubjectCode,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 400) {
          toast({
            title: "Invalid Image",
            description: error.error || "Please upload a valid answer sheet",
            variant: "destructive",
          });
          setIsProcessing(false);
          return;
        }
        throw new Error(error.error || "Failed to analyze answer sheet");
      }

      const result = await response.json();

      // Show soft-fail warnings for roll number / subject code
      const warnings = [result.rollNumberWarning, result.subjectCodeWarning].filter(Boolean);
      if (warnings.length > 0) {
        toast({
          title: "Detection Warning",
          description: warnings.join(" "),
          variant: "destructive",
        });
      }
      
      const evaluationResult: EvaluationResult = {
        extractedAnswers: result.extractedAnswers,
        correctAnswers: result.correctAnswers,
        rollNumber: result.rollNumber,
        subjectCode: result.subjectCode,
        gridConfig: result.gridConfig,
        score: result.score,
        totalQuestions: result.totalQuestions,
        accuracy: result.accuracy,
        confidence: result.confidence,
        imageQuality: result.imageQuality,
        lowConfidenceCount: result.lowConfidenceCount,
        qualityIssues: result.qualityIssues,
        detailedResults: result.detailedResults,
        metadata: result.metadata,
      };
      
      // Upload image to storage
      let imageStorageUrl = '';
      try {
        const base64Data = uploadedImage!.split(',')[1];
        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        const fileName = `${session.user.id}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('answer-sheets')
          .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

        if (!uploadError) {
          const { data: signedUrlData } = await supabase.storage
            .from('answer-sheets')
            .createSignedUrl(fileName, 60 * 60 * 24 * 365);
          imageStorageUrl = signedUrlData?.signedUrl || fileName;
        } else {
          imageStorageUrl = 'storage-upload-failed';
        }
      } catch {
        imageStorageUrl = 'storage-upload-failed';
      }

      // Save evaluation to database
      const { error: dbError } = await supabase
        .from('evaluations')
        .insert({
          user_id: session.user.id,
          image_url: imageStorageUrl,
          answer_key: correctAnswers,
          extracted_answers: result.extractedAnswers,
          correct_answers: result.correctAnswers,
          roll_number: result.rollNumber,
          subject_code: result.subjectCode,
          grid_rows: gridConfig?.rows,
          grid_columns: gridConfig?.columns,
          score: result.score,
          total_questions: result.totalQuestions,
          accuracy: result.accuracy,
          confidence: result.confidence,
          low_confidence_count: result.lowConfidenceCount,
          detailed_results: result.detailedResults,
        });
      
      if (dbError) {
        toast({
          title: "Warning",
          description: "Evaluation completed but couldn't save to database",
          variant: "destructive",
        });
      }
      
      setEvaluationResult(evaluationResult);
      
      const rollInfo = result.rollNumber ? ` | Roll: ${result.rollNumber}` : "";
      const subjectInfo = result.subjectCode ? ` | Subject: ${result.subjectCode}` : "";
      const confidenceText = result.confidence === "high" ? "High confidence" : 
                            result.confidence === "medium" ? "Medium confidence" : "Low confidence";
      
      toast({
        title: "Evaluation complete!",
        description: `Score: ${result.score}/${result.totalQuestions} (${result.accuracy}%)${rollInfo}${subjectInfo} - ${confidenceText}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process answer sheet",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setUploadedImage(null);
    setAnswerKey([]);
    setEvaluationResult(null);
    setIsProcessing(false);
  };

  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode);
    handleReset();
    setExpectedStudentCount(null);
    toast({
      title: isBatchMode ? "Single mode enabled" : "Batch mode enabled",
      description: isBatchMode 
        ? "Process one answer sheet at a time"
        : "Upload and process multiple answer sheets at once",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Hero session={session} />
      
      <main className="container mx-auto px-4 py-6 md:py-12 space-y-8 md:space-y-12">
        <PrivacyNotice />
        
        {/* Export Settings */}
        <div className="flex justify-end">
          <Suspense fallback={null}>
            <ExportSettings />
          </Suspense>
        </div>
        
        {/* Processing Mode Selector */}
        <Card className="p-6 bg-gradient-to-br from-primary/5 via-primary/3 to-background border-2 border-primary/20">
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
                Choose Processing Mode
              </h2>
              <p className="text-sm text-muted-foreground">
                Select how you want to evaluate answer sheets
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
              {/* Single Mode Card */}
              <button
                onClick={() => !isBatchMode || toggleBatchMode()}
                className={`p-6 rounded-lg border-2 transition-all hover:shadow-lg ${
                  !isBatchMode 
                    ? 'bg-primary/10 border-primary shadow-md' 
                    : 'bg-background/50 border-border hover:border-primary/50'
                }`}
              >
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className={`p-3 rounded-full ${!isBatchMode ? 'bg-primary/20' : 'bg-muted'}`}>
                    <User className={`h-8 w-8 ${!isBatchMode ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-1">Single Mode</h3>
                    <p className="text-sm text-muted-foreground">
                      Process one answer sheet at a time
                    </p>
                  </div>
                  {!isBatchMode && (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Active
                    </Badge>
                  )}
                </div>
              </button>

              {/* Batch Mode Card */}
              <button
                onClick={() => isBatchMode || toggleBatchMode()}
                className={`p-6 rounded-lg border-2 transition-all hover:shadow-lg ${
                  isBatchMode 
                    ? 'bg-primary/10 border-primary shadow-md' 
                    : 'bg-background/50 border-border hover:border-primary/50'
                }`}
              >
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className={`p-3 rounded-full ${isBatchMode ? 'bg-primary/20' : 'bg-muted'}`}>
                    <Users className={`h-8 w-8 ${isBatchMode ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-1">Batch Mode</h3>
                    <p className="text-sm text-muted-foreground">
                      Process entire class of answer sheets
                    </p>
                  </div>
                  {isBatchMode && (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Active
                    </Badge>
                  )}
                </div>
              </button>
            </div>

            {/* Expected Student Count Input - Only show in batch mode */}
            {isBatchMode && (
              <div className="max-w-sm mx-auto mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="expectedCount" className="text-sm font-medium text-foreground">
                    Number of Students to Evaluate
                  </Label>
                  <Input
                    id="expectedCount"
                    type="number"
                    min="1"
                    max="500"
                    placeholder="Enter expected number of students"
                    value={expectedStudentCount || ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseInt(e.target.value) : null;
                      setExpectedStudentCount(value);
                    }}
                    className="text-center text-lg"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    This helps track your progress during batch processing
                  </p>
                </div>
                
                {expectedStudentCount && expectedStudentCount > 0 && (
                  <Button 
                    onClick={() => navigate('/batch', { state: { expectedCount: expectedStudentCount } })}
                    className="w-full gap-2"
                    size="lg"
                  >
                    <Users className="h-5 w-5" />
                    Start Batch Processing ({expectedStudentCount} students)
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        {!isBatchMode && (
          <>
            <div ref={uploadSectionRef}>
              <ImageUpload 
                onImageUpload={handleImageUpload}
                currentImage={uploadedImage}
                isBatchMode={false}
              />
            </div>

            {/* Quick Apply Saved Key */}
            {uploadedImage && answerKey.length === 0 && !isProcessing && (
              <QuickApplyKey
                onApplyKey={handleAnswerKeySubmit}
                disabled={isProcessing}
                sheetsCount={1}
              />
            )}
            
            <AnswerKeyForm 
              onSubmit={handleAnswerKeySubmit}
              disabled={!uploadedImage || isProcessing}
              isProcessing={isProcessing}
            />
            
            {evaluationResult && (
              <Suspense fallback={<div className="animate-pulse h-64 bg-muted rounded-lg" />}>
                <ResultsDashboard 
                  result={evaluationResult}
                  uploadedImage={uploadedImage}
                  onReset={handleReset}
                />
              </Suspense>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const Index = () => (
  <AuthGuard>
    {(session) => <IndexContent session={session} />}
  </AuthGuard>
);

export default Index;
