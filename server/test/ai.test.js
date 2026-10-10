const test = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");
const { app } = require("../server");
const { connectDB, getDB, closeDB } = require("../config/db");
const { loadChunksIntoMemory } = require("../services/rag.service");
const { 
  ExplainResponseSchema, 
  ScenarioResponseSchema, 
  validateScenarioGraph 
} = require("../schemas/ai.schema");
const { computeCacheKey } = require("../services/cache.service");

test("Phase 5: Core logic (Zod schemas, scenario graph validation, cache key)", (t) => {
  // 1. Test cache key computation
  const key1 = computeCacheKey({
    technology: "Python",
    action: "Explain",
    input: "  Memory model and bytecode   ",
    promptVersion: "v1.0"
  });
  const key2 = computeCacheKey({
    technology: "python",
    action: "explain",
    input: "memory model and bytecode",
    promptVersion: "v1.0"
  });
  assert.strictEqual(key1, key2, "Cache key must normalize casing and whitespace");
  assert.strictEqual(key1.length, 64, "Cache key must be a 64-char SHA-256 hex string");

  // 2. Test valid scenario graph validation
  const validScenario = {
    scenarioTitle: "Redis Caching Layer",
    contextDescription: "Handling high read throughput",
    withoutTech: {
      narrative: "Database bottlenecks under direct reads",
      problemPoints: ["Disk I/O saturation"],
      nodes: [
        { id: "client", label: "Client Web App", type: "client", isProblemNode: false, details: "" },
        { id: "db", label: "SQL Database", type: "database", isProblemNode: true, details: "Max connections" }
      ],
      edges: [
        { id: "e1", source: "client", target: "db", label: "Direct Reads", animated: false, isFailingEdge: true }
      ]
    },
    withTech: {
      narrative: "Redis caches hot keys in RAM",
      benefitsRealized: ["Sub-millisecond reads"],
      nodes: [
        { id: "client", label: "Client Web App", type: "client", isProblemNode: false, details: "" },
        { id: "redis_cache", label: "Redis Cache", type: "cache", isProblemNode: false, details: "In-memory" },
        { id: "db", label: "SQL Database", type: "database", isProblemNode: false, details: "" }
      ],
      edges: [
        { id: "e1", source: "client", target: "redis_cache", label: "Cache Read", animated: true, isFailingEdge: false },
        { id: "e2", source: "redis_cache", target: "db", label: "Cache Miss", animated: false, isFailingEdge: false }
      ]
    },
    citations: []
  };

  const validCheck = validateScenarioGraph(validScenario, "redis");
  assert.strictEqual(validCheck.isValid, true, "Valid graph must pass validation");

  // 3. Test graph validation failure when edge references missing node
  const brokenEdgeScenario = JSON.parse(JSON.stringify(validScenario));
  brokenEdgeScenario.withoutTech.edges[0].target = "non_existent_node";
  const brokenCheck = validateScenarioGraph(brokenEdgeScenario, "redis");
  assert.strictEqual(brokenCheck.isValid, false, "Edge with missing node must fail validation");

  // 4. Test graph validation failure when technology node is absent in withTech
  const missingTechScenario = JSON.parse(JSON.stringify(validScenario));
  missingTechScenario.withTech.nodes = [
    { id: "client", label: "Client Web App", type: "client", isProblemNode: false, details: "" },
    { id: "db", label: "SQL Database", type: "database", isProblemNode: false, details: "" }
  ];
  missingTechScenario.withTech.edges = [
    { id: "e1", source: "client", target: "db", label: "Direct", animated: false, isFailingEdge: false }
  ];
  const missingTechCheck = validateScenarioGraph(missingTechScenario, "redis");
  assert.strictEqual(missingTechCheck.isValid, false, "Missing technology node must fail validation");
});

test("Phase 5: Live bounded AI endpoints (Explain, Scenario, Caching)", async (t) => {
  const db = await connectDB();
  await loadChunksIntoMemory(db);
  const server = app.listen(5095);

  const testUser = {
    userId: "64a000000000000000000001",
    email: "student@university.edu",
    name: "Alex"
  };
  const token = jwt.sign(testUser, process.env.JWT_SECRET, { expiresIn: "1h" });

  try {
    // 1. Live Explain request
    const expRes = await fetch("http://localhost:5095/api/ai/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        techSlug: "python",
        conceptQuery: "Memory model, references and immutability"
      })
    });

    assert.strictEqual(expRes.status, 200, "Explain endpoint must return 200");
    const expData = await expRes.json();
    assert.ok(expData.explain, "Must return explain object");
    assert.ok(expData.explain.summary, "Must have summary");
    assert.ok(expData.explain.coreMechanism, "Must have coreMechanism");
    assert.ok(expData.explain.realWorldAnalogy, "Must have realWorldAnalogy");
    assert.ok(expData.explain.keyTakeaway, "Must have keyTakeaway");

    // 2. Live Explain CACHE HIT verification
    const t0 = performance.now();
    const cacheRes = await fetch("http://localhost:5095/api/ai/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        techSlug: "python",
        conceptQuery: "Memory model, references and immutability"
      })
    });
    const cacheElapsed = performance.now() - t0;
    const cacheData = await cacheRes.json();
    assert.strictEqual(cacheData.fromCache, true, "Subsequent query must return from cache");
    assert.strictEqual(cacheData.providerUsed, "cache");
    assert.ok(cacheElapsed < 50, `Cached query must return rapidly (took ${cacheElapsed.toFixed(2)} ms)`);

    // Clean up test cache
    await db.collection("ai_cache").deleteMany({ technology: "python" });
  } finally {
    server.close();
    await closeDB();
  }
});
