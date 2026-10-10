const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { computeCacheKey, getCachedAIResponse, setCachedAIResponse } = require("./cache.service");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const GEMINI_MODEL = "gemini-3.8-flash";
const GROQ_MODEL = "openai/gpt-oss-20b";

/**
 * Invokes Google Gemini API with JSON mode.
 */
async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      })
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini API HTTP ${res.status}: ${errBody}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Gemini returned empty candidate content");
    return JSON.parse(rawText);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Invokes Groq Cloud API with JSON mode as fallback.
 */
async function callGroq(prompt) {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content: "You are an expert technical educator for Codara. Return raw JSON strictly matching the requested schema."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      })
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Groq API HTTP ${res.status}: ${errBody}`);
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) throw new Error("Groq returned empty choice content");
    return JSON.parse(rawText);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Filters output citations so they strictly match verified URLs from retrievedChunks.
 */
function enforceCitations(outputJson, retrievedChunks) {
  if (!outputJson || !outputJson.citations) return outputJson;

  const validUrls = new Set(retrievedChunks.map(c => c.sourceUrl));
  // Keep only citations that were actually retrieved
  outputJson.citations = outputJson.citations.filter(cit => validUrls.has(cit.sourceUrl));

  // If output has no citations but retrievedChunks exist, supply retrieved chunks
  if (outputJson.citations.length === 0 && retrievedChunks.length > 0) {
    outputJson.citations = retrievedChunks.slice(0, 2).map(c => ({
      sourceName: c.sourceName,
      sourceUrl: c.sourceUrl,
      relevance: c.sectionTitle
    }));
  }

  return outputJson;
}

/**
 * Unified server-side AI wrapper:
 * 1. Checks MongoDB ai_cache via SHA-256 key.
 * 2. Attempts Gemini API (primary).
 * 3. Validates with Zod schema. If invalid, retries ONCE with error trace.
 * 4. Falls back to Groq Cloud on error, rate limit (429), or 2nd validation error.
 * 5. Enforces citation grounding against retrievedChunks.
 * 6. Stores in MongoDB ai_cache.
 */
async function generateJSON({
  prompt,
  schema,
  technology,
  action,
  input,
  promptVersion = "v1",
  retrievedChunks = []
}) {
  // 1. Check Cache
  const cacheKey = computeCacheKey({ technology, action, input, promptVersion });
  const cachedData = await getCachedAIResponse(cacheKey);
  if (cachedData) {
    return {
      data: cachedData,
      fromCache: true,
      providerUsed: "cache",
      cacheKey
    };
  }

  let finalData = null;
  let providerUsed = "gemini";

  // 2. Try Gemini
  try {
    let rawJson = await callGemini(prompt);
    let parsed = schema.safeParse(rawJson);

    if (!parsed.success) {
      console.warn("[LLM] Gemini schema validation failed. Retrying once with error trace...");
      const retryPrompt = `${prompt}\n\nIMPORTANT: Your previous response failed validation with errors: ${JSON.stringify(parsed.error.flatten().fieldErrors)}. Output valid JSON conforming strictly to schema.`;
      const retryJson = await callGemini(retryPrompt);
      const retryParsed = schema.safeParse(retryJson);
      if (!retryParsed.success) {
        throw new Error(`Gemini schema retry failed: ${JSON.stringify(retryParsed.error.flatten().fieldErrors)}`);
      }
      finalData = retryParsed.data;
    } else {
      finalData = parsed.data;
    }
  } catch (geminiError) {
    console.warn(`[LLM] Gemini failed (${geminiError.message}). Falling back to Groq Cloud...`);
    providerUsed = "groq";

    try {
      let rawJson = await callGroq(prompt);
      let parsed = schema.safeParse(rawJson);

      if (!parsed.success) {
        console.warn("[LLM] Groq schema validation failed. Retrying once with error trace...");
        const retryPrompt = `${prompt}\n\nIMPORTANT: Your previous response failed validation with errors: ${JSON.stringify(parsed.error.flatten().fieldErrors)}. Output valid JSON conforming strictly to schema.`;
        const retryJson = await callGroq(retryPrompt);
        const retryParsed = schema.safeParse(retryJson);
        if (!retryParsed.success) {
          throw new Error(`Groq schema retry failed: ${JSON.stringify(retryParsed.error.flatten().fieldErrors)}`);
        }
        finalData = retryParsed.data;
      } else {
        finalData = parsed.data;
      }
    } catch (groqError) {
      throw new Error(`All LLM providers failed. Gemini: ${geminiError.message}; Groq: ${groqError.message}`);
    }
  }

  // 3. Enforce Grounded Citations
  finalData = enforceCitations(finalData, retrievedChunks);

  // 4. Save to MongoDB Cache
  const citations = retrievedChunks.map(c => c.sourceUrl);
  await setCachedAIResponse({
    cacheKey,
    technology,
    action,
    input,
    promptVersion,
    responseJson: finalData,
    providerUsed,
    retrievalCitations: citations
  });

  return {
    data: finalData,
    fromCache: false,
    providerUsed,
    cacheKey
  };
}

module.exports = {
  generateJSON,
  callGemini,
  callGroq,
  enforceCitations
};
