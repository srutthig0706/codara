const test = require("node:test");
const assert = require("node:assert/strict");
const { z } = require("zod");

process.env.GEMINI_API_KEY = "test-only-not-a-secret";
process.env.GROQ_API_KEY = "test-only-not-a-secret";

const { generateJSON } = require("../services/llm.service");

const ResponseSchema = z.object({
  answer: z.string().min(1),
  citations: z.array(z.object({ sourceUrl: z.string().url() })).default([])
});

test("Pinned provider records its model and raw citation resolution metrics without caching", async () => {
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async url => {
    requestedUrls.push(String(url));
    const content = JSON.stringify({
      answer: "A test response.",
      citations: [{ sourceUrl: "https://unretrieved.example/source" }]
    });
    return new Response(JSON.stringify({
      choices: [{ message: { content } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const request = {
      prompt: "Test",
      schema: ResponseSchema,
      technology: "test",
      action: "eval",
      input: "pinned provider",
      promptVersion: "unit-test",
      retrievedChunks: [],
      useCache: false,
      provider: "groq"
    };
    const first = await generateJSON(request);
    const second = await generateJSON(request);

    assert.strictEqual(first.providerUsed, "groq");
    assert.strictEqual(first.modelUsed, "openai/gpt-oss-20b");
    assert.deepStrictEqual(first.citationMetrics, {
      producedCount: 1,
      resolvedCount: 0,
      sources: ["https://unretrieved.example/source"]
    });
    assert.strictEqual(first.data.citations.length, 0);
    assert.strictEqual(second.providerUsed, "groq");
    assert.strictEqual(requestedUrls.length, 2, "Cache opt-out should call the pinned provider each time");
    assert.ok(requestedUrls.every(url => url.includes("api.groq.com")));
  } finally {
    global.fetch = originalFetch;
  }
});

test("Pinned provider failure does not fall back to another provider", async () => {
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async url => {
    requestedUrls.push(String(url));
    return new Response("upstream unavailable", { status: 503 });
  };

  try {
    await assert.rejects(generateJSON({
      prompt: "Test",
      schema: ResponseSchema,
      technology: "test",
      action: "eval",
      input: "pinned provider failure",
      promptVersion: "unit-test",
      retrievedChunks: [],
      useCache: false,
      provider: "groq"
    }), /Pinned LLM provider 'groq' failed/);
    assert.strictEqual(requestedUrls.length, 1);
    assert.ok(requestedUrls[0].includes("api.groq.com"));
  } finally {
    global.fetch = originalFetch;
  }
});
