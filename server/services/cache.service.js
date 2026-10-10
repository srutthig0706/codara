const crypto = require("crypto");
const { getDB } = require("../config/db");

/**
 * Computes AI cache key:
 * SHA-256 of: technology + action + normalized input (trimmed, lowercased) + promptVersion
 */
function computeCacheKey({ technology, action, input, promptVersion = "v1" }) {
  const normTech = String(technology || "").trim().toLowerCase();
  const normAction = String(action || "").trim().toLowerCase();
  const normInput = String(input || "").trim().toLowerCase();
  const normVersion = String(promptVersion || "v1").trim().toLowerCase();

  const rawKey = `${normTech}:${normAction}:${normInput}:${normVersion}`;
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Retrieves cached AI response from MongoDB if available.
 */
async function getCachedAIResponse(cacheKey) {
  try {
    const db = getDB();
    const cached = await db.collection("ai_cache").findOne({ hash: cacheKey });
    return cached ? cached.responseJson : null;
  } catch (err) {
    console.error("[CACHE] Cache lookup error:", err.message);
    return null;
  }
}

/**
 * Saves AI response to MongoDB ai_cache collection.
 */
async function setCachedAIResponse({
  cacheKey,
  technology,
  action,
  input,
  promptVersion = "v1",
  responseJson,
  providerUsed,
  retrievalCitations = []
}) {
  try {
    const db = getDB();
    await db.collection("ai_cache").updateOne(
      { hash: cacheKey },
      {
        $set: {
          hash: cacheKey,
          technology,
          action,
          input,
          promptVersion,
          responseJson,
          providerUsed,
          retrievalCitations,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("[CACHE] Cache save error:", err.message);
  }
}

module.exports = {
  computeCacheKey,
  getCachedAIResponse,
  setCachedAIResponse
};
