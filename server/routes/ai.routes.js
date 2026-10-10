const express = require("express");
const authMiddleware = require("../middleware/auth");
const { aiRateLimiter } = require("../middleware/rateLimiter");
const { retrieveRelevantChunks } = require("../services/rag.service");
const { generateJSON } = require("../services/llm.service");
const { 
  ExplainResponseSchema, 
  ScenarioResponseSchema, 
  validateScenarioGraph 
} = require("../schemas/ai.schema");

const router = express.Router();

// Apply auth and rate limiting to all AI endpoints
router.use(authMiddleware);
router.use(aiRateLimiter);

// POST /api/ai/explain
router.post("/explain", async (req, res) => {
  try {
    const { techSlug, conceptQuery } = req.body;
    if (!techSlug) {
      return res.status(400).json({ error: "techSlug is required." });
    }

    const queryText = (conceptQuery || `Core architecture and purpose of ${techSlug}`).trim();

    // 1. Retrieve grounded documentation chunks
    const ragResult = await retrieveRelevantChunks({
      query: queryText,
      techSlug,
      topK: 3,
      minScore: 0.35
    });

    const contextText = ragResult.hasVerifiedSources
      ? ragResult.results.map((r, i) => `[Source ${i + 1}] (${r.sourceName} - ${r.sourceUrl}):\nTitle: ${r.sectionTitle}\n${r.content}`).join("\n\n")
      : "No direct official documentation chunks met the confidence threshold. State clearly that verified local documentation is limited.";

    // 2. Format bounded prompt
    const prompt = `You are a university computer science educator in Codara. Explain the following concept with pedagogical clarity.

Target Technology: ${techSlug}
Concept: ${queryText}

VERIFIED OFFICIAL DOCUMENTATION:
${contextText}

INSTRUCTIONS:
1. Provide a grounded summary and explain the core mechanism under the hood.
2. Provide an intuitive, memorable real-world analogy.
3. State one key takeaway.
4. In citations, ONLY cite URLs present in the verified documentation above: ${ragResult.results.map(r => r.sourceUrl).join(", ")}. If none are provided, leave citations empty.
5. Return JSON matching the schema:
{
  "concept": "${queryText}",
  "summary": "...",
  "coreMechanism": "...",
  "realWorldAnalogy": "...",
  "keyTakeaway": "...",
  "citations": [{ "sourceName": "...", "sourceUrl": "...", "relevance": "..." }]
}`;

    const result = await generateJSON({
      prompt,
      schema: ExplainResponseSchema,
      technology: techSlug,
      action: "explain",
      input: queryText,
      promptVersion: "v1.0",
      retrievedChunks: ragResult.results
    });

    return res.status(200).json({
      explain: result.data,
      fromCache: result.fromCache,
      providerUsed: result.providerUsed,
      retrievedChunks: ragResult.results
    });
  } catch (err) {
    console.error("[AI] Explain error:", err.message);
    return res.status(500).json({ error: err.message || "Failed to generate explanation." });
  }
});

// POST /api/ai/scenario
router.post("/scenario", async (req, res) => {
  try {
    const { techSlug, scenarioTopic } = req.body;
    if (!techSlug) {
      return res.status(400).json({ error: "techSlug is required." });
    }

    const topic = (scenarioTopic || `High concurrency throughput and bottlenecks with ${techSlug}`).trim();

    // 1. Retrieve documentation chunks
    const ragResult = await retrieveRelevantChunks({
      query: topic,
      techSlug,
      topK: 3,
      minScore: 0.30
    });

    const contextText = ragResult.results.map(r => `[${r.sectionTitle}]: ${r.content}`).join("\n\n");

    // 2. Format scenario synthesis prompt
    const prompt = `You are a senior systems architect in Codara. Create a spatial architectural scenario comparing a system WITHOUT ${techSlug} vs WITH ${techSlug}.

Topic: ${topic}
Technology: ${techSlug}

RELEVANT ARCHITECTURE CONTEXT:
${contextText}

GRAPH GENERATION RULES:
1. "withoutTech":
   - narrative: explain the failure/bottleneck when ${techSlug} is missing.
   - problemPoints: list 2-3 specific architectural failure modes (e.g., Disk I/O saturation, Connection pool exhaustion).
   - nodes: at least 3 nodes with ids ("client", "api_gateway", "db", etc.), labels, and types ("client", "server", "database", "bottleneck"). Mark problem nodes with isProblemNode: true.
   - edges: connecting the nodes (source, target, label, isFailingEdge: true on bottleneck paths).
2. "withTech":
   - narrative: explain how the system stabilizes when ${techSlug} is introduced.
   - benefitsRealized: 2-3 benefits (e.g., Sub-millisecond latency, Offloaded disk reads).
   - nodes: MUST include a node specifically representing ${techSlug} (id: "${techSlug}_service" or label containing "${techSlug}").
   - edges: connecting nodes through the ${techSlug} component.
3. Every edge's source and target MUST correspond to a declared node id in that same graph.
4. Return valid JSON strictly matching ScenarioResponseSchema.`;

    const result = await generateJSON({
      prompt,
      schema: ScenarioResponseSchema,
      technology: techSlug,
      action: "scenario",
      input: topic,
      promptVersion: "v1.0",
      retrievedChunks: ragResult.results
    });

    // Validate graph topology
    const graphValidation = validateScenarioGraph(result.data, techSlug);

    return res.status(200).json({
      scenario: result.data,
      fromCache: result.fromCache,
      providerUsed: result.providerUsed,
      graphValidation,
      retrievedChunks: ragResult.results
    });
  } catch (err) {
    console.error("[AI] Scenario error:", err.message);
    return res.status(500).json({ error: err.message || "Failed to generate scenario." });
  }
});

module.exports = router;
