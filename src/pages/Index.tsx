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
    
    // Simulate OCR processing with realistic delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock OCR extraction - randomly generate answers with ~80% accuracy
    const extractedAnswers = correctAnswers.map(correct => {
      const random = Math.random();
      if (random < 0.8) return correct; // 80% correct
      const options = ['A', 'B', 'C', 'D'];
      return options[Math.floor(Math.random() * options.length)];
    });

    // Calculate results
    let correctCount = 0;
    extractedAnswers.forEach((answer, index) => {
      if (answer === correctAnswers[index]) correctCount++;
    });

    const result: EvaluationResult = {
      extractedAnswers,
      correctAnswers,
      score: correctCount,
      totalQuestions: correctAnswers.length,
      accuracy: (correctCount / correctAnswers.length) * 100,
    };

    setEvaluationResult(result);
    setIsProcessing(false);

    toast({
      title: "Evaluation complete!",
      description: `Score: ${correctCount}/${correctAnswers.length} (${result.accuracy.toFixed(1)}%)`,
    });
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
