const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  parseArgs,
  validateCases,
  citationAssessment
} = require("../../scripts/eval/run-eval");

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
