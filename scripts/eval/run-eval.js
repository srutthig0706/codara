const fs = require("fs");
const path = require("path");

const CASES_PATH = path.join(__dirname, "cases.json");
const RESULTS_DIR = path.resolve(__dirname, "../../results");
const RATE_LIMIT_INSTRUCTIONS = [
  "The evaluation needs a working LLM provider.",
  "Set GEMINI_API_KEY and/or GROQ_API_KEY in server/.env, then verify the setup with:",
  "  cd server",
  "  node check-env.js",
  "Retry with: node scripts/eval/run-eval.js"
].join("\n");

let connectDB;
let closeDB;
let retrieveRelevantChunks;
let loadChunksIntoMemory;
let generateJSON;
let runCode;
let SCHEMAS;
let validateScenarioGraph;
let validateCompareResponse;
let MODEL_OUTPUT_INVALID;

function loadEvaluationServices() {
  ({ connectDB, closeDB } = require("../../server/config/db"));
  ({ retrieveRelevantChunks, loadChunksIntoMemory } = require("../../server/services/rag.service"));
  ({ generateJSON, MODEL_OUTPUT_INVALID } = require("../../server/services/llm.service"));
  ({ runCode } = require("../../server/services/dockerRunner.service"));
  const aiSchemas = require("../../server/schemas/ai.schema");
  SCHEMAS = {
    explain: aiSchemas.ExplainResponseSchema,
    scenario: aiSchemas.ScenarioResponseSchema,
    compare: aiSchemas.CompareResponseSchema
  };
  validateScenarioGraph = aiSchemas.validateScenarioGraph;
  validateCompareResponse = aiSchemas.validateCompareResponse;
}

function getCheckpointPath(provider) {
  return path.join(RESULTS_DIR, `.eval-checkpoint-${provider}.json`);
}

function loadCheckpoint(checkpointPath, providerSelection) {
  if (!fs.existsSync(checkpointPath)) return {};
  const saved = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
  if (saved.provider !== providerSelection) {
    throw new Error(`Checkpoint uses provider '${saved.provider || "unspecified"}'; this run selects '${providerSelection}'. Resume with the same provider or move the checkpoint aside.`);
  }
  if (!saved.records || typeof saved.records !== "object" || Array.isArray(saved.records)) {
    throw new Error(`Checkpoint at ${checkpointPath} does not contain valid records.`);
  }
  return saved.records;
}

function countCompletedCases(cases, recordsByKey) {
  return cases.filter(item =>
    recordsByKey[getModeResultKey(item.id, "with_retrieval")] &&
    recordsByKey[getModeResultKey(item.id, "without_retrieval")]
  ).length;
}

