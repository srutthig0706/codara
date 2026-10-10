const path = require("path");
const { pipeline } = require("@xenova/transformers");

let extractor = null;
let memoryChunkStore = [];

/**
 * Initializes the Transformers.js feature extraction pipeline.
 */
async function initPipeline() {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractor;
}

/**
 * Computes a 384-dimensional normalized dense embedding for a given text string.
 */
async function getEmbedding(text) {
  const model = await initPipeline();
  const output = await model(text.trim(), { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/**
 * Computes cosine similarity between two float vectors.
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Loads all documentation chunks from MongoDB into the server's in-memory array once at startup.
 */
async function loadChunksIntoMemory(db) {
  try {
    const chunks = await db.collection("doc_chunks").find({}).toArray();
    memoryChunkStore = chunks;
    console.log(`[RAG] Loaded ${memoryChunkStore.length} document chunks into memory cache.`);
    return memoryChunkStore.length;
  } catch (err) {
    console.error("[RAG] Failed to load chunks into memory:", err.message);
    return 0;
  }
}

/**
 * Retrieves top-k chunks matching the query using in-memory cosine similarity.
 */
async function retrieveRelevantChunks({ query, techSlug = null, topK = 3, minScore = 0.40 }) {
  if (!query || memoryChunkStore.length === 0) {
    return {
      results: [],
      hasVerifiedSources: false,
      message: "No document chunks available in index."
    };
  }

  const queryEmbedding = await getEmbedding(query);

  const candidates = techSlug
    ? memoryChunkStore.filter(c => c.techSlug === techSlug)
    : memoryChunkStore;

  const scored = candidates.map(chunk => {
    const score = cosineSimilarity(queryEmbedding, chunk.embedding);
    return {
      id: chunk._id.toString(),
      techSlug: chunk.techSlug,
      sourceName: chunk.sourceName,
      sourceUrl: chunk.sourceUrl,
      license: chunk.license,
      sectionTitle: chunk.sectionTitle,
      content: chunk.content,
      similarityScore: Number(score.toFixed(4))
    };
  });

  scored.sort((a, b) => b.similarityScore - a.similarityScore);

  const filtered = scored.filter(item => item.similarityScore >= minScore).slice(0, topK);

  if (filtered.length === 0) {
    return {
      results: [],
      hasVerifiedSources: false,
      message: "No verified documentation found for this query above the confidence threshold."
    };
  }

  return {
    results: filtered,
    hasVerifiedSources: true,
    topScore: filtered[0].similarityScore
  };
}

module.exports = {
  initPipeline,
  getEmbedding,
  cosineSimilarity,
  loadChunksIntoMemory,
  retrieveRelevantChunks,
  getMemoryStoreCount: () => memoryChunkStore.length
};
