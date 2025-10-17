import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, answerKey } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Analyzing answer sheet with AI...");
    console.log("Answer key length:", answerKey.length);

    // Enhanced prompt for superior OCR accuracy
    const prompt = `You are an advanced OCR system with expert-level handwriting recognition capabilities, trained on thousands of answer sheets.

TASK: Analyze this answer sheet image and extract handwritten answers with maximum precision.

CONTEXT:
- Total questions: ${answerKey.length}
- Answer format: Single letters (A, B, C, D) or short text
- Sheet may contain handwritten text, checkboxes, bubbles, or circled answers

ANALYSIS INSTRUCTIONS:
1. IMAGE PREPROCESSING:
   - Examine the entire image carefully for all question numbers
   - Look for patterns: numbered lists, bubble grids, answer boxes
   - Identify any rotation, skew, or lighting issues
   - Note any crossed-out or corrected answers

2. HANDWRITING RECOGNITION:
   - Study each character's stroke patterns and structure
   - Consider context from surrounding characters
   - Distinguish between similar letters (O/0, I/l/1, S/5, Z/2, B/8)
   - Account for different handwriting styles (print, cursive, mixed)
   - Recognize common answer patterns in multiple choice tests

3. CONFIDENCE ASSESSMENT:
   For each answer, provide:
   - The extracted answer
   - Confidence level: "high" (90-100%), "medium" (70-89%), "low" (<70%)
   - Any ambiguity notes

4. OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "answers": ["A", "B", "C", ...],
  "confidence": ["high", "medium", "low", ...],
  "notes": ["clear", "slight blur", "corrected answer", ...]
}

CRITICAL RULES:
- Array length must be exactly ${answerKey.length}
- Use "?" only if the answer area is blank or completely illegible
- Mark uncertain answers with "low" confidence, not "?"
- Process answers in sequential order (1, 2, 3, ...)
- Return ONLY valid JSON, no additional text

Analyze the image now with maximum precision.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro", // Upgraded to Pro for superior vision accuracy
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: image,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log("AI Response:", aiResponse);

    // Extract structured JSON from the response
    let extractedAnswers: string[] = [];
    let confidenceLevels: string[] = [];
    let analysisNotes: string[] = [];
    
    try {
      // Try to find JSON object in the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        extractedAnswers = parsed.answers || [];
        confidenceLevels = parsed.confidence || [];
        analysisNotes = parsed.notes || [];
        
        console.log("Parsed response:", { extractedAnswers, confidenceLevels, analysisNotes });
      } else {
        throw new Error("No JSON object found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Raw AI response:", aiResponse);
      
      // Fallback: try to extract just the answers array
      try {
        const arrayMatch = aiResponse.match(/\[[\s\S]*?\]/);
        if (arrayMatch) {
          extractedAnswers = JSON.parse(arrayMatch[0]);
          confidenceLevels = Array(extractedAnswers.length).fill("unknown");
          analysisNotes = Array(extractedAnswers.length).fill("fallback parsing");
        } else {
          throw new Error("Could not parse response");
        }
      } catch {
        // Final fallback: create array of question marks
        extractedAnswers = Array(answerKey.length).fill("?");
        confidenceLevels = Array(answerKey.length).fill("low");
        analysisNotes = Array(answerKey.length).fill("parsing failed");
      }
    }

    // Ensure extracted answers match the expected length
    if (extractedAnswers.length !== answerKey.length) {
      console.warn(`Expected ${answerKey.length} answers but got ${extractedAnswers.length}`);
      // Pad or trim to match
      while (extractedAnswers.length < answerKey.length) {
        extractedAnswers.push("?");
      }
      extractedAnswers = extractedAnswers.slice(0, answerKey.length);
    }

    // Calculate score with detailed analysis
    let correctCount = 0;
    let lowConfidenceCount = 0;
    const detailedResults: Array<{
      question: number;
      extracted: string;
      correct: string;
      isCorrect: boolean;
      confidence: string;
      note: string;
    }> = [];
    
    extractedAnswers.forEach((extracted, index) => {
      const correct = answerKey[index];
      const isCorrect = extracted.toLowerCase() === correct.toLowerCase();
      const confidence = confidenceLevels[index] || "unknown";
      const note = analysisNotes[index] || "";
      
      if (isCorrect) correctCount++;
      if (confidence === "low") lowConfidenceCount++;
      
      detailedResults.push({
        question: index + 1,
        extracted,
        correct,
        isCorrect,
        confidence,
        note,
      });
    });

    const totalQuestions = answerKey.length;
    const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    const avgConfidence = lowConfidenceCount === 0 ? "high" : 
                         lowConfidenceCount < totalQuestions / 2 ? "medium" : "low";

    console.log(`Evaluation complete: ${correctCount}/${totalQuestions} correct, avg confidence: ${avgConfidence}`);

    return new Response(
      JSON.stringify({
        extractedAnswers,
        correctAnswers: answerKey,
        score: correctCount,
        totalQuestions: totalQuestions,
        accuracy: Math.round(accuracy * 10) / 10,
        confidence: avgConfidence,
        lowConfidenceCount,
        detailedResults,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in analyze-answer-sheet:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
