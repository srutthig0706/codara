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

async function callAndValidate(provider, prompt, schema) {
  const callProvider = provider === "gemini" ? callGemini : callGroq;
  const label = provider === "gemini" ? "Gemini" : "Groq";
  let rawJson;
  try {
    rawJson = await callProvider(prompt);
  } catch (error) {
    if (provider !== "groq" || !error.message.includes("json_validate_failed")) {
      throw error;
    }
    console.warn(`[LLM] ${label} rejected the generated JSON format. Retrying once with stricter JSON-only instructions...`);
    rawJson = await callProvider(`${prompt}\n\nSTRICT JSON RETRY: Return one complete JSON object only. Use double-quoted keys and string values, no comments, no trailing commas, and no markdown fences.`);
  }
  const parsed = schema.safeParse(rawJson);
  if (parsed.success) return parsed.data;

  console.warn(`[LLM] ${label} schema validation failed. Retrying once with error trace...`);
  const retryPrompt = `${prompt}\n\nIMPORTANT: Your previous response failed validation with errors: ${JSON.stringify(parsed.error.flatten().fieldErrors)}. Output valid JSON conforming strictly to schema.`;
  const retryJson = await callProvider(retryPrompt);
  const retryParsed = schema.safeParse(retryJson);
  if (!retryParsed.success) {
    throw new Error(`${label} schema retry failed: ${JSON.stringify(retryParsed.error.flatten().fieldErrors)}`);
  }
  return retryParsed.data;
}

function measureCitations(outputJson, retrievedChunks) {
  const sources = Array.isArray(outputJson?.citations)
    ? outputJson.citations.map(citation => citation.sourceUrl)
    : [];
  const retrievedUrls = new Set(retrievedChunks.map(chunk => chunk.sourceUrl));
  return {
    producedCount: sources.length,
    resolvedCount: sources.filter(sourceUrl => retrievedUrls.has(sourceUrl)).length,
    sources
  };
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
  retrievedChunks = [],
  useCache = true,
  groundCitations = true,
  provider = null
}) {
  if (provider !== null && !["gemini", "groq"].includes(provider)) {
    throw new Error(`Unsupported pinned LLM provider '${provider}'. Use 'gemini' or 'groq'.`);
  }
  if (provider === "gemini" && !GEMINI_API_KEY) {
    throw new Error("Pinned LLM provider 'gemini' is unavailable: GEMINI_API_KEY is not configured.");
  }
  if (provider === "groq" && !GROQ_API_KEY) {
    throw new Error("Pinned LLM provider 'groq' is unavailable: GROQ_API_KEY is not configured.");
  }

  // 1. Check Cache
  const cacheKey = computeCacheKey({ technology, action, input, promptVersion });
  const cachedData = useCache ? await getCachedAIResponse(cacheKey) : null;
  if (cachedData) {
    return {
      data: cachedData,
      fromCache: true,
      providerUsed: "cache",
      modelUsed: null,
      citationMetrics: measureCitations(cachedData, retrievedChunks),
      cacheKey
    };
  }

  let finalData = null;
  let providerUsed = provider || "gemini";
  if (provider) {
    try {
      finalData = await callAndValidate(provider, prompt, schema);
    } catch (error) {
      throw new Error(`Pinned LLM provider '${provider}' failed: ${error.message}`);
    }
  } else {
    try {
      finalData = await callAndValidate("gemini", prompt, schema);
    } catch (geminiError) {
      console.warn(`[LLM] Gemini failed (${geminiError.message}). Falling back to Groq Cloud...`);
      providerUsed = "groq";
      try {
        finalData = await callAndValidate("groq", prompt, schema);
      } catch (groqError) {
        throw new Error(`All LLM providers failed. Gemini: ${geminiError.message}; Groq: ${groqError.message}`);
      }
    }
  }

  const citationMetrics = measureCitations(finalData, retrievedChunks);
  // 3. Enforce Grounded Citations
  if (groundCitations) {
    finalData = enforceCitations(finalData, retrievedChunks);
  }

  // 4. Save to MongoDB Cache
  const citations = retrievedChunks.map(c => c.sourceUrl);
  if (useCache) {
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
  }

  return {
    data: finalData,
    fromCache: false,
    providerUsed,
    modelUsed: providerUsed === "gemini" ? GEMINI_MODEL : GROQ_MODEL,
    citationMetrics,
    cacheKey
  };
}

module.exports = {
  generateJSON,
  callGemini,
  callGroq,
  enforceCitations
};
