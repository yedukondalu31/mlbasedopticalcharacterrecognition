import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limiting (resets on edge function restart)
const requestLog = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 15; // Allow reasonable batch processing

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const userRequests = requestLog.get(identifier) || [];
  const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW_MS);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
    const oldestRequest = Math.min(...recentRequests);
    const resetIn = Math.ceil((oldestRequest + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, remaining: 0, resetIn };
  }
  
  recentRequests.push(now);
  requestLog.set(identifier, recentRequests);
  return { allowed: true, remaining: MAX_REQUESTS_PER_MINUTE - recentRequests.length, resetIn: 0 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract user identifier for rate limiting
    const authHeader = req.headers.get('Authorization');
    const userIdentifier = authHeader?.replace('Bearer ', '').substring(0, 32) || 'anonymous';
    
    // Check rate limit
    const rateLimitResult = checkRateLimit(userIdentifier);
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ 
          error: `Rate limit exceeded. Please wait ${rateLimitResult.resetIn} seconds before trying again.`,
          retryAfter: rateLimitResult.resetIn
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(rateLimitResult.resetIn)
          } 
        }
      );
    }

    const { image, answerKey, gridConfig, detectRollNumber, detectSubjectCode } = await req.json();
    
    // Input validation
    if (!image || typeof image !== 'string') {
      return new Response(
        JSON.stringify({ error: "Invalid input: Image is required and must be a base64 string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!answerKey || !Array.isArray(answerKey) || answerKey.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid input: Answer key is required and must be a non-empty array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (answerKey.length > 200) {
      return new Response(
        JSON.stringify({ error: "Invalid input: Answer key cannot exceed 200 questions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate image is a valid base64 data URL
    if (!image.startsWith('data:image/')) {
      return new Response(
        JSON.stringify({ error: "Invalid input: Image must be a valid data URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check image size (base64 string length as proxy)
    const imageSizeInMB = (image.length * 0.75) / (1024 * 1024); // Approximate size
    if (imageSizeInMB > 15) {
      return new Response(
        JSON.stringify({ error: "Invalid input: Image size too large (max 15MB after encoding)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Step 1: Validate if the image is an answer sheet with quality assessment
    const validationPrompt = `You are an image classification and quality assessment expert. Analyze this image and provide:
1. Is it an answer sheet?
2. What is the image quality?

An answer sheet typically has:
- Grid boxes or bubbles for answers
- Question numbers
- Answer options (A, B, C, D or similar)
- Structured layout for recording answers
- May be handwritten or printed
- Educational/exam context

NOT answer sheets:
- Random photos of people, landscapes, objects
- Screenshots, memes, or social media posts
- Documents without answer grids
- Blank papers or non-educational content

Image quality assessment:
- GOOD: Clear, well-lit, sharp, proper orientation, minimal blur
- FAIR: Readable but has minor issues (slight blur, shadows, or tilt)
- POOR: Very blurry, dark, heavily skewed, or hard to read

Respond with ONLY a JSON object in this exact format:
{
  "isAnswerSheet": true/false,
  "quality": "good" | "fair" | "poor",
  "qualityIssues": ["issue1", "issue2"],
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
      console.error("Validation API error:", validationResponse.status);
      throw new Error("Failed to validate image");
    }

    const validationData = await validationResponse.json();
    const validationResult = validationData.choices[0].message.content;

    // Parse validation response
    let isAnswerSheet = false;
    let imageQuality = "unknown";
    let qualityIssues: string[] = [];
    let validationReason = "Could not determine image type";
    
    try {
      const jsonMatch = validationResult.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        isAnswerSheet = parsed.isAnswerSheet;
        imageQuality = parsed.quality || "unknown";
        qualityIssues = parsed.qualityIssues || [];
        validationReason = parsed.reason;
      }
    } catch (parseError) {
      console.error("Failed to parse validation response");
    }

    if (!isAnswerSheet) {
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

    // Step 2: Extract roll number if requested
    let rollNumber = null;
    if (detectRollNumber) {
      const rollNumberPrompt = `You are an OCR expert specialized in reading alphanumeric codes from structured forms.

TASK: Extract the roll number from this answer sheet.

ROLL NUMBER CHARACTERISTICS:
- Located on the RIGHT side of the answer sheet
- Consists of 10 boxes arranged horizontally or vertically
- Each box contains ONE character (uppercase letter, lowercase letter, or digit)
- Characters can be: A-Z, a-z, 0-9
- May be handwritten or printed
- Boxes are labeled or positioned in a dedicated "Roll Number" section

EXTRACTION PROTOCOL:
1. Locate the roll number region (usually has label like "Roll No", "Student ID", "ID Number")
2. Identify all 10 boxes in sequence (left-to-right or top-to-bottom)
3. Read each character carefully, distinguishing between:
   - O (letter) vs 0 (zero)
   - I (uppercase i) vs l (lowercase L) vs 1 (one)
   - S vs 5, Z vs 2, B vs 8
4. Handle corrections, erasures, or overwritten characters
5. If a box is empty or illegible, use "?" for that position

OUTPUT FORMAT:
Return ONLY a JSON object:
{
  "rollNumber": "ABC1234567",
  "confidence": "high" | "medium" | "low",
  "note": "brief explanation of any issues"
}

CRITICAL RULES:
- Roll number must be EXACTLY 10 characters
- Use uppercase for letters
- Use "?" only for truly illegible characters
- If roll number region not found or completely illegible, return null

Extract the roll number now with maximum precision.`;

      try {
        const rollResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                  { type: "text", text: rollNumberPrompt },
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

        if (rollResponse.ok) {
          const rollData = await rollResponse.json();
          const rollResult = rollData.choices[0].message.content;
          
          try {
            const jsonMatch = rollResult.match(/\{[\s\S]*?\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              rollNumber = parsed.rollNumber || null;
            }
          } catch (parseError) {
            // Silently handle parse errors
          }
        }
      } catch (rollError) {
        // Continue without roll number
      }
    }
    
    // Step 3: Extract subject code if requested
    let subjectCode = null;
    if (detectSubjectCode) {
      const subjectCodePrompt = `You are an OCR expert specialized in reading alphanumeric codes from structured forms and answer sheets.

TASK: Extract the subject code/paper code from this answer sheet.

WHERE TO LOOK (check ALL these areas):
1. TOP section - header area near the roll number
2. SIDE margins - left or right side of the paper
3. Near OMR bubbles - sometimes printed alongside the answer grid
4. Footer area - bottom of the sheet
5. Any labeled field containing a code

COMMON LABELS TO SEARCH FOR:
- "Subject Code", "Sub Code", "Subject", "Subj"
- "Paper Code", "Paper No", "Paper ID"
- "Course Code", "Course No", "Course"
- "Exam Code", "Test Code"
- "Code", "ID", "No."
- Any field with boxes containing alphanumeric characters

SUBJECT CODE FORMATS (examples):
- Pure numbers: "101", "2024", "12345"
- Letters + numbers: "CS101", "PHY201", "MATH301"
- With dashes/dots: "CS-101", "PHY.201"
- Mixed format: "2024CS101", "A2B3C4"
- Short codes: "A1", "12"
- Long codes: "SUBCODE2024A1"

EXTRACTION PROTOCOL:
1. Scan the ENTIRE document for any labeled code field
2. Look for boxes, bubbles, or handwritten text near code labels
3. Read each character carefully:
   - O (letter) vs 0 (zero) - context helps: "CS0" likely means CS + zero
   - I (uppercase i) vs 1 (one) vs l (lowercase L)
   - S vs 5, Z vs 2, B vs 8, G vs 6
4. Include ALL characters you see (don't truncate)
5. If handwritten, focus on the filled/marked characters

OUTPUT FORMAT:
Return ONLY a JSON object:
{
  "subjectCode": "extracted_code_here",
  "confidence": "high" | "medium" | "low",
  "location": "where you found it (e.g., 'top header', 'left margin')",
  "note": "any issues or observations"
}

CRITICAL RULES:
- Subject code can be ANY length (2-20 characters)
- Return the COMPLETE code exactly as written
- Use uppercase for letters
- Use "?" only for truly illegible characters
- If NO subject code field exists on this answer sheet, return: {"subjectCode": null, "confidence": "high", "note": "No subject code field found on this answer sheet"}
- DO NOT confuse roll number with subject code - they are different fields

Extract the subject code now by carefully examining the ENTIRE answer sheet.`;

      try {
        const subjectResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                  { type: "text", text: subjectCodePrompt },
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

        if (subjectResponse.ok) {
          const subjectData = await subjectResponse.json();
          const subjectResult = subjectData.choices[0].message.content;
          
          try {
            const jsonMatch = subjectResult.match(/\{[\s\S]*?\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              subjectCode = parsed.subjectCode || null;
            }
          } catch (parseError) {
            // Silently handle parse errors
          }
        }
      } catch (subjectError) {
        // Continue without subject code
      }
    }
    
    // Check for required credentials only if detection was enabled
    if (detectRollNumber && !rollNumber) {
      return new Response(
        JSON.stringify({ 
          error: "Roll number could not be detected from the answer sheet. Please ensure the roll number is clearly filled in all 10 boxes.",
          validationReason: "Roll number detection enabled but not found"
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // Note: Subject code is optional - don't error if not found, just continue with null
    // This allows processing to continue even if no subject code exists on the answer sheet

    // Step 4: Enhanced prompt for grid-based answer sheet detection
    const gridInfo = gridConfig 
      ? `Grid Layout: ${gridConfig.rows} rows × ${gridConfig.columns} columns`
      : "Sequential layout";
    
    const prompt = `You are an advanced OCR system specialized in detecting grid-based answer sheets with expert-level pattern recognition.

TASK: Analyze this grid-based answer sheet and extract handwritten answers from each box with maximum precision.

CONTEXT:
- Total questions: ${answerKey.length}
- Layout: ${gridInfo}
- Answer format: Single letters (A, B, C, D, E) or short text in each grid cell
- Sheet contains a structured grid of answer boxes
${gridConfig ? `- Grid is ${gridConfig.rows}×${gridConfig.columns}, process row-by-row from left to right` : ""}

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
- Use "?" or empty string "" for unattempted questions (empty or completely blank boxes)
- Mark uncertain answers with "low" confidence
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
      console.error("AI gateway error:", response.status);
      
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
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

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
      } else {
        throw new Error("No JSON object found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response");
      
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
      // Pad or trim to match
      while (extractedAnswers.length < answerKey.length) {
        extractedAnswers.push("?");
      }
      extractedAnswers = extractedAnswers.slice(0, answerKey.length);
    }

    // Calculate score with detailed analysis
    let correctCount = 0;
    let lowConfidenceCount = 0;
    let unattemptedCount = 0;
    const detailedResults: Array<{
      question: number;
      extracted: string;
      correct: string;
      isCorrect: boolean;
      confidence: string;
      note: string;
      status: string;
    }> = [];
    
    extractedAnswers.forEach((extracted, index) => {
      const correct = answerKey[index];
      const isUnattempted = !extracted || extracted === "?" || extracted.trim() === "";
      const isCorrect = !isUnattempted && extracted.toLowerCase() === correct.toLowerCase();
      const confidence = confidenceLevels[index] || "unknown";
      const note = analysisNotes[index] || "";
      
      let status = "wrong";
      if (isUnattempted) {
        status = "unattempted";
        unattemptedCount++;
      } else if (isCorrect) {
        status = "correct";
        correctCount++;
      }
      
      if (confidence === "low") lowConfidenceCount++;
      
      detailedResults.push({
        question: index + 1,
        extracted: isUnattempted ? "UNATTEMPTED" : extracted,
        correct,
        isCorrect,
        confidence,
        note,
        status,
      });
    });

    const totalQuestions = answerKey.length;
    const attemptedQuestions = totalQuestions - unattemptedCount;
    const accuracy = attemptedQuestions > 0 ? (correctCount / attemptedQuestions) * 100 : 0;
    const avgConfidence = lowConfidenceCount === 0 ? "high" : 
                         lowConfidenceCount < totalQuestions / 2 ? "medium" : "low";

    return new Response(
      JSON.stringify({
        extractedAnswers,
        correctAnswers: answerKey,
        rollNumber,
        subjectCode,
        gridConfig,
        score: correctCount,
        totalQuestions: totalQuestions,
        attemptedQuestions,
        unattemptedCount,
        accuracy: Math.round(accuracy * 10) / 10,
        confidence: avgConfidence,
        imageQuality,
        lowConfidenceCount,
        qualityIssues,
        detailedResults,
        metadata: {
          timestamp: new Date().toISOString(),
          processingNotes: qualityIssues.length > 0 
            ? "Some quality issues detected. Results may need verification."
            : unattemptedCount > 0
            ? `Processing completed. ${unattemptedCount} question(s) were unattempted.`
            : "Processing completed successfully."
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in analyze-answer-sheet:", error instanceof Error ? error.message : "Unknown error");
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
