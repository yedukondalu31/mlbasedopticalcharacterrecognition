import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Session } from "@supabase/supabase-js";
import Hero from "@/components/Hero";
import ImageUpload from "@/components/ImageUpload";
import AnswerKeyForm from "@/components/AnswerKeyForm";
import ResultsDashboard from "@/components/ResultsDashboard";
import PrivacyNotice from "@/components/PrivacyNotice";
import BatchProcessor, { BatchProcessingItem } from "@/components/BatchProcessor";
import ExportSettings from "@/components/ExportSettings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [expectedStudentCount, setExpectedStudentCount] = useState<number | null>(null);
  const [isAppendMode, setIsAppendMode] = useState(false);
  const [lastGridConfig, setLastGridConfig] = useState<{ rows: number; columns: number } | undefined>();
  const [lastDetectRollNumber, setLastDetectRollNumber] = useState<boolean>(false);
  const [lastDetectSubjectCode, setLastDetectSubjectCode] = useState<boolean>(false);
  const uploadSectionRef = useRef<HTMLDivElement>(null);
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

  const handleBatchUpload = (images: { file: File; dataUrl: string }[], append: boolean = false) => {
    if (append && batchImages.length > 0) {
      // Append to existing batch
      setBatchImages(prev => [...prev, ...images]);
      setBatchProcessing(prev => [
        ...prev,
        ...images.map(img => ({
          fileName: img.file.name,
          status: 'pending' as const,
        }))
      ]);
      toast({
        title: `Added ${images.length} more sheet${images.length !== 1 ? 's' : ''}`,
        description: `Total: ${batchImages.length + images.length} answer sheets in this batch`,
      });
    } else {
      // Start fresh batch
      setBatchImages(images);
      setUploadedImage(null);
      setEvaluationResult(null);
      setBatchProcessing(images.map(img => ({
        fileName: img.file.name,
        status: 'pending' as const,
      })));
    }
  };

  const handleAnswerKeySubmit = (answers: string[], gridConfig?: { rows: number; columns: number }, detectRollNumber?: boolean, detectSubjectCode?: boolean) => {
    setAnswerKey(answers);
    // Save config for later use when adding more sheets
    setLastGridConfig(gridConfig);
    setLastDetectRollNumber(detectRollNumber || false);
    setLastDetectSubjectCode(detectSubjectCode || false);
    
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

  // Handler for adding more sheets to the batch
  const handleAddMoreSheets = () => {
    setIsAppendMode(true);
    toast({
      title: "Add more sheets",
      description: "Upload additional answer sheets to add to this batch",
    });
  };

  // Handler for processing newly added pending sheets
  const handleProcessNewSheets = () => {
    if (answerKey.length === 0) {
      toast({
        title: "Answer key required",
        description: "Please submit an answer key first",
        variant: "destructive",
      });
      return;
    }
    
    // Find the first pending sheet index
    const firstPendingIndex = batchProcessing.findIndex(item => item.status === 'pending');
    if (firstPendingIndex >= 0) {
      processBatchAnswerSheets(answerKey, lastGridConfig, lastDetectRollNumber, lastDetectSubjectCode, firstPendingIndex);
    }
    setIsAppendMode(false);
  };

  // Check if there are pending sheets
  const hasPendingSheets = batchProcessing.some(item => item.status === 'pending');

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
      
      // Upload image to storage bucket instead of storing base64 in database
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
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        // Get signed URL for private bucket
        const { data: signedUrlData } = await supabase.storage
          .from('answer-sheets')
          .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year expiry
        
        imageStorageUrl = signedUrlData?.signedUrl || fileName;
      } catch (storageError) {
        // Fallback: store a placeholder if storage fails
        imageStorageUrl = 'storage-upload-failed';
      }

      // Save evaluation to database with storage URL
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
      const confidenceText = result.confidence === "high" ? "High confidence" : 
                            result.confidence === "medium" ? "Medium confidence" : "Low confidence";
      
      toast({
        title: "Evaluation complete!",
        description: `Score: ${result.score}/${result.totalQuestions} (${result.accuracy}%)${rollInfo} - ${confidenceText}`,
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

  const processBatchAnswerSheets = async (
    correctAnswers: string[], 
    gridConfig?: { rows: number; columns: number }, 
    detectRollNumber?: boolean, 
    detectSubjectCode?: boolean,
    startFromIndex: number = 0
  ) => {
    setIsProcessing(true);
    setCurrentBatchIndex(startFromIndex);
    
    let successCount = 0;
    let processedInThisRun = 0;
    
    // Process only pending items starting from startFromIndex
    for (let i = startFromIndex; i < batchImages.length; i++) {
      // Skip already completed or errored items
      if (batchProcessing[i]?.status === 'completed' || batchProcessing[i]?.status === 'error') {
        if (batchProcessing[i]?.status === 'completed') successCount++;
        continue;
      }
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
        
        // Upload image to storage bucket
        let imageStorageUrl = '';
        try {
          const base64Data = batchImages[i].dataUrl.split(',')[1];
          const binaryData = atob(base64Data);
          const bytes = new Uint8Array(binaryData.length);
          for (let j = 0; j < binaryData.length; j++) {
            bytes[j] = binaryData.charCodeAt(j);
          }
          const blob = new Blob([bytes], { type: 'image/jpeg' });
          
          const fileName = `${session.user.id}/${Date.now()}-${i}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('answer-sheets')
            .upload(fileName, blob, {
              contentType: 'image/jpeg',
              upsert: false,
            });

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

        // Save to database with storage URL
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
        
        successCount++;
        processedInThisRun++;

      } catch (error) {
        // Error processing batch item
        
        // Update status to error
        setBatchProcessing(prev => prev.map((item, idx) => 
          idx === i ? { 
            ...item, 
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Processing failed'
          } : item
        ));
        processedInThisRun++;
      }
    }

    setIsProcessing(false);
    setCurrentBatchIndex(batchImages.length);
    setIsAppendMode(false);
    
    toast({
      title: "Batch processing complete!",
      description: `Successfully processed ${successCount} of ${batchImages.length} answer sheets${processedInThisRun < batchImages.length ? ` (${processedInThisRun} new)` : ''}`,
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
    setExpectedStudentCount(null);
    setIsAppendMode(false);
    setLastGridConfig(undefined);
    setLastDetectRollNumber(false);
    setLastDetectSubjectCode(false);
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
        
        {/* Export Settings */}
        <div className="flex justify-end">
          <ExportSettings />
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
                
                {/* Confirmation Button */}
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
                onBatchUpload={handleBatchUpload}
                currentImage={uploadedImage}
                isBatchMode={isBatchMode}
                appendMode={isAppendMode}
                onAppendModeChange={setIsAppendMode}
              />
            </div>
            
            <AnswerKeyForm 
              onSubmit={handleAnswerKeySubmit}
              disabled={!uploadedImage || isProcessing}
              isProcessing={isProcessing}
            />
            
            {evaluationResult && (
              <ResultsDashboard 
                result={evaluationResult}
                uploadedImage={uploadedImage}
                onReset={handleReset}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
