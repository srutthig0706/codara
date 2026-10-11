const express = require("express");
const authMiddleware = require("../middleware/auth");
const { aiRateLimiter } = require("../middleware/rateLimiter");
const { retrieveRelevantChunks } = require("../services/rag.service");
const { generateJSON } = require("../services/llm.service");
const { getDB } = require("../config/db");
const { computeCacheKey, setCachedAIResponse } = require("../services/cache.service");
const { 
  ExplainResponseSchema, 
  ScenarioResponseSchema, 
  CompareRequestSchema,
  CompareResponseSchema,
  createCompareResponseSchema,
  validateCompareResponse,
  validateScenarioGraph 
} = require("../schemas/ai.schema");

const router = express.Router();

// Apply auth and rate limiting to all AI endpoints
router.use(authMiddleware);
router.use(aiRateLimiter);

function createCompareHandler({
  retrieveChunks = retrieveRelevantChunks,
  generate = generateJSON,
  getDatabase = getDB,
  saveCache = setCachedAIResponse
} = {}) {
  return async (req, res) => {
    const request = CompareRequestSchema.safeParse(req.body);
    if (!request.success) {
      return res.status(400).json({
        error: "Invalid comparison request.",
        details: request.error.flatten().fieldErrors
      });
    }

    const { technologies: requestedSlugs, projectDescription, whatIfPreset } = request.data;
    const technologyKey = requestedSlugs.join(",");
    const inputKey = JSON.stringify({ projectDescription, whatIfPreset: whatIfPreset || null });
    const promptVersion = "v1.1";

    try {
      const catalogEntries = await getDatabase().collection("technologies")
        .find({ slug: { $in: requestedSlugs } })
        .project({ slug: 1, name: 1 })
        .toArray();
      const catalogBySlug = new Map(catalogEntries.map(technology => [technology.slug, technology]));
      const technologies = requestedSlugs.map(slug => catalogBySlug.get(slug));
      if (technologies.some(technology => !technology)) {
        return res.status(400).json({ error: "Every selected technology must exist in the catalog." });
      }

      const retrievals = await Promise.all(technologies.map(async technology => ({
        technology,
        result: await retrieveChunks({
          query: `${projectDescription}${whatIfPreset ? `; what-if: ${whatIfPreset}` : ""}`,
          techSlug: technology.slug,
          topK: 3,
          minScore: 0.30
        })
      })));
      const retrievedChunks = retrievals.flatMap(({ result }) => result.results);
      const context = retrievals.map(({ technology, result }) => {
        if (result.results.length === 0) {
          return `TECHNOLOGY ${technology.slug} (${technology.name}): NO RELEVANT VERIFIED SOURCE WAS RETRIEVED. Do not infer or invent architecture or trade-offs for it.`;
        }
        const sourceContent = result.results.map(chunk =>
          `SOURCE ID: ${chunk.id}\nName: ${chunk.sourceName}\nURL: ${chunk.sourceUrl}\nSection: ${chunk.sectionTitle}\nContent: ${chunk.content}`
        ).join("\n\n");
        return `TECHNOLOGY ${technology.slug} (${technology.name}) VERIFIED SOURCES:\n${sourceContent}`;
      }).join("\n\n");

      const comparisonExample = {
        projectDescription,
        whatIfPreset: whatIfPreset || null,
        technologiesCompared: technologies.map(technology => technology.slug),
        diagrams: technologies.map(technology => {
          const hasEvidence = retrievedChunks.some(chunk => chunk.techSlug === technology.slug);
          const nodes = [{
            id: technology.slug,
            label: technology.name,
            type: "service",
            isProblemNode: false,
            details: hasEvidence ? "Ground the component in its retrieved documentation." : "No relevant verified source was retrieved."
          }];
          if (hasEvidence) {
            nodes.unshift({
              id: "project",
              label: "Project component",
              type: "server",
              isProblemNode: false,
              details: "Show how the project uses the selected technology."
            });
          }
          return {
            techSlug: technology.slug,
            evidenceStatus: hasEvidence ? "verified" : "insufficient",
            evidenceNote: hasEvidence
              ? "Explain the source basis for this architecture."
              : "No relevant verified source was retrieved; do not infer architecture.",
            nodes,
            edges: hasEvidence ? [{
              id: `project-to-${technology.slug}`,
              source: "project",
              target: technology.slug,
              label: "uses",
              animated: false,
              isFailingEdge: false
            }] : []
          };
        }),
        tradeoffMatrix: [{
          criterion: "Project-specific trade-off",
          ratings: Object.fromEntries(technologies.map(technology => {
            const hasEvidence = retrievedChunks.some(chunk => chunk.techSlug === technology.slug);
            const unavailable = "No relevant verified source was retrieved; cannot assess.";
            return [technology.slug, {
              easier: hasEvidence ? "Explain what this technology makes easier." : unavailable,
              harder: hasEvidence ? "Explain the associated complexity." : unavailable,
              breaks: hasEvidence ? "Explain a limitation or failure mode." : unavailable
            }];
          }))
        }],
        recommendedChoice: retrievedChunks.length ? technologies[0].slug : "insufficient-evidence",
        recommendationReason: "Tie the recommendation to project requirements and verified sources.",
        sources: technologies.flatMap(technology => {
          const chunk = retrievedChunks.find(item => item.techSlug === technology.slug);
          return chunk ? [{
            sourceId: chunk.id,
            techSlug: chunk.techSlug,
            sourceName: chunk.sourceName,
            sourceUrl: chunk.sourceUrl,
            relevance: chunk.sectionTitle
          }] : [];
        })
      };
      const prompt = `You are a systems architecture educator in Codara. Compare the selected catalog technologies for this project using only the verified source excerpts below.

PROJECT DESCRIPTION: ${projectDescription}
WHAT-IF PRESET: ${whatIfPreset || "none"}
SELECTED TECHNOLOGIES: ${technologies.map(technology => `${technology.slug} (${technology.name})`).join(", ")}

VERIFIED SOURCES:
${context}

Return JSON matching CompareResponseSchema exactly. Include projectDescription, whatIfPreset (null when none), technologiesCompared (the exact selected slugs), one diagram for each selected technology, tradeoffMatrix, recommendedChoice, recommendationReason, and sources.
Use this exact JSON structure; replace example values but keep every key and nesting level:
${JSON.stringify(comparisonExample, null, 2)}
Each diagram must include its technology as a node. Every edge source and target must reference a node id in that diagram. Mark genuine bottlenecks with isProblemNode or isFailingEdge.
For a technology with verified sources, provide a grounded diagram with at least two nodes and one edge, mark evidenceStatus "verified", and cite at least one of that technology's exact source ids.
For a technology with no retrieved source, do not guess: use evidenceStatus "insufficient", a clear evidenceNote, exactly one node labelled with the catalog technology name, and no edges. Every easier, harder, and breaks field for that technology must explicitly say evidence is unavailable. Set recommendedChoice to "insufficient-evidence" and explain that a recommendation cannot be grounded if any selected technology lacks a source.
Every source object must copy sourceId, techSlug, sourceName, and sourceUrl exactly from one of the source excerpts. Never invent source ids, URLs, factual claims, or licenses.
For a grounded recommendation, recommendedChoice must be one selected slug and recommendationReason must discuss the active what-if preset when present. Do not return generic chat or ask follow-up questions.`;

      const validationContext = { projectDescription, whatIfPreset };
      const schema = createCompareResponseSchema(technologies, retrievedChunks, validationContext);
      const validateResult = result => {
        const parsed = CompareResponseSchema.safeParse(result.data);
        if (!parsed.success) {
          return {
            isValid: false,
            errors: [JSON.stringify(parsed.error.flatten().fieldErrors)]
          };
        }
        result.data = parsed.data;
        return validateCompareResponse(result.data, technologies, retrievedChunks, validationContext);
      };
      const generationOptions = {
        prompt,
        schema,
        technology: technologyKey,
        action: "compare",
        input: inputKey,
        promptVersion,
        retrievedChunks,
        groundCitations: false
      };
      let result = await generate(generationOptions);
      let validation = validateResult(result);

      if (!validation.isValid && result.fromCache) {
        result = await generate({
          ...generationOptions,
          prompt: `${prompt}\n\nThe cached response failed integrity checks: ${validation.errors.join("; ")}. Regenerate a compliant response.`,
          useCache: false
        });
        validation = validateResult(result);
        if (validation.isValid) {
          await saveCache({
            cacheKey: computeCacheKey({
              technology: technologyKey,
              action: "compare",
              input: inputKey,
              promptVersion
            }),
            technology: technologyKey,
            action: "compare",
            input: inputKey,
            promptVersion,
            responseJson: result.data,
            providerUsed: result.providerUsed,
            retrievalCitations: retrievedChunks.map(chunk => chunk.sourceUrl)
          });
        }
      }

      if (!validation.isValid) {
        return res.status(502).json({
          error: "The comparison response failed graph or source validation.",
          details: validation.errors
        });
      }

      return res.status(200).json({
        comparison: result.data,
        fromCache: result.fromCache,
        providerUsed: result.providerUsed,
        retrievedChunks
      });
    } catch (err) {
      console.error("[AI] Compare error:", err.message);
      return res.status(500).json({ error: err.message || "Failed to generate comparison." });
    }
  };
}

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

// POST /api/ai/compare
router.post("/compare", createCompareHandler());

module.exports = router;
module.exports.createCompareHandler = createCompareHandler;
