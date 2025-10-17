import { useState } from "react";
import Hero from "@/components/Hero";
import ImageUpload from "@/components/ImageUpload";
import AnswerKeyForm from "@/components/AnswerKeyForm";
import ResultsDashboard from "@/components/ResultsDashboard";
import { toast } from "@/hooks/use-toast";

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
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [answerKey, setAnswerKey] = useState<string[]>([]);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
      // Call the AI edge function to analyze the answer sheet
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-answer-sheet`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image: uploadedImage,
            answerKey: correctAnswers,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
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
      <Hero />
      
      <main className="container mx-auto px-4 py-12 space-y-12">
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