function parseArgs(args) {
  const options = { limit: null, delayMs: 5000, caseIds: null, provider: null, status: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--limit") {
      options.limit = Number(args[++i]);
      if (!Number.isInteger(options.limit) || options.limit < 1) {
        throw new Error("--limit must be a positive integer.");
      }
    } else if (arg === "--delay-ms") {
      options.delayMs = Number(args[++i]);
      if (!Number.isInteger(options.delayMs) || options.delayMs < 0) {
        throw new Error("--delay-ms must be a non-negative integer.");
      }
    } else if (arg === "--case-ids") {
      options.caseIds = (args[++i] || "").split(",").filter(Boolean);
      if (options.caseIds.length === 0) {
        throw new Error("--case-ids requires one or more comma-separated case IDs.");
      }
    } else if (arg === "--provider") {
      options.provider = args[++i];
      if (!["gemini", "groq"].includes(options.provider)) {
        throw new Error("--provider must be either 'gemini' or 'groq'.");
      }
    } else if (arg === "--status") {
      options.status = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function validateCases(cases) {
  if (!Array.isArray(cases) || cases.length !== 30) {
    throw new Error("cases.json must contain exactly 30 evaluation cases.");
  }
  const ids = new Set();
  const typeCounts = { explain: 0, scenario: 0, compare: 0 };
  for (const item of cases) {
    if (!item || typeof item.id !== "string" || !item.id.trim() || ids.has(item.id)) {
      throw new Error("Each evaluation case must have a unique, non-empty id.");
    }
    ids.add(item.id);
    if (!Object.hasOwn(typeCounts, item.type)) {
      throw new Error(`Case ${item.id} has unsupported type '${item.type}'.`);
    }
    typeCounts[item.type]++;
    if (!Array.isArray(item.technologies) || item.technologies.length === 0 ||
        item.technologies.some(technology => !["python", "javascript", "redis"].includes(technology)) ||
        typeof item.input !== "string" || !Array.isArray(item.expectedPoints) ||
        item.expectedPoints.length === 0 ||
        item.expectedPoints.some(point => typeof point !== "string") ||
        typeof item.enabled !== "boolean") {
      throw new Error(`Case ${item.id} is missing one or more required fields.`);
    }
  }
  if (Object.values(typeCounts).some(count => count !== 10)) {
    throw new Error("cases.json must contain 10 explain, 10 scenario, and 10 compare cases.");
  }
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function extractCodeBlocks(value, blocks = []) {
  if (typeof value === "string") {
    const fencePattern = /```([a-zA-Z0-9_+-]*)\s*\r?\n([\s\S]*?)```/g;
    for (const match of value.matchAll(fencePattern)) {
      blocks.push({ language: match[1].toLowerCase(), code: match[2].trim() });
    }
  } else if (Array.isArray(value)) {
    for (const item of value) extractCodeBlocks(item, blocks);
  } else if (value && typeof value === "object") {
    for (const child of Object.values(value)) extractCodeBlocks(child, blocks);
  }
  return blocks;
}

function citationAssessment(citationMetrics, chunks) {
  const sources = citationMetrics?.sources || [];
  const checks = sources.map(source => {
    const matchingChunks = chunks.filter(chunk =>
      typeof source === "string"
        ? chunk.sourceUrl === source
        : chunk.id === source.sourceId
    );
    return {
      source: typeof source === "string" ? source : source.sourceId,
      sourceIds: matchingChunks.map(chunk => chunk.id),
      existsInRetrievedChunks: matchingChunks.some(chunk => Boolean(chunk.id))
    };
  });
  const producedCount = citationMetrics?.producedCount ?? sources.length;
  const resolvedCount = checks.filter(check => check.existsInRetrievedChunks).length;
  return {
    producedCount,
    resolvedCount,
    unresolvedCount: Math.max(0, producedCount - resolvedCount),
    allCitationSourcesRetrieved: producedCount > 0 &&
      checks.length === producedCount &&
      resolvedCount === producedCount,
    checks
  };
}

async function assessCodeExamples(data, technology) {
  const blocks = extractCodeBlocks(data);
  if (blocks.length === 0) return { status: "not_provided", examples: [] };
  if (technology !== "python" && technology !== "javascript") {
    return {
      status: "unsupported_language",
      examples: blocks.map(block => ({ language: block.language || technology, status: "unsupported_language" }))
    };
  }

  const examples = [];
  for (const block of blocks) {
    const language = block.language || technology;
    if ((language === "py" || language === "python") && technology === "python") {
      const result = await runCode({ language: "python", code: block.code, useCache: false });
      examples.push({ language: "python", status: result.status, timeMs: result.timeMs });
    } else if ((language === "js" || language === "javascript" || language === "node") &&
               technology === "javascript") {
      const result = await runCode({ language: "javascript", code: block.code, useCache: false });
      examples.push({ language: "javascript", status: result.status, timeMs: result.timeMs });
    } else {
      examples.push({ language, status: "language_mismatch" });
    }
  }
  return { status: examples.every(example => example.status === "accepted") ? "all_passed" : "some_failed", examples };
}

function buildPrompt(item, chunks) {
  const schemaShape = item.type === "explain"
    ? `{
  "concept": "string",
  "summary": "string",
  "coreMechanism": "string",
  "realWorldAnalogy": "string",
  "keyTakeaway": "string",
  "citations": [{ "sourceName": "string", "sourceUrl": "valid URL", "relevance": "string" }]
}`
    : item.type === "scenario"
      ? `{
  "scenarioTitle": "string",
  "contextDescription": "string",
  "withoutTech": {
    "narrative": "string",
    "problemPoints": ["string"],
    "nodes": [{ "id": "string", "label": "string", "type": "client|server|database|cache|queue|bottleneck|service|default", "isProblemNode": false, "details": "string" }],
    "edges": [{ "id": "string", "source": "node id", "target": "node id", "label": "string", "animated": false, "isFailingEdge": false }]
  },
  "withTech": {
    "narrative": "string",
    "benefitsRealized": ["string"],
    "nodes": [{ "id": "string", "label": "string", "type": "client|server|database|cache|queue|bottleneck|service|default", "isProblemNode": false, "details": "string" }],
    "edges": [{ "id": "string", "source": "node id", "target": "node id", "label": "string", "animated": false, "isFailingEdge": false }]
  },
  "citations": [{ "sourceName": "string", "sourceUrl": "valid URL", "relevance": "string" }]
}`
      : `{
  "projectDescription": "string",
  "whatIfPreset": "10x-users|beginner-team|offline-support|null",
  "technologiesCompared": ["technology slug"],
  "diagrams": [{ "techSlug": "slug", "evidenceStatus": "verified|insufficient", "evidenceNote": "string", "nodes": [], "edges": [] }],
  "tradeoffMatrix": [{ "criterion": "string", "ratings": { "slug": { "easier": "string", "harder": "string", "breaks": "string" } } }],
  "recommendedChoice": "selected slug or insufficient-evidence",
  "recommendationReason": "string",
  "sources": [{ "sourceId": "retrieved chunk id", "techSlug": "slug", "sourceName": "string", "sourceUrl": "valid URL", "relevance": "string" }]
}`;

  const context = chunks.length
    ? chunks.map(chunk =>
      `[Source ID: ${chunk.id}] (${chunk.techSlug}: ${chunk.sourceName} - ${chunk.sourceUrl})\nTitle: ${chunk.sectionTitle}\n${chunk.content}`
    ).join("\n\n")
    : "No local documentation context was retrieved. Do not claim local sources.";
  const citationRule = chunks.length
    ? item.type === "compare"
      ? `Only cite source ids listed above: ${chunks.map(chunk => chunk.id).join(", ")}.`
      : `Only cite source URLs listed above: ${chunks.map(chunk => chunk.sourceUrl).join(", ")}.`
    : "Leave citations empty because no local sources were supplied.";

  const compareRules = item.type === "compare"
    ? `Return one diagram for each selected technology, with nodes and edges; edge endpoints must exist in that diagram. Include a tradeoffMatrix where each criterion has ratings keyed by technology slug, and each rating has easier, harder, and breaks strings. Cite sources by retrieved chunk id in a sources array. For a technology with no chunks, do not guess: return evidenceStatus "insufficient", a single technology-labelled node, no edges, and explicitly unavailable trade-offs.`
    : null;
  const scenarioRules = item.type === "scenario"
    ? `Include at least 2 nodes and 1 edge in each graph. Every edge source and target must match a node id in its graph. The withTech graph must include a node representing ${item.technologies[0]}.`
    : "Explain the requested concept with pedagogical clarity.";
  const requestRules = item.type === "compare" ? compareRules : scenarioRules;
  return `You are a technical educator. ${requestRules}
Respond to this ${item.type} request for ${item.technologies.join(" and ")}:
${item.input}

${chunks.length ? "VERIFIED LOCAL DOCUMENTATION:" : "ZERO-RETRIEVAL BASELINE:"}
${context}

${citationRule}
Return only valid JSON matching this required shape:
${schemaShape}`;
}

function getModeResultKey(caseId, mode) {
  return `${caseId}:${mode}`;
}

async function evaluateMode(item, mode, chunks, retrievalLatencyMs, provider) {
  const technology = item.type === "compare" ? item.technologies.join(",") : item.technologies[0];
  const schema = SCHEMAS[item.type];
  if (!schema) {
    throw new Error(`The ${item.type} route/schema is not implemented; keep ${item.id} disabled.`);
  }
  const startedAt = Date.now();
  const generated = await generateJSON({
    prompt: buildPrompt(item, chunks),
    schema,
    technology,
    action: `eval_${item.type}_${mode}`,
    input: item.input,
    promptVersion: "eval_v1",
    retrievedChunks: chunks,
    useCache: false,
    provider
  });
  const responseLatencyMs = Date.now() - startedAt;
  const parsed = schema.safeParse(generated.data);
  const citationResult = citationAssessment(generated.citationMetrics, chunks);
  const citations = item.type === "compare"
    ? citationAssessment({
      producedCount: generated.data.sources.length,
      sources: generated.data.sources.map(source => ({ sourceId: source.sourceId }))
    }, chunks)
    : citationResult;
  const codeExamples = await assessCodeExamples(generated.data, technology);
  const graphValidation = parsed.success && item.type === "scenario"
    ? validateScenarioGraph(generated.data, technology)
    : parsed.success && item.type === "compare"
      ? validateCompareResponse(
        generated.data,
        item.technologies.map(slug => ({ slug, name: slug })),
        chunks
      )
      : null;

  return {
    mode,
    response: generated.data,
    provider: generated.providerUsed,
    model: generated.modelUsed,
    schemaValid: parsed.success,
    graphValidation,
    citations,
    codeExamples,
    retrievedChunks: chunks.map(chunk => ({
      id: chunk.id,
      sourceName: chunk.sourceName,
      sourceUrl: chunk.sourceUrl
    })),
    retrievalLatencyMs,
    responseLatencyMs
  };
}

async function evaluateModeForCheckpoint(item, mode, chunks, retrievalLatencyMs, provider) {
  try {
    return await evaluateMode(item, mode, chunks, retrievalLatencyMs, provider);
  } catch (error) {
    if (error.code !== MODEL_OUTPUT_INVALID) throw error;
    return {
      mode,
      schemaValid: false,
      error: String(error.message).slice(0, 500),
      provider: error.providerUsed || provider,
      model: error.modelUsed || null
    };
  }
}

function flattenReport(cases, recordsByKey) {
  const headers = [
    "id", "type", "technologies", "input",
    "withRetrievalProvider", "withRetrievalModel", "withRetrievalSchemaValid",
    "withRetrievalCitationsGrounded", "withRetrievalCitationsProduced",
    "withRetrievalCitationsResolved", "withRetrievalCodeExamples", "withRetrievalMs",
    "withoutRetrievalProvider", "withoutRetrievalModel", "withoutRetrievalSchemaValid",
    "withoutRetrievalCitationsGrounded", "withoutRetrievalCitationsProduced",
    "withoutRetrievalCitationsResolved", "withoutRetrievalCodeExamples", "withoutRetrievalMs"
  ];
  const rows = cases.map(item => {
    const withRag = recordsByKey[getModeResultKey(item.id, "with_retrieval")]?.result;
    const withoutRag = recordsByKey[getModeResultKey(item.id, "without_retrieval")]?.result;
    return [
      item.id, item.type, item.technologies.join("|"), item.input,
      withRag?.provider ?? null, withRag?.model ?? null,
      withRag?.schemaValid ?? null, withRag?.citations?.allCitationSourcesRetrieved ?? null,
      withRag?.citations?.producedCount ?? null, withRag?.citations?.resolvedCount ?? null,
      withRag?.codeExamples?.status ?? null, withRag?.responseLatencyMs ?? null,
      withoutRag?.provider ?? null, withoutRag?.model ?? null,
      withoutRag?.schemaValid ?? null, withoutRag?.citations?.allCitationSourcesRetrieved ?? null,
      withoutRag?.citations?.producedCount ?? null, withoutRag?.citations?.resolvedCount ?? null,
      withoutRag?.codeExamples?.status ?? null, withoutRag?.responseLatencyMs ?? null
    ];
  });
  return `${headers.join(",")}\n${rows.map(row => row.map(csvCell).join(",")).join("\n")}\n`;
}

function printUsage() {
  console.log("Usage: node scripts/eval/run-eval.js [--limit N] [--case-ids id1,id2] [--delay-ms N] [--provider gemini|groq] [--status]");
  console.log("Defaults: all enabled cases, a 5-second pause between LLM calls, and resume from the provider checkpoint.");
  console.log("--status requires --provider and only reads the checkpoint; it makes no provider or database calls.");
}

async function runEvaluation(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) {
    printUsage();
    return;
  }
  if (options.status && !options.provider) {
    throw new Error("--status requires --provider gemini|groq.");
  }

  const allCases = JSON.parse(fs.readFileSync(CASES_PATH, "utf8"));
  validateCases(allCases);
  const enabledCases = allCases.filter(item => item.enabled);
  const providerSelection = options.provider || "auto";
  const partialPath = getCheckpointPath(providerSelection);
  if (options.status) {
    const recordsByKey = loadCheckpoint(partialPath, providerSelection);
    const completedCount = countCompletedCases(enabledCases, recordsByKey);
    console.log(`[Checkpoint] ${providerSelection}: ${completedCount}/${enabledCases.length} enabled cases complete; ${enabledCases.length - completedCount} remain; ${Object.keys(recordsByKey).length}/${enabledCases.length * 2} mode results saved.`);
    console.log(`Checkpoint file: ${partialPath}`);
    return true;
  }

  require(path.resolve(__dirname, "../../server/node_modules/dotenv")).config({
    path: path.resolve(__dirname, "../../server/.env")
  });
  loadEvaluationServices();
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    console.error(RATE_LIMIT_INSTRUCTIONS);
    return false;
  }
  if (options.provider && !process.env[options.provider === "gemini" ? "GEMINI_API_KEY" : "GROQ_API_KEY"]) {
    console.error(`Pinned provider '${options.provider}' is unavailable because its API key is not configured. No provider fallback will be attempted.`);
    return false;
  }

  let selected = allCases.filter(item => item.enabled);
  if (options.caseIds) {
    const unknownIds = options.caseIds.filter(id => !allCases.some(item => item.id === id));
    if (unknownIds.length) throw new Error(`Unknown case id(s): ${unknownIds.join(", ")}`);
    selected = allCases.filter(item => options.caseIds.includes(item.id) && item.enabled);
  } else if (options.limit) {
    selected = selected.slice(0, options.limit);
  }
  if (selected.length === 0) throw new Error("No enabled evaluation cases were selected.");
  if (selected.some(item => !SCHEMAS[item.type])) {
    throw new Error("A selected case has no implemented evaluation schema.");
  }

  let recordsByKey = loadCheckpoint(partialPath, providerSelection);
  recordsByKey = Object.fromEntries(
    Object.entries(recordsByKey).filter(([key, record]) => {
      const selectedCase = selected.find(item =>
        key === getModeResultKey(item.id, "with_retrieval") ||
        key === getModeResultKey(item.id, "without_retrieval")
      );
      return !selectedCase || (
        record.input === selectedCase.input &&
        record.type === selectedCase.type &&
        JSON.stringify(record.technologies) === JSON.stringify(selectedCase.technologies)
      );
    })
  );
  let db;
  try {
    db = await connectDB();
    await loadChunksIntoMemory(db);
    for (const item of selected) {
      const technology = item.technologies[0];
      const retrievalStarted = Date.now();
      const technologyRetrievals = await Promise.all(item.technologies.map(techSlug =>
        retrieveRelevantChunks({
          query: item.input,
          techSlug,
          topK: 3,
          minScore: item.type === "scenario" || item.type === "compare" ? 0.30 : 0.35
        })
      ));
      const retrievalLatencyMs = Date.now() - retrievalStarted;
      const chunks = technologyRetrievals.flatMap(ragResult => ragResult.results);

      for (const [mode, modeChunks] of [
        ["with_retrieval", chunks],
        ["without_retrieval", []]
      ]) {
        const key = getModeResultKey(item.id, mode);
        if (recordsByKey[key]) {
          console.log(`[Resume] ${item.id} (${mode}) already complete.`);
          continue;
        }
        if (Object.keys(recordsByKey).length > 0) await new Promise(resolve => setTimeout(resolve, options.delayMs));
        console.log(`[Run] ${item.id} (${mode})`);
        let result;
        try {
          result = await evaluateModeForCheckpoint(
            item,
            mode,
            modeChunks,
            mode === "with_retrieval" ? retrievalLatencyMs : 0,
            options.provider
          );
        } catch (error) {
          if (String(error.message).includes("All LLM providers failed")) {
            console.error(`${error.message}\n\n${RATE_LIMIT_INSTRUCTIONS}`);
            return false;
          }
          if (/HTTP 429|rate_limit_exceeded|RESOURCE_EXHAUSTED|quota exceeded|tokens per minute/i.test(error.message)) {
            const completedCases = allCases.filter(enabledCase =>
              enabledCase.enabled &&
              recordsByKey[getModeResultKey(enabledCase.id, "with_retrieval")] &&
              recordsByKey[getModeResultKey(enabledCase.id, "without_retrieval")]
            ).length;
            const resumeCommand = [
              "node scripts/eval/run-eval.js",
              `--provider ${options.provider || "groq"}`,
              `--case-ids ${selected.map(selectedCase => selectedCase.id).join(",")}`
            ].join(" ");
            console.error(
              `[Stopped] The pinned provider hit a quota/rate limit. ` +
              `${completedCases}/${allCases.filter(enabledCase => enabledCase.enabled).length} enabled cases are complete; ` +
              `${Object.keys(recordsByKey).length} mode result(s) are checkpointed.\n` +
              `Partial results remain at ${partialPath}.\n` +
              `Resume this batch with: ${resumeCommand}`
            );
            return false;
          }
          throw error;
        }
        recordsByKey[key] = {
          caseId: item.id,
          type: item.type,
          technologies: item.technologies,
          input: item.input,
          expectedPoints: item.expectedPoints,
          result
        };
        fs.mkdirSync(RESULTS_DIR, { recursive: true });
        fs.writeFileSync(partialPath, JSON.stringify({
          provider: providerSelection,
          records: recordsByKey
        }, null, 2));
      }
    }
  } finally {
    if (db) await closeDB();
  }

  const completedCount = countCompletedCases(enabledCases, recordsByKey);
  const complete = completedCount === enabledCases.length;
  if (!complete) {
    console.log(`[Checkpoint] ${completedCount}/${enabledCases.length} enabled cases complete; ${enabledCases.length - completedCount} remain. Partial results saved to ${partialPath}`);
    return true;
  }

  const orderedResults = enabledCases.map(item => ({
    ...item,
    withRetrieval: recordsByKey[getModeResultKey(item.id, "with_retrieval")].result,
    withoutRetrieval: recordsByKey[getModeResultKey(item.id, "without_retrieval")].result
  }));
  const generatedAt = new Date().toISOString();
  const completionDate = generatedAt.slice(0, 10);
  const jsonPath = path.join(RESULTS_DIR, `eval-${completionDate}.json`);
  const csvPath = path.join(RESULTS_DIR, `eval-${completionDate}.csv`);
  const report = {
    generatedAt,
    caseCount: orderedResults.length,
    modes: ["with_retrieval", "without_retrieval"],
    cases: orderedResults
  };
  const csv = flattenReport(enabledCases, recordsByKey);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(csvPath, csv);
  fs.rmSync(partialPath, { force: true });
  console.log(`Saved ${orderedResults.length} completed case(s):`);
  console.log(`  ${jsonPath}`);
  console.log(`  ${csvPath}`);
  return true;
}

if (require.main === module) {
  runEvaluation()
    .then(completed => {
      if (completed === false) process.exitCode = 2;
    })
    .catch(error => {
      console.error("Evaluation failed:", error.message);
      process.exitCode = 1;
    });
}

module.exports = {
  runEvaluation,
  parseArgs,
  validateCases,
  getCheckpointPath,
  loadCheckpoint,
  countCompletedCases,
  loadEvaluationServices,
  evaluateMode,
  evaluateModeForCheckpoint,
  flattenReport,
  extractCodeBlocks,
  citationAssessment,
  assessCodeExamples
};
