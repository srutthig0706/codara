const path = require("path");
require(path.resolve(__dirname, "../server/node_modules/dotenv")).config({ path: path.resolve(__dirname, "../server/.env") });
const { MongoClient } = require(path.resolve(__dirname, "../server/node_modules/mongodb"));
const { loadChunksIntoMemory, retrieveRelevantChunks } = require("../server/services/rag.service");

const uri = process.env.MONGO_URI || "mongodb://localhost:27017/codara";

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  console.log("=== Codara Local RAG Retrieval Verification ===");
  await loadChunksIntoMemory(db);

  const testQueries = [
    {
      query: "How does Redis expire keys using TTL and LRU policies?",
      expectedTech: "redis"
    },
    {
      query: "Why do we get IndentationError in Python control flow?",
      expectedTech: "python"
    },
    {
      query: "What is the libuv event loop and non-blocking I/O in Node.js?",
      expectedTech: "javascript"
    },
    {
      query: "How does Python pass mutable arguments to functions?",
      expectedTech: "python"
    },
    {
      query: "Interstellar warp drive propulsion and quantum wormholes",
      expectedTech: null // Out of domain
    }
  ];

  for (const item of testQueries) {
    console.log(`\nQuery: "${item.query}"`);
    const t0 = performance.now();
    const result = await retrieveRelevantChunks({ query: item.query, minScore: 0.40 });
    const elapsedMs = (performance.now() - t0).toFixed(2);

    console.log(`Execution Latency: ${elapsedMs} ms`);
    if (result.hasVerifiedSources) {
      console.log(`Verified Sources Found (${result.results.length}):`);
      result.results.forEach((r, idx) => {
        console.log(`  [${idx + 1}] [${r.techSlug}] "${r.sectionTitle}" - Score: ${r.similarityScore} (Source: ${r.sourceUrl})`);
      });
      if (item.expectedTech) {
        const topMatch = result.results[0];
        console.log(`Top match matches expected technology (${item.expectedTech}): ${topMatch.techSlug === item.expectedTech ? 'PASS' : 'FAIL'}`);
      }
    } else {
      console.log(`No verified sources (as expected for out-of-domain): ${result.message}`);
    }
  }

  await client.close();
}

main();
