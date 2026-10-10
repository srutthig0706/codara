const test = require("node:test");
const assert = require("node:assert");
const { connectDB, closeDB } = require("../config/db");
const { 
  getEmbedding, 
  cosineSimilarity, 
  loadChunksIntoMemory, 
  retrieveRelevantChunks,
  getMemoryStoreCount 
} = require("../services/rag.service");

test("Phase 4: Local RAG Pipeline (Transformers.js, in-memory cosine similarity, citation grounding)", async (t) => {
  const db = await connectDB();

  try {
    // 1. Verify embedding dimension
    const vec = await getEmbedding("Test embedding generation for Python syntax");
    assert.ok(Array.isArray(vec), "Embedding must be an array");
    assert.strictEqual(vec.length, 384, "Embedding must be exactly 384 dimensions");

    // 2. Verify cosine similarity mathematical behavior
    const simSelf = cosineSimilarity(vec, vec);
    assert.ok(Math.abs(simSelf - 1.0) < 0.001, "Self-similarity must equal 1.0");

    const zeroVec = new Array(384).fill(0);
    assert.strictEqual(cosineSimilarity(vec, zeroVec), 0, "Similarity with zero vector must be 0");

    // 3. Load chunks into memory cache
    const count = await loadChunksIntoMemory(db);
    assert.ok(count >= 15, "Must load at least 15 seeded chunks into memory store");
    assert.strictEqual(getMemoryStoreCount(), count);

    // 4. Retrieve with high relevance for Redis TTL
    const redisResult = await retrieveRelevantChunks({
      query: "How does Redis expire keys using TTL?",
      techSlug: "redis",
      topK: 3,
      minScore: 0.40
    });
    assert.strictEqual(redisResult.hasVerifiedSources, true);
    assert.ok(redisResult.results.length >= 1);
    assert.strictEqual(redisResult.results[0].techSlug, "redis");
    assert.strictEqual(redisResult.results[0].sourceUrl, "https://redis.io/docs/latest/");
    assert.ok(redisResult.results[0].similarityScore >= 0.70);

    // 5. Out-of-domain query should yield no verified sources
    const outOfDomainResult = await retrieveRelevantChunks({
      query: "Ancient mesozoic dinosaur fossilization and amber preservation",
      minScore: 0.40
    });
    assert.strictEqual(outOfDomainResult.hasVerifiedSources, false);
    assert.strictEqual(outOfDomainResult.results.length, 0);
  } finally {
    await closeDB();
  }
});
