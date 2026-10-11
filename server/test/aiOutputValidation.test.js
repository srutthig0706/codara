const test = require("node:test");
const assert = require("node:assert/strict");
const { createCompareHandler, createScenarioHandler } = require("../routes/ai.routes");
const { MODEL_OUTPUT_INVALID } = require("../services/llm.service");

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test("Scenario route returns a friendly gateway error for invalid model output", async () => {
  const handler = createScenarioHandler({
    retrieveChunks: async () => ({ results: [] }),
    generate: async () => {
      const error = new Error("Detailed provider/schema internals");
      error.code = MODEL_OUTPUT_INVALID;
      throw error;
    }
  });
  const response = createResponse();

  await handler({
    body: { techSlug: "javascript" },
    user: { userId: "user-1" }
  }, response);

  assert.strictEqual(response.statusCode, 502);
  assert.deepStrictEqual(response.body, {
    error: "The AI scenario could not be validated. Please try again."
  });
});

test("Compare route returns a friendly gateway error for invalid model output", async () => {
  const handler = createCompareHandler({
    getDatabase: () => ({
      collection: () => ({
        find: () => ({
          project: () => ({
            toArray: async () => [
              { slug: "python", name: "Python" },
              { slug: "javascript", name: "JavaScript" }
            ]
          })
        })
      })
    }),
    retrieveChunks: async () => ({ results: [] }),
    generate: async () => {
      const error = new Error("Detailed provider/schema internals");
      error.code = MODEL_OUTPUT_INVALID;
      throw error;
    }
  });
  const response = createResponse();

  await handler({
    body: {
      technologies: ["python", "javascript"],
      projectDescription: "A small event processing service."
    }
  }, response);

  assert.strictEqual(response.statusCode, 502);
  assert.deepStrictEqual(response.body, {
    error: "The AI comparison could not be validated. Please try again."
  });
});
