const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/auth");
const { aiRateLimiter } = require("../middleware/rateLimiter");
const { createCompareHandler } = require("../routes/ai.routes");
const {
  createCompareResponseSchema,
  validateCompareResponse
} = require("../schemas/ai.schema");

const technologies = [
  { slug: "python", name: "Python" },
  { slug: "javascript", name: "JavaScript" }
];
const chunks = [
  {
    id: "python-doc-1",
    techSlug: "python",
    sourceName: "Python Docs",
    sourceUrl: "https://docs.example/python",
    sectionTitle: "Python execution",
    content: "Python documentation excerpt."
  },
  {
    id: "javascript-doc-1",
    techSlug: "javascript",
    sourceName: "JavaScript Docs",
    sourceUrl: "https://docs.example/javascript",
    sectionTitle: "JavaScript runtime",
    content: "JavaScript documentation excerpt."
  }
];

function createValidComparison() {
  return {
    projectDescription: "A small service for processing incoming events.",
    whatIfPreset: null,
    technologiesCompared: ["python", "javascript"],
    diagrams: technologies.map(technology => ({
      techSlug: technology.slug,
      evidenceStatus: "verified",
      evidenceNote: `Architecture grounded in ${technology.name} documentation.`,
      nodes: [
        { id: "client", label: "Client", type: "client" },
        { id: technology.slug, label: technology.name, type: "service" }
      ],
      edges: [{ id: "e1", source: "client", target: technology.slug, label: "request" }]
    })),
    tradeoffMatrix: [{
      criterion: "Operational complexity",
      ratings: {
        python: { easier: "Simple setup.", harder: "Runtime configuration.", breaks: "Nothing inherent." },
        javascript: { easier: "Shared language with the client.", harder: "Event-loop discipline.", breaks: "Nothing inherent." }
      }
    }],
    recommendedChoice: "python",
    recommendationReason: "The project requirements align with the verified Python trade-offs.",
    sources: chunks.map(chunk => ({
      sourceId: chunk.id,
      techSlug: chunk.techSlug,
      sourceName: chunk.sourceName,
      sourceUrl: chunk.sourceUrl
    }))
  };
}

function startTestServer(generate, saveCache = async () => {}) {
  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use(aiRateLimiter);
  app.post("/api/ai/compare", createCompareHandler({
    getDatabase: () => ({
      collection: () => ({
        find: () => ({
          project: () => ({
            toArray: async () => technologies
          })
        })
      })
    }),
    retrieveChunks: async ({ techSlug }) => ({
      results: chunks.filter(chunk => chunk.techSlug === techSlug)
    }),
    generate,
    saveCache
  }));
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}/api/ai/compare`;
  const token = jwt.sign({
    userId: "64a000000000000000000001",
    email: "compare-test@example.edu"
  }, process.env.JWT_SECRET, { expiresIn: "1h" });
  return { server, url, token };
}

test("Compare validation rejects invalid edge references and unresolved source ids", () => {
  const comparison = createValidComparison();
  comparison.diagrams[0].edges[0].target = "missing-node";
  comparison.sources[1].sourceId = "not-retrieved";

  const validation = validateCompareResponse(comparison, technologies, chunks);
  assert.strictEqual(validation.isValid, false);
  assert.ok(validation.errors.some(error => error.includes("referencing a missing node")));
  assert.ok(validation.errors.some(error => error.includes("does not exist in the retrieved chunks")));
  assert.strictEqual(
    createCompareResponseSchema(technologies, chunks).safeParse(comparison).success,
    false
  );
  assert.strictEqual(
    createCompareResponseSchema(technologies, chunks, {
      projectDescription: "A different project description.",
      whatIfPreset: "offline-support"
    }).safeParse(createValidComparison()).success,
    false
  );
});

test("Compare validation discloses missing evidence instead of guessing", () => {
  const comparison = createValidComparison();
  comparison.diagrams[1] = {
    techSlug: "javascript",
    evidenceStatus: "insufficient",
    evidenceNote: "No relevant verified JavaScript source was retrieved.",
    nodes: [{ id: "javascript", label: "JavaScript", type: "service" }],
    edges: []
  };
  comparison.tradeoffMatrix[0].ratings.javascript = {
    easier: "No relevant source was retrieved; cannot assess.",
    harder: "No relevant source was retrieved; cannot assess.",
    breaks: "No relevant source was retrieved; cannot assess."
  };
  comparison.sources = comparison.sources.filter(source => source.techSlug === "python");
  comparison.recommendedChoice = "insufficient-evidence";
  comparison.recommendationReason = "A selected technology has no relevant verified source.";

  const partialChunks = chunks.filter(chunk => chunk.techSlug === "python");
  assert.deepStrictEqual(
    validateCompareResponse(comparison, technologies, partialChunks),
    { isValid: true, errors: [] }
  );

  comparison.tradeoffMatrix[0].ratings.javascript.harder = "Lower setup effort.";
  assert.strictEqual(
    validateCompareResponse(comparison, technologies, partialChunks).isValid,
    false
  );
});

test("Compare route requires authentication, validates input, and retries an invalid cached response", async () => {
  const validComparison = createValidComparison();
  const invalidCachedComparison = structuredClone(validComparison);
  invalidCachedComparison.sources[0].sourceId = "invented-source";
  let generationCalls = 0;
  let cacheWrites = 0;
  const { server, url, token } = startTestServer(async options => {
    generationCalls++;
    assert.strictEqual(options.groundCitations, false);
    assert.strictEqual(
      options.schema.safeParse(validComparison).success,
      true,
      "The route should pass the request-specific validation schema to the LLM service"
    );
    if (generationCalls === 1) {
      return { data: invalidCachedComparison, fromCache: true, providerUsed: "cache" };
    }
    assert.strictEqual(options.useCache, false, "Integrity retry must bypass the invalid cache entry");
    return { data: validComparison, fromCache: false, providerUsed: "groq" };
  }, async () => { cacheWrites++; });

  try {
    const unauthenticated = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        technologies: ["python", "javascript"],
        projectDescription: "An event processing service."
      })
    });
    assert.strictEqual(unauthenticated.status, 401);

    const invalidRequest = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        technologies: ["python", "python"],
        projectDescription: "An event processing service."
      })
    });
    assert.strictEqual(invalidRequest.status, 400);
    assert.strictEqual(generationCalls, 0);

    const longDescription = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        technologies: ["python", "javascript"],
        projectDescription: "x".repeat(301)
      })
    });
    assert.strictEqual(longDescription.status, 400);
    assert.strictEqual(generationCalls, 0);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        technologies: ["python", "javascript"],
        projectDescription: validComparison.projectDescription
      })
    });
    const result = await response.json();
    assert.strictEqual(response.status, 200);
    assert.strictEqual(result.comparison.recommendedChoice, "python");
    assert.strictEqual(result.providerUsed, "groq");
    assert.strictEqual(generationCalls, 2);
    assert.strictEqual(cacheWrites, 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
