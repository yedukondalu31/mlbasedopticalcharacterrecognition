import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Session } from "@supabase/supabase-js";
import Hero from "@/components/Hero";
import ImageUpload from "@/components/ImageUpload";
import AnswerKeyForm from "@/components/AnswerKeyForm";
import ResultsDashboard from "@/components/ResultsDashboard";
import PrivacyNotice from "@/components/PrivacyNotice";
import BatchProcessor, { BatchProcessingItem } from "@/components/BatchProcessor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, User, Layers, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [answerKey, setAnswerKey] = useState<string[]>([]);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchImages, setBatchImages] = useState<{ file: File; dataUrl: string }[]>([]);
  const [batchProcessing, setBatchProcessing] = useState<BatchProcessingItem[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) navigate('/auth');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) navigate('/auth');
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (!session) return null;

  const handleImageUpload = (imageUrl: string) => {
    setUploadedImage(imageUrl);
    setEvaluationResult(null);
    setBatchImages([]);
    setBatchProcessing([]);
    toast({
      title: "Image uploaded successfully",
      description: "Now set your answer key to begin evaluation",
    });
  };

  const handleBatchUpload = (images: { file: File; dataUrl: string }[]) => {
    setBatchImages(images);
    setUploadedImage(null);
    setEvaluationResult(null);
    setBatchProcessing(images.map(img => ({
      fileName: img.file.name,
      status: 'pending' as const,
    })));
  };

  const handleAnswerKeySubmit = (answers: string[], gridConfig?: { rows: number; columns: number }, detectRollNumber?: boolean, detectSubjectCode?: boolean) => {
    setAnswerKey(answers);
    
    if (batchImages.length > 0) {
      processBatchAnswerSheets(answers, gridConfig, detectRollNumber, detectSubjectCode);
    } else if (uploadedImage) {
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
      if (!session) {
        throw new Error("Authentication required");
      }

      // Call the AI edge function to analyze the answer sheet
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
        
        // Special handling for validation errors (400)
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
      
      const evaluationResult: EvaluationResult = {
        extractedAnswers: result.extractedAnswers,
        correctAnswers: result.correctAnswers,
        rollNumber: result.rollNumber,
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
      
      // Save evaluation to database
      const { error: dbError } = await supabase
        .from('evaluations')
        .insert({
          user_id: session.user.id,
          image_url: uploadedImage!,
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
        console.error("Error saving to database:", dbError);
        toast({
          title: "Warning",
          description: "Evaluation completed but couldn't save to database",
          variant: "destructive",
        });
      }
      
      setEvaluationResult(evaluationResult);
      
      const rollInfo = result.rollNumber ? ` | Roll: ${result.rollNumber}` : "";
      const confidenceText = result.confidence === "high" ? "High confidence" : 
                            result.confidence === "medium" ? "Medium confidence" : "Low confidence";
      
      toast({
        title: "Evaluation complete!",
        description: `Score: ${result.score}/${result.totalQuestions} (${result.accuracy}%)${rollInfo} - ${confidenceText}`,
      });
    } catch (error) {
      console.error("Error processing answer sheet:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process answer sheet",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processBatchAnswerSheets = async (
    correctAnswers: string[], 
    gridConfig?: { rows: number; columns: number }, 
    detectRollNumber?: boolean, 
    detectSubjectCode?: boolean
  ) => {
    setIsProcessing(true);
    setCurrentBatchIndex(0);

    for (let i = 0; i < batchImages.length; i++) {
      setCurrentBatchIndex(i);
      
      // Update status to processing
      setBatchProcessing(prev => prev.map((item, idx) => 
        idx === i ? { ...item, status: 'processing' as const } : item
      ));

      try {
        if (!session) {
          throw new Error("Authentication required");
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-answer-sheet`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              image: batchImages[i].dataUrl,
              answerKey: correctAnswers,
              gridConfig,
              detectRollNumber,
              detectSubjectCode,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to analyze answer sheet");
        }

        const result = await response.json();
        
        // Save to database
        const { error: dbError } = await supabase
          .from('evaluations')
          .insert({
            user_id: session.user.id,
            image_url: batchImages[i].dataUrl,
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
          console.error("Error saving to database:", dbError);
        }

        // Update status to completed
        setBatchProcessing(prev => prev.map((item, idx) => 
          idx === i ? { 
            ...item, 
            status: 'completed' as const,
            rollNumber: result.rollNumber,
            subjectCode: result.subjectCode,
            score: result.score,
            totalQuestions: result.totalQuestions,
            accuracy: result.accuracy,
          } : item
        ));

      } catch (error) {
        console.error(`Error processing ${batchImages[i].file.name}:`, error);
        
        // Update status to error
        setBatchProcessing(prev => prev.map((item, idx) => 
          idx === i ? { 
            ...item, 
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Processing failed'
          } : item
        ));
      }
    }

    setIsProcessing(false);
    setCurrentBatchIndex(batchImages.length);
    
    const successCount = batchProcessing.filter(item => item.status === 'completed').length;
    toast({
      title: "Batch processing complete!",
      description: `Successfully processed ${successCount} of ${batchImages.length} answer sheets`,
    });
  };

  const handleReset = () => {
    setUploadedImage(null);
    setAnswerKey([]);
    setEvaluationResult(null);
    setIsProcessing(false);
    setBatchImages([]);
    setBatchProcessing([]);
    setCurrentBatchIndex(0);
  };

  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode);
    handleReset();
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
          </div>
        </Card>

        <ImageUpload 
          onImageUpload={handleImageUpload}
          onBatchUpload={handleBatchUpload}
          currentImage={uploadedImage}
          isBatchMode={isBatchMode}
        />
        
        {/* Batch Preview */}
        {batchImages.length > 0 && (
          <Card className="p-6 bg-gradient-to-r from-green-500/10 to-blue-500/10 border-2 border-primary/30">
            <div className="flex items-center justify-center gap-4">
              <div className="p-3 bg-primary/20 rounded-full">
                <Layers className="h-6 w-6 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-lg font-bold text-foreground">
                  {batchImages.length} answer sheet{batchImages.length !== 1 ? 's' : ''} uploaded
                </p>
                <p className="text-sm text-muted-foreground">
                  Ready for batch processing - configure answer key below
                </p>
              </div>
              <Badge variant="secondary" className="ml-auto text-base px-4 py-2">
                {batchImages.length}
              </Badge>
            </div>
          </Card>
        )}

        <AnswerKeyForm 
          onSubmit={handleAnswerKeySubmit}
          disabled={(!uploadedImage && batchImages.length === 0) || isProcessing}
          isProcessing={isProcessing}
        />

        {/* Batch Processing Progress */}
        {batchProcessing.length > 0 && (
          <BatchProcessor
            items={batchProcessing}
            currentIndex={currentBatchIndex}
            isProcessing={isProcessing}
            answerKey={answerKey}
          />
        )}
        
        {evaluationResult && (
          <ResultsDashboard 
            result={evaluationResult}
            uploadedImage={uploadedImage}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
