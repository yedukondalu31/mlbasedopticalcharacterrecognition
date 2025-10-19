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

    console.log("Validating if image is an answer sheet...");
    
    // Step 1: Validate if the image is an answer sheet
    const validationPrompt = `You are an image classification expert. Analyze this image and determine if it is an answer sheet or exam paper.

An answer sheet typically has:
- Grid boxes or bubbles for answers
- Question numbers
- Answer options (A, B, C, D or similar)
- Structured layout for recording answers
- May be handwritten or printed

Respond with ONLY a JSON object in this exact format:
{
  "isAnswerSheet": true/false,
  "reason": "Brief explanation"
}`;

    const validationResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              { type: "text", text: validationPrompt },
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

    if (!validationResponse.ok) {
      const errorText = await validationResponse.text();
      console.error("Validation error:", validationResponse.status, errorText);
      throw new Error("Failed to validate image");
    }

    const validationData = await validationResponse.json();
    const validationResult = validationData.choices[0].message.content;
    console.log("Validation result:", validationResult);

    // Parse validation response
    let isAnswerSheet = false;
    let validationReason = "Could not determine image type";
    
    try {
      const jsonMatch = validationResult.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        isAnswerSheet = parsed.isAnswerSheet;
        validationReason = parsed.reason;
      }
    } catch (parseError) {
      console.error("Failed to parse validation response:", parseError);
    }

    if (!isAnswerSheet) {
      console.log("Image is not an answer sheet:", validationReason);
      return new Response(
        JSON.stringify({ 
          error: "Invalid input: The uploaded image does not appear to be an answer sheet. Please upload a valid answer sheet with grid boxes or bubbles for answers.",
          validationReason
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log("Image validated as answer sheet. Analyzing answers...");
    console.log("Answer key length:", answerKey.length);

    // Step 2: Enhanced prompt for grid-based answer sheet detection
    const prompt = `You are an advanced OCR system specialized in detecting grid-based answer sheets with expert-level pattern recognition.

TASK: Analyze this grid-based answer sheet and extract handwritten answers from each box with maximum precision.

CONTEXT:
- Total questions: ${answerKey.length}
- Layout: Grid pattern with m×n boxes filled by student
- Answer format: Single letters (A, B, C, D) or short text in each grid cell
- Sheet contains a structured grid of answer boxes

GRID DETECTION PROTOCOL:
1. GRID STRUCTURE ANALYSIS:
   - Identify the grid layout and boundaries
   - Detect individual box/cell boundaries
   - Map each box to its corresponding question number
   - Account for any grid rotation, skew, or distortion
   - Identify the reading order (left-to-right, top-to-bottom)

2. BOX-BY-BOX EXTRACTION:
   - Process each grid cell systematically
   - Isolate the content within each box boundary
   - Handle partially filled, crossed-out, or corrected answers
   - Detect checkmarks, bubbles, circled letters, or handwritten text
   - Account for answers that may span slightly outside box boundaries

3. HANDWRITING RECOGNITION:
   - Study each character's stroke patterns and structure
   - Consider context from surrounding characters in adjacent boxes
   - Distinguish between similar letters (O/0, I/l/1, S/5, Z/2, B/8)
   - Account for different handwriting styles (print, cursive, mixed)
   - Recognize common answer patterns in multiple choice grids
   - Handle cases where students write outside the box lines

4. GRID ALIGNMENT & NUMBERING:
   - Verify question numbering matches grid position
   - Detect if grid is numbered sequentially or in a specific pattern
   - Handle missing or skipped boxes
   - Identify any irregularities in the grid structure

5. CONFIDENCE ASSESSMENT:
   For each answer, provide:
   - The extracted answer from the grid cell
   - Confidence level: "high" (90-100%), "medium" (70-89%), "low" (<70%)
   - Detailed notes about the detection (e.g., "clear in box 3,2", "slightly outside boundary")

6. OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "answers": ["A", "B", "C", ...],
  "confidence": ["high", "medium", "low", ...],
  "notes": ["clear in grid cell", "answer extends beyond box", "corrected answer", ...]
}

CRITICAL RULES:
- Array length must be exactly ${answerKey.length}
- Process grid boxes in sequential order matching question numbers
- Use "?" only if a grid box is completely empty or illegible
- Mark uncertain answers with "low" confidence rather than "?"
- Account for grid distortions, shadows, or folds in the paper
- Return ONLY valid JSON, no additional text
- Handle cases where the grid may be partially visible or cropped

GRID-SPECIFIC CHALLENGES TO HANDLE:
- Grid lines that may be faint or unclear
- Boxes that are not perfectly aligned
- Student answers that cross box boundaries
- Multiple marks in a single box (corrections)
- Varying box sizes or irregular grids
- Numbers or annotations outside the answer boxes

Analyze the grid-based answer sheet now with maximum precision and systematic grid detection.`;

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
