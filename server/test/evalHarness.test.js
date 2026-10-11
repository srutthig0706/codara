const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  parseArgs,
  validateCases,
  citationAssessment,
  getCheckpointPath,
  countCompletedCases,
  loadEvaluationServices,
  evaluateMode,
  evaluateModeForCheckpoint,
  flattenReport
} = require("../../scripts/eval/run-eval");
const { ScenarioResponseSchema } = require("../schemas/ai.schema");

process.env.GROQ_API_KEY = "test-only-not-a-secret";

test("Evaluation case set contains the required enabled cases", () => {
  const casesPath = path.resolve(__dirname, "../../scripts/eval/cases.json");
  const cases = JSON.parse(fs.readFileSync(casesPath, "utf8"));
  validateCases(cases);

  assert.strictEqual(cases.filter(item => item.type === "explain").length, 10);
  assert.strictEqual(cases.filter(item => item.type === "scenario").length, 10);
  assert.strictEqual(cases.filter(item => item.type === "compare").length, 10);
  assert.strictEqual(cases.filter(item => item.type === "compare" && item.enabled).length, 10);
});

test("Evaluation provider can be pinned and invalid choices are rejected", () => {
  assert.strictEqual(parseArgs(["--provider", "groq"]).provider, "groq");
  assert.strictEqual(parseArgs(["--provider", "gemini"]).provider, "gemini");
  assert.throws(() => parseArgs(["--provider", "auto"]), /--provider must be either/);
  assert.strictEqual(parseArgs(["--provider", "groq", "--status"]).status, true);
});

test("Provider checkpoint path is stable and completed cases count paired results only", () => {
  const cases = [
    { id: "complete" },
    { id: "partial" },
    { id: "pending" }
  ];
  const records = {
    "complete:with_retrieval": {},
    "complete:without_retrieval": {},
    "partial:with_retrieval": {}
  };

  assert.strictEqual(path.basename(getCheckpointPath("groq")), ".eval-checkpoint-groq.json");
  assert.strictEqual(countCompletedCases(cases, records), 1);
});

test("Scenario graph validation runs through the evaluation path without a missing-function TypeError", async () => {
  loadEvaluationServices();
  const originalFetch = global.fetch;
  const invalidGraph = {
    scenarioTitle: "JavaScript service",
    contextDescription: "A service handles incoming work.",
    withoutTech: {
      narrative: "Requests reach a database directly.",
      problemPoints: ["Database overload"],
      nodes: [
        { id: "client", label: "Client", type: "client" },
        { id: "db", label: "Database", type: "database" }
      ],
      edges: [{ id: "bad", source: "client", target: "missing-node" }]
    },
    withTech: {
      narrative: "A JavaScript service coordinates the work.",
      benefitsRealized: ["Clear request handling"],
      nodes: [
        { id: "client", label: "Client", type: "client" },
        { id: "javascript_service", label: "JavaScript service", type: "service" }
      ],
      edges: [{ id: "ok", source: "client", target: "javascript_service" }]
    },
    citations: []
  };
  assert.strictEqual(ScenarioResponseSchema.safeParse(invalidGraph).success, true);
  global.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(invalidGraph) } }]
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const result = await evaluateMode({
      id: "javascript-scenario-test",
      type: "scenario",
      technologies: ["javascript"],
      input: "Test scenario"
    }, "without_retrieval", [], 0, "groq");
    assert.strictEqual(result.schemaValid, true);
    assert.strictEqual(result.graphValidation.isValid, false);
    assert.ok(result.graphValidation.errors.some(error => error.includes("missing target node")));
  } finally {
    global.fetch = originalFetch;
  }
});

test("Invalid scenario JSON after the existing retry limit becomes a checkpointable validation failure", async () => {
  loadEvaluationServices();
  const originalFetch = global.fetch;
  let requestCount = 0;
  global.fetch = async () => {
    requestCount++;
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ scenarioTitle: "invalid" }) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await evaluateModeForCheckpoint({
      id: "javascript-scenario-invalid",
      type: "scenario",
      technologies: ["javascript"],
      input: "Test invalid scenario"
    }, "without_retrieval", [], 0, "groq");
    assert.strictEqual(requestCount, 2, "Validation must use only the existing single retry");
    assert.deepStrictEqual(
      { schemaValid: result.schemaValid, provider: result.provider, model: result.model },
      { schemaValid: false, provider: "groq", model: "openai/gpt-oss-20b" }
    );
    assert.match(result.error, /schema retry failed/);
    assert.ok(result.error.length <= 500);
  } finally {
    global.fetch = originalFetch;
  }
});

test("CSV report tolerates checkpointed invalid model outputs", () => {
  const record = {
    "case-1:with_retrieval": {
      result: {
        schemaValid: false,
        error: "Model output did not match the response schema.",
        provider: "groq",
        model: "openai/gpt-oss-20b"
      }
    },
    "case-1:without_retrieval": {
      result: {
        schemaValid: true,
        citations: { allCitationSourcesRetrieved: false, producedCount: 0, resolvedCount: 0 },
        codeExamples: { status: "not_provided" }
      }
    }
  };
  assert.doesNotThrow(() => flattenReport([{
    id: "case-1",
    type: "scenario",
    technologies: ["javascript"],
    input: "Test"
  }], record));
});

test("Citation scoring counts produced and resolved citations without vacuous success", () => {
  const retrievedChunks = [
    { id: "chunk-1", sourceUrl: "https://docs.example/one" }
  ];
  const mixed = citationAssessment({
    producedCount: 2,
    sources: ["https://docs.example/one", "https://unretrieved.example/source"]
  }, retrievedChunks);

  assert.strictEqual(mixed.producedCount, 2);
  assert.strictEqual(mixed.resolvedCount, 1);
  assert.strictEqual(mixed.unresolvedCount, 1);
  assert.strictEqual(mixed.allCitationSourcesRetrieved, false);

  const noCitations = citationAssessment({ producedCount: 0, sources: [] }, []);
  assert.strictEqual(noCitations.producedCount, 0);
  assert.strictEqual(noCitations.resolvedCount, 0);
  assert.strictEqual(noCitations.allCitationSourcesRetrieved, false);
});
