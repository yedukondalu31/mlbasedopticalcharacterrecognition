import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Session } from "@supabase/supabase-js";
import Hero from "@/components/Hero";
import ImageUpload from "@/components/ImageUpload";
import AnswerKeyForm from "@/components/AnswerKeyForm";
import ResultsDashboard from "@/components/ResultsDashboard";
import PrivacyNotice from "@/components/PrivacyNotice";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface EvaluationResult {
  extractedAnswers: string[];
  correctAnswers: string[];
  score: number;
  totalQuestions: number;
  accuracy: number;
  confidence?: string;
  lowConfidenceCount?: number;
  detailedResults?: Array<{
    question: number;
    extracted: string;
    correct: string;
    isCorrect: boolean;
    confidence: string;
    note: string;
  }>;
}

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [answerKey, setAnswerKey] = useState<string[]>([]);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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
    toast({
      title: "Image uploaded successfully",
      description: "Now set your answer key to begin evaluation",
    });
  };

  const handleAnswerKeySubmit = (answers: string[]) => {
    setAnswerKey(answers);
    if (uploadedImage) {
      processAnswerSheet(answers);
    } else {
      toast({
        title: "Please upload an image first",
        variant: "destructive",
      });
    }
  };

  const processAnswerSheet = async (correctAnswers: string[]) => {
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
        score: result.score,
        totalQuestions: result.totalQuestions,
        accuracy: result.accuracy,
        confidence: result.confidence,
        lowConfidenceCount: result.lowConfidenceCount,
        detailedResults: result.detailedResults,
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
      
      const confidenceText = result.confidence === "high" ? "High confidence" : 
                            result.confidence === "medium" ? "Medium confidence" : "Low confidence";
      
      toast({
        title: "Evaluation complete!",
        description: `Score: ${result.score}/${result.totalQuestions} (${result.accuracy}%) - ${confidenceText}`,
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

  const handleReset = () => {
    setUploadedImage(null);
    setAnswerKey([]);
    setEvaluationResult(null);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Hero session={session} />
      
      <main className="container mx-auto px-4 py-6 md:py-12 space-y-8 md:space-y-12">
        <PrivacyNotice />
        <ImageUpload 
          onImageUpload={handleImageUpload} 
          currentImage={uploadedImage}
        />
        
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
      </main>
    </div>
  );
};

export default Index;
