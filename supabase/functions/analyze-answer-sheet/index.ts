import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limiting
const requestLog = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_MINUTE = 60; // Higher limit for parallel batch processing

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

async function callAI(apiKey: string, model: string, prompt: string, imageUrl: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const userIdentifier = authHeader?.replace('Bearer ', '').substring(0, 32) || 'anonymous';
    
    const rateLimitResult = checkRateLimit(userIdentifier);
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ 
          error: `Rate limit exceeded. Please wait ${rateLimitResult.resetIn} seconds.`,
          retryAfter: rateLimitResult.resetIn
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rateLimitResult.resetIn) } 
        }
      );
    }

    const { image, answerKey, gridConfig, detectRollNumber, detectSubjectCode } = await req.json();
    
    if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
      return new Response(
        JSON.stringify({ error: "Invalid input: Image must be a valid base64 data URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!answerKey || !Array.isArray(answerKey) || answerKey.length === 0 || answerKey.length > 200) {
      return new Response(
        JSON.stringify({ error: "Invalid input: Answer key must be a non-empty array (max 200)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageSizeInMB = (image.length * 0.75) / (1024 * 1024);
    if (imageSizeInMB > 15) {
      return new Response(
        JSON.stringify({ error: "Image too large (max 15MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // ===== SINGLE COMBINED CALL: Validation + Answer Extraction + Roll Number + Subject Code =====
    const gridInfo = gridConfig 
      ? `Grid Layout: ${gridConfig.rows} rows × ${gridConfig.columns} columns`
      : "Sequential layout";

    const rollNumberSection = detectRollNumber ? `
ROLL NUMBER EXTRACTION:
- Located on the RIGHT side, typically 10 boxes with one character each (A-Z, a-z, 0-9)
- Labels: "Roll No", "Student ID", "ID Number"
- Must be EXACTLY 10 characters, use uppercase, "?" for illegible
` : "";

    const subjectCodeSection = detectSubjectCode ? `
SUBJECT CODE EXTRACTION:
- Found in header, margins, or near answer grid
- Labels: "Subject Code", "Paper Code", "Course Code", etc.
- Can be any length (2-20 chars), alphanumeric, may include dashes/dots
- DO NOT confuse with roll number
` : "";

    const combinedPrompt = `You are an expert OCR engine for handwritten OMR/grid-based answer sheets. You MUST extract answers even from EXTREMELY dim, dark, faded, or poorly-lit images taken in near-darkness or minimal ambient light.

CRITICAL LOW-LIGHT HANDLING:
- You are trained to read answer sheets photographed in VERY LOW LIGHT conditions (e.g., a single lamp, phone flashlight, twilight, or near-dark rooms).
- Mentally MAXIMIZE contrast and brightness before reading. Treat any slight variation in pixel shade as a potential pencil mark.
- In dim images, pencil marks appear as VERY SUBTLE gray-on-gray differences. These are VALID answers — extract them.
- Even if the image looks almost entirely dark or washed out, there ARE answers written. Try harder.
- Shadows, uneven lighting, and glare are expected. Read through them.
- If you can see even the OUTLINE or GRID of the answer sheet, the answers are there — look for any tonal variation within cells.
- For overexposed/bright areas, look for subtle indentations or shadow edges of pencil strokes.
- NEVER give up on a cell. A "?" should ONLY be returned if the cell area is completely destroyed/torn/missing.

IMAGE QUALITY ADAPTATION:
- VERY DIM/DARK: Increase sensitivity to maximum. Any gray variation = pencil mark. Squint harder.
- DIM/LOW CONTRAST: Look for relative darkness within cells compared to cell background.
- FADED/WASHED OUT: Focus on edges and outlines of handwritten characters.
- UNEVEN LIGHTING: Compare marks within the same row/column for consistency.
- BLURRY: Use character shape heuristics (curves vs straight lines) to distinguish letters.

SHEET STRUCTURE:
1. This is an answer sheet with EXACTLY ${answerKey.length} questions.
2. ${gridConfig ? `Grid layout: ${gridConfig.rows} rows × ${gridConfig.columns} columns. Read LEFT-TO-RIGHT across each row, then move to the next row. Q1 is at top-left, Q${gridConfig.columns} is at top-right, Q${gridConfig.columns + 1} starts the second row.` : "Questions are numbered sequentially."}

ANSWER EXTRACTION RULES:
- Each cell contains a SINGLE handwritten letter: A, B, C, D, or E.
- NEVER use "?" unless the physical cell is destroyed or completely missing from the image.
- For faint/barely-visible marks: ALWAYS extract a best-guess answer. Even 30% visibility is enough.
- For crossed-out or corrected answers: use the FINAL intended answer.
- Commonly confused letters:
  • A vs D (A has pointed top, D has curved top)
  • B vs D (B has bumps on right, D is smooth curve)
  • C vs G (G has a horizontal bar)
  • B vs 8 or 3 (B is a letter context)
- If a cell has a bubble/circle filled in, read which option (A-E) is marked.
${rollNumberSection}${subjectCodeSection}

OUTPUT FORMAT (strict JSON, no markdown):
{
  "isAnswerSheet": true,
  "quality": "good"|"fair"|"poor"|"very_poor",
  "qualityIssues": ["description of any issues"],
  "brightnessLevel": "normal"|"dim"|"very_dim"|"near_dark"|"bright",
  "lightingCondition": "good"|"uneven"|"low"|"minimal"|"near_dark",
  "answers": ["A", "B", ...],
  "confidence": ["high"|"medium"|"low", ...]${detectRollNumber ? ',\n  "rollNumber": "string or null"' : ""}${detectSubjectCode ? ',\n  "subjectCode": "string or null"' : ""}
}

CRITICAL RULES:
- "answers" array MUST have EXACTLY ${answerKey.length} elements.
- Each answer MUST be a single uppercase letter (A-E) or "?" (ONLY for destroyed/missing cells).
- You MUST attempt a best-guess for EVERY cell, even in terrible lighting.
- Return ONLY the JSON object, nothing else.`;

    const aiResponse = await callAI(LOVABLE_API_KEY, "google/gemini-2.5-flash", combinedPrompt, image);

    // Parse the combined response
    let parsed: any = {};
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch (parseError) {
      try {
        const arrayMatch = aiResponse.match(/\[[\s\S]*?\]/);
        if (arrayMatch) {
          parsed = {
            isAnswerSheet: true,
            quality: "unknown",
            answers: JSON.parse(arrayMatch[0]),
            confidence: [],
            notes: [],
          };
        } else {
          parsed = {
            isAnswerSheet: true, quality: "unknown",
            answers: Array(answerKey.length).fill("?"),
            confidence: Array(answerKey.length).fill("low"),
            notes: Array(answerKey.length).fill("parsing failed"),
          };
        }
      } catch {
        parsed = {
          isAnswerSheet: true, quality: "unknown",
          answers: Array(answerKey.length).fill("?"),
          confidence: Array(answerKey.length).fill("low"),
          notes: Array(answerKey.length).fill("parsing failed"),
        };
      }
    }

    // === VERIFICATION PASS for dim/poor quality or high uncertainty ===
    const isDimOrPoor = parsed.brightnessLevel === "dim" || parsed.brightnessLevel === "very_dim" || parsed.brightnessLevel === "near_dark" || parsed.quality === "poor" || parsed.quality === "very_poor" || parsed.lightingCondition === "minimal" || parsed.lightingCondition === "near_dark";
    const lowConfAnswers = (parsed.confidence || []).filter((c: string) => c === "low" || c === "medium");
    const questionMarkCount = (parsed.answers || []).filter((a: string) => a === "?").length;
    const uncertaintyRatio = parsed.answers ? lowConfAnswers.length / parsed.answers.length : 0;
    const questionMarkRatio = parsed.answers ? questionMarkCount / parsed.answers.length : 0;
    
    // Trigger verification more aggressively for dim images
    if (isDimOrPoor || uncertaintyRatio > 0.2 || questionMarkRatio > 0.1) {
      const verifyPrompt = `You are a SPECIALIST in reading answer sheets photographed in EXTREMELY LOW LIGHT or MINIMAL LIGHTING conditions. Your job is to verify and correct a previous OCR pass that struggled with this dim image.

Previous extraction: ${JSON.stringify(parsed.answers || [])}
Previous quality: ${parsed.quality}, brightness: ${parsed.brightnessLevel || "unknown"}, lighting: ${parsed.lightingCondition || "unknown"}
Number of "?" (unread) cells: ${questionMarkCount} out of ${answerKey.length}

THIS IMAGE WAS TAKEN IN LOW LIGHT. You MUST:
1. Mentally boost contrast to MAXIMUM — imagine cranking brightness +200% and contrast +300%
2. Every cell has an answer written in it. Students fill ALL cells. A "?" means the previous pass failed, not that the cell is blank.
3. Look for the SLIGHTEST tonal variation within each cell boundary — even 5% darker = a pencil mark
4. For cells marked "?" by previous pass: look EXTRA hard. Zoom into that cell mentally. The answer IS there.
5. Use context clues: if surrounding answers are clear, the grid structure helps locate exact cell boundaries
6. Common in dim photos: pencil marks appear as very subtle gray smudges — these ARE valid letters

Grid: ${gridConfig ? `${gridConfig.rows}×${gridConfig.columns}` : "sequential"}, EXACTLY ${answerKey.length} questions.

Return JSON only:
{
  "answers": ["A", "B", ...],
  "confidence": ["high"|"medium"|"low", ...],
  "corrections": [{"q": 1, "from": "?", "to": "B", "reason": "faint pencil mark visible as B shape"}]
}

EXACTLY ${answerKey.length} answers. Every answer MUST be A-E. Do NOT return "?" — always give your best guess.`;

      try {
        const verifyResponse = await callAI(LOVABLE_API_KEY, "google/gemini-2.5-flash", verifyPrompt, image);
        const verifyMatch = verifyResponse.match(/\{[\s\S]*\}/);
        if (verifyMatch) {
          const verified = JSON.parse(verifyMatch[0]);
          if (verified.answers && Array.isArray(verified.answers) && verified.answers.length === answerKey.length) {
            parsed.answers = parsed.answers.map((orig: string, i: number) => {
              const origConf = (parsed.confidence || [])[i] || "unknown";
              const verifiedAnswer = verified.answers[i];
              // Use verified answer if original was uncertain, "?", or medium confidence
              if (orig === "?" && verifiedAnswer !== "?") return verifiedAnswer;
              if ((origConf === "low" || origConf === "medium") && verifiedAnswer !== "?") return verifiedAnswer;
              return orig;
            });
            // Update confidence from verification
            if (verified.confidence) {
              parsed.confidence = verified.confidence;
            }
            parsed.verificationApplied = true;
            parsed.corrections = verified.corrections || [];
          }
        }
      } catch (verifyError) {
        console.error("Verification pass failed, using original results:", verifyError);
      }
    }

    // Validation check
    if (parsed.isAnswerSheet === false) {
      return new Response(
        JSON.stringify({ 
          error: "The uploaded image does not appear to be an answer sheet.",
          validationReason: "Not an answer sheet"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rollNumber = detectRollNumber ? (parsed.rollNumber || null) : null;
    const subjectCode = detectSubjectCode ? (parsed.subjectCode || null) : null;
    const imageQuality = parsed.quality || "unknown";
    const qualityIssues = parsed.qualityIssues || [];

    // If roll number detection was required but not found — soft-fail with warning
    const rollNumberWarning = (detectRollNumber && !rollNumber) 
      ? "Roll number could not be detected from the answer sheet." 
      : null;

    // Process extracted answers
    let extractedAnswers: string[] = parsed.answers || [];
    const confidenceLevels: string[] = parsed.confidence || [];
    const analysisNotes: string[] = parsed.notes || [];

    // Ensure correct length
    while (extractedAnswers.length < answerKey.length) {
      extractedAnswers.push("?");
    }
    extractedAnswers = extractedAnswers.slice(0, answerKey.length);

    // Calculate score
    let correctCount = 0;
    let lowConfidenceCount = 0;
    let unattemptedCount = 0;
    const detailedResults: Array<{
      question: number; extracted: string; correct: string;
      isCorrect: boolean; confidence: string; note: string; status: string;
    }> = [];
    
    extractedAnswers.forEach((extracted, index) => {
      const correct = answerKey[index];
      const isUnattempted = !extracted || extracted === "?" || extracted.trim() === "";
      const isCorrect = !isUnattempted && extracted.toLowerCase() === correct.toLowerCase();
      const confidence = confidenceLevels[index] || "unknown";
      const note = analysisNotes[index] || "";
      
      let status = "wrong";
      if (isUnattempted) { status = "unattempted"; unattemptedCount++; }
      else if (isCorrect) { status = "correct"; correctCount++; }
      if (confidence === "low") lowConfidenceCount++;
      
      detailedResults.push({
        question: index + 1, extracted: isUnattempted ? "UNATTEMPTED" : extracted,
        correct, isCorrect, confidence, note, status,
      });
    });

    const totalQuestions = answerKey.length;
    const attemptedQuestions = totalQuestions - unattemptedCount;
    const accuracy = attemptedQuestions > 0 ? (correctCount / attemptedQuestions) * 100 : 0;
    const avgConfidence = lowConfidenceCount === 0 ? "high" : 
                         lowConfidenceCount < totalQuestions / 2 ? "medium" : "low";

    return new Response(
      JSON.stringify({
        extractedAnswers, correctAnswers: answerKey,
        rollNumber, subjectCode, gridConfig,
        score: correctCount, totalQuestions, attemptedQuestions, unattemptedCount,
        accuracy: Math.round(accuracy * 10) / 10,
        confidence: avgConfidence, imageQuality, lowConfidenceCount, qualityIssues,
        detailedResults,
        rollNumberWarning,
        metadata: {
          timestamp: new Date().toISOString(),
          processingNotes: qualityIssues.length > 0 
            ? "Quality issues detected. Results may need verification."
            : unattemptedCount > 0
            ? `${unattemptedCount} question(s) unattempted.`
            : "Processing completed successfully."
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : "Unknown error");
    
    if (error instanceof Error && error.message.includes("429")) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
