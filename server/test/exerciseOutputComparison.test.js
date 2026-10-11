const test = require("node:test");
const assert = require("node:assert/strict");
const { compareExerciseOutput } = require("../routes/test.routes");

test("JSON exercise comparison ignores object key order", () => {
  assert.strictEqual(
    compareExerciseOutput('{"alpha":2,"beta":1}', '{"beta":1,"alpha":2}', "json"),
    true
  );
});

test("JSON exercise comparison rejects different counts", () => {
  assert.strictEqual(
    compareExerciseOutput('{"alpha":2,"beta":1}', '{"beta":2,"alpha":1}', "json"),
    false
  );
});

test("JSON exercise comparison rejects invalid JSON output", () => {
  assert.strictEqual(
    compareExerciseOutput('{"alpha":2}', "not json", "json"),
    false
  );
});

test("Exercises without JSON comparison keep exact trimmed text matching", () => {
  assert.strictEqual(compareExerciseOutput(" True ", "True", undefined), true);
  assert.strictEqual(compareExerciseOutput("True", "true", undefined), false);
});
