import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limiting
const requestLog = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_MINUTE = 30; // Increased for parallel batch

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

    const combinedPrompt = `You are a precision OCR engine specialized in handwritten grid-based OMR answer sheets.

STRICT INSTRUCTIONS:
1. First confirm this is an answer sheet with a grid of answer boxes/bubbles.
2. The sheet has EXACTLY ${answerKey.length} questions. ${gridConfig ? `Arranged in a ${gridConfig.rows}×${gridConfig.columns} grid (${gridConfig.rows} rows, ${gridConfig.columns} columns). Read LEFT-TO-RIGHT, TOP-TO-BOTTOM. Question 1 starts at top-left.` : "Numbered sequentially."}
3. Each cell contains a SINGLE handwritten letter: A, B, C, D, or E. Use "?" ONLY for truly empty/blank cells.
4. For crossed-out or corrected answers, use the FINAL intended answer (the one NOT crossed out).
5. Pay careful attention to distinguish similar letters: A vs D, B vs D, C vs G.
${rollNumberSection}${subjectCodeSection}

OUTPUT FORMAT (strict JSON, no markdown):
{
  "isAnswerSheet": true,
  "quality": "good"|"fair"|"poor",
  "qualityIssues": [],
  "answers": [${answerKey.map((_, i) => `"Q${i+1}"`).slice(0, 3).join(", ")}, ...],
  "confidence": ["high"|"medium"|"low", ...]${detectRollNumber ? ',\n  "rollNumber": "string or null"' : ""}${detectSubjectCode ? ',\n  "subjectCode": "string or null"' : ""}
}

CRITICAL RULES:
- "answers" array MUST have EXACTLY ${answerKey.length} elements.
- Each answer MUST be a single uppercase letter (A-E) or "?".
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
      // Fallback: try array extraction
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
            isAnswerSheet: true,
            quality: "unknown",
            answers: Array(answerKey.length).fill("?"),
            confidence: Array(answerKey.length).fill("low"),
            notes: Array(answerKey.length).fill("parsing failed"),
          };
        }
      } catch {
        parsed = {
          isAnswerSheet: true,
          quality: "unknown",
          answers: Array(answerKey.length).fill("?"),
          confidence: Array(answerKey.length).fill("low"),
          notes: Array(answerKey.length).fill("parsing failed"),
        };
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

    // If roll number detection was required but not found
    if (detectRollNumber && !rollNumber) {
      return new Response(
        JSON.stringify({ 
          error: "Roll number could not be detected. Please ensure it is clearly filled.",
          validationReason: "Roll number not found"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
