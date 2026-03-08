import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Session } from "@supabase/supabase-js";
import ImageUpload from "@/components/ImageUpload";
import AnswerKeyForm from "@/components/AnswerKeyForm";
import BatchProcessor, { BatchProcessingItem } from "@/components/BatchProcessor";
import StepIndicator from "@/components/StepIndicator";
import QuickApplyKey from "@/components/QuickApplyKey";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Layers, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const CONCURRENCY = 6;

const BatchUpload = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [batchImages, setBatchImages] = useState<{ file: File; dataUrl: string }[]>([]);
  const [batchProcessing, setBatchProcessing] = useState<BatchProcessingItem[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [answerKey, setAnswerKey] = useState<string[]>([]);
  const [isAppendMode, setIsAppendMode] = useState(false);
  const [lastGridConfig, setLastGridConfig] = useState<{ rows: number; columns: number } | undefined>();
  const [lastDetectRollNumber, setLastDetectRollNumber] = useState(false);
  const [lastDetectSubjectCode, setLastDetectSubjectCode] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  
  const cancelledRef = useRef(false);
  const tokenRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const expectedCount = location.state?.expectedCount as number | null;

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

  useEffect(() => {
    if (!expectedCount) {
      toast({
        title: "Missing information",
        description: "Please enter the expected number of students first",
        variant: "destructive",
      });
      navigate('/');
    }
  }, [expectedCount, navigate]);

  const currentStep = useMemo(() => {
    const completedCount = batchProcessing.filter(item => item.status === 'completed').length;
    if (completedCount > 0 || isProcessing) return 4;
    if (answerKey.length > 0) return 4;
    if (batchImages.length > 0) return 3;
    return 2;
  }, [batchImages.length, answerKey.length, batchProcessing, isProcessing]);

  const steps = [
    { number: 1, label: "Enter Count" },
    { number: 2, label: "Upload Sheets" },
    { number: 3, label: "Answer Key" },
    { number: 4, label: "Process" },
  ];

  if (!session || !expectedCount) return null;

  const handleBatchUpload = (images: { file: File; dataUrl: string }[], append: boolean = false) => {
    if ((append || batchImages.length > 0) && batchImages.length > 0) {
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
      setBatchImages(images);
      setBatchProcessing(images.map(img => ({
        fileName: img.file.name,
        status: 'pending' as const,
      })));
      toast({
        title: `${images.length} image${images.length !== 1 ? 's' : ''} ready`,
        description: "Upload more or submit the answer key to process",
      });
    }
    setIsAppendMode(true);
  };

  const handleAnswerKeySubmit = (answers: string[], gridConfig?: { rows: number; columns: number }, detectRollNumber?: boolean, detectSubjectCode?: boolean) => {
    setAnswerKey(answers);
    setLastGridConfig(gridConfig);
    setLastDetectRollNumber(detectRollNumber || false);
    setLastDetectSubjectCode(detectSubjectCode || false);
    
    if (batchImages.length > 0) {
      processBatchAnswerSheets(answers, gridConfig, detectRollNumber, detectSubjectCode);
    } else {
      toast({
        title: "Please upload images first",
        variant: "destructive",
      });
    }
  };

  const handleAddMoreSheets = () => {
    setIsAppendMode(true);
    toast({
      title: "Add more sheets",
      description: "Upload additional answer sheets to add to this batch",
    });
  };

  const handleProcessNewSheets = () => {
    if (answerKey.length === 0) {
      toast({ title: "Answer key required", description: "Please submit an answer key first", variant: "destructive" });
      return;
    }
    const firstPendingIndex = batchProcessing.findIndex(item => item.status === 'pending');
    if (firstPendingIndex >= 0) {
      processBatchAnswerSheets(answerKey, lastGridConfig, lastDetectRollNumber, lastDetectSubjectCode, firstPendingIndex);
    }
    setIsAppendMode(false);
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    toast({
      title: "Batch cancelled",
      description: "Processing will stop after the current sheets complete",
    });
  };

  const handleRetryFailed = () => {
    if (answerKey.length === 0) return;
    
    // Reset error items to pending
    setBatchProcessing(prev => prev.map(item => 
      item.status === 'error' ? { ...item, status: 'pending' as const, error: undefined } : item
    ));
    
    // Find first error index and start from there
    const firstErrorIndex = batchProcessing.findIndex(item => item.status === 'error');
    if (firstErrorIndex >= 0) {
      // Small delay to let state update
      setTimeout(() => {
        processBatchAnswerSheets(answerKey, lastGridConfig, lastDetectRollNumber, lastDetectSubjectCode, firstErrorIndex);
      }, 100);
    }
  };

  const handleRetryItem = (index: number) => {
    if (answerKey.length === 0) return;
    
    setBatchProcessing(prev => prev.map((item, idx) => 
      idx === index ? { ...item, status: 'pending' as const, error: undefined } : item
    ));
    
    setTimeout(() => {
      processBatchAnswerSheets(answerKey, lastGridConfig, lastDetectRollNumber, lastDetectSubjectCode, index);
    }, 100);
  };

  const hasPendingSheets = batchProcessing.some(item => item.status === 'pending');

  const tokenRef = useRef<string | null>(null);

  const refreshToken = async () => {
    const { data: { session: freshSession } } = await supabase.auth.getSession();
    tokenRef.current = freshSession?.access_token || session?.access_token || null;
    return tokenRef.current;
  };

  const processOneSheet = async (
    i: number,
    correctAnswers: string[],
    gridConfig?: { rows: number; columns: number },
    detectRollNumber?: boolean,
    detectSubjectCode?: boolean,
  ): Promise<boolean> => {
    if (cancelledRef.current) return false;
    
    setBatchProcessing(prev => prev.map((item, idx) => 
      idx === i ? { ...item, status: 'processing' as const } : item
    ));

    try {
      if (!session) throw new Error("Authentication required");

      const token = tokenRef.current || await refreshToken();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-answer-sheet`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
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
        throw new Error(error.error || `Server error (${response.status})`);
      }

      const result = await response.json();
      
      // Run storage upload + DB insert in parallel
      const storagePromise = (async () => {
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
            .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
          if (!uploadError) {
            const { data: signedUrlData } = await supabase.storage
              .from('answer-sheets')
              .createSignedUrl(fileName, 60 * 60 * 24 * 365);
            return signedUrlData?.signedUrl || fileName;
          }
          return 'storage-upload-failed';
        } catch {
          return 'storage-upload-failed';
        }
      })();

      const imageStorageUrl = await storagePromise;

      // Save to database (fire-and-forget for speed, don't block completion)
      supabase.from('evaluations').insert({
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
      }).then(({ error }) => {
        if (error) console.error('DB insert error:', error);
      });

      setBatchProcessing(prev => prev.map((item, idx) => 
        idx === i ? { 
          ...item, status: 'completed' as const,
          rollNumber: result.rollNumber, subjectCode: result.subjectCode,
          score: result.score, totalQuestions: result.totalQuestions,
          accuracy: result.accuracy,
        } : item
      ));
      return true;
    } catch (error) {
      setBatchProcessing(prev => prev.map((item, idx) => 
        idx === i ? { 
          ...item, status: 'error' as const,
          error: error instanceof Error ? error.message : 'Processing failed'
        } : item
      ));
      return false;
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
    setStartTime(Date.now());
    setCurrentBatchIndex(startFromIndex);
    cancelledRef.current = false;
    
    // Collect indices that need processing
    const pendingIndices: number[] = [];
    let alreadyCompleted = 0;
    for (let i = startFromIndex; i < batchImages.length; i++) {
      if (batchProcessing[i]?.status === 'completed') { alreadyCompleted++; continue; }
      if (batchProcessing[i]?.status === 'error' && i !== startFromIndex) continue;
      pendingIndices.push(i);
    }

    let successCount = alreadyCompleted;

    // Process in parallel chunks
    for (let chunk = 0; chunk < pendingIndices.length; chunk += CONCURRENCY) {
      if (cancelledRef.current) break;
      
      const batch = pendingIndices.slice(chunk, chunk + CONCURRENCY);
      setCurrentBatchIndex(batch[0]);
      
      const results = await Promise.all(
        batch.map(i => processOneSheet(i, correctAnswers, gridConfig, detectRollNumber, detectSubjectCode))
      );
      
      successCount += results.filter(Boolean).length;
    }

    setIsProcessing(false);
    setCurrentBatchIndex(batchImages.length);
    setIsAppendMode(false);
    setStartTime(null);
    
    const cancelled = cancelledRef.current;
    cancelledRef.current = false;
    
    toast({
      title: cancelled ? "Batch processing stopped" : "Batch processing complete!",
      description: `Successfully processed ${successCount} of ${batchImages.length} answer sheets`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">Batch Processing</h1>
              <p className="text-sm text-muted-foreground">
                Processing {expectedCount} student answer sheets
              </p>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2 gap-2">
              <Users className="h-4 w-4" />
              {expectedCount} Students
            </Badge>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Step Indicator */}
        <Card className="p-4">
          <StepIndicator steps={steps} currentStep={currentStep} />
        </Card>

        {/* Progress Card */}
        <Card className="p-6 bg-gradient-to-r from-primary/5 to-primary/10 border-2 border-primary/20">
          <div className="flex items-center justify-center gap-4">
            <div className="p-3 bg-primary/20 rounded-full">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <div className="text-left flex-1">
              <p className="text-lg font-bold text-foreground">
                {batchImages.length} of {expectedCount} sheets uploaded
              </p>
              <p className="text-sm text-muted-foreground">
                {batchImages.length === 0 
                  ? "Upload answer sheets below to get started" 
                  : batchImages.length < expectedCount 
                    ? `${expectedCount - batchImages.length} more sheets to upload`
                    : "All sheets uploaded - configure answer key below"}
              </p>
            </div>
            <Badge 
              variant={batchImages.length >= expectedCount ? "default" : "outline"} 
              className="text-base px-4 py-2"
            >
              {batchImages.length}/{expectedCount}
            </Badge>
          </div>
        </Card>

        {/* Upload Section - hide when processing complete */}
        {(!isProcessing || batchProcessing.filter(i => i.status === 'completed').length === 0) && (
          <ImageUpload 
            onImageUpload={() => {}}
            onBatchUpload={handleBatchUpload}
            currentImage={null}
            isBatchMode={true}
            appendMode={isAppendMode}
            onAppendModeChange={setIsAppendMode}
          />
        )}

        {/* Quick Apply Saved Key */}
        {batchImages.length > 0 && answerKey.length === 0 && !isProcessing && (
          <QuickApplyKey
            onApplyKey={handleAnswerKeySubmit}
            disabled={isProcessing}
            sheetsCount={batchImages.length}
          />
        )}

        {/* Answer Key Form - hide when processing or complete */}
        {batchImages.length > 0 && !isProcessing && batchProcessing.filter(i => i.status === 'completed').length === 0 && (
          <AnswerKeyForm 
            onSubmit={handleAnswerKeySubmit}
            disabled={batchImages.length === 0 || isProcessing}
            isProcessing={isProcessing}
          />
        )}

        {/* Batch Processing Progress */}
        {batchProcessing.length > 0 && (
          <BatchProcessor
            items={batchProcessing}
            currentIndex={currentBatchIndex}
            isProcessing={isProcessing}
            answerKey={answerKey}
            expectedCount={expectedCount}
            onCancel={handleCancel}
            onAddMore={handleAddMoreSheets}
            onProcessNewSheets={handleProcessNewSheets}
            onRetryFailed={handleRetryFailed}
            onRetryItem={handleRetryItem}
            hasPendingSheets={hasPendingSheets}
            startTime={startTime}
          />
        )}
      </main>
    </div>
  );
};

export default BatchUpload;
