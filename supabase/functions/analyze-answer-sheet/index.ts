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

    // Create a detailed prompt for the AI to extract handwritten answers
    const prompt = `You are an expert OCR system specialized in reading handwritten answers from answer sheets.

Analyze this answer sheet image and extract ALL handwritten answers you can see. The sheet has ${answerKey.length} questions.

IMPORTANT INSTRUCTIONS:
- Look for numbered questions (1, 2, 3, etc.) or answer bubbles/boxes
- Each answer could be a letter (A, B, C, D), a word, or a short phrase
- Return ONLY a JSON array with exactly ${answerKey.length} answers in order
- If you cannot clearly read an answer, use "?" as a placeholder
- Be as accurate as possible with handwriting recognition
- Extract answers in sequential order (question 1, 2, 3, etc.)

Expected format (for ${answerKey.length} questions):
["A", "B", "C", "D", ...]

Return ONLY the JSON array, nothing else. Extract all ${answerKey.length} visible answers from the image now.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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

    // Extract JSON array from the response
    let extractedAnswers: string[] = [];
    try {
      // Try to find JSON array in the response
      const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        extractedAnswers = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON array found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Fallback: create array of question marks
      extractedAnswers = Array(answerKey.length).fill("?");
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

    // Calculate score
    let correctCount = 0;
    extractedAnswers.forEach((extracted, index) => {
      const correct = answerKey[index];
      if (extracted.toLowerCase() === correct.toLowerCase()) {
        correctCount++;
      }
    });

    const totalQuestions = answerKey.length;
    const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    return new Response(
      JSON.stringify({
        extractedAnswers,
        correctAnswers: answerKey,
        score: correctCount,
        totalQuestions: totalQuestions,
        accuracy: Math.round(accuracy * 10) / 10,
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
