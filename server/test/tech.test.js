const test = require("node:test");
const assert = require("node:assert");
const { app } = require("../server");
const { connectDB, closeDB } = require("../config/db");

test("Phase 3: Catalog and Static Technology Content", async (t) => {
  await connectDB();
  const server = app.listen(5096);

  try {
    // 1. Fetch entire catalog
    const catalogRes = await fetch("http://localhost:5096/api/technologies");
    assert.strictEqual(catalogRes.status, 200, "Catalog should return 200 OK");
    const catalogData = await catalogRes.json();
    assert.ok(Array.isArray(catalogData.technologies), "Technologies must be an array");
    assert.ok(catalogData.technologies.length >= 3, "Must have at least 3 seeded technologies");

    const slugs = catalogData.technologies.map(t => t.slug);
    assert.ok(slugs.includes("python"), "Catalog must contain Python");
    assert.ok(slugs.includes("javascript"), "Catalog must contain JavaScript");
    assert.ok(slugs.includes("redis"), "Catalog must contain Redis");

    // 2. Verify static detail for Python
    const pyRes = await fetch("http://localhost:5096/api/technologies/python");
    assert.strictEqual(pyRes.status, 200);
    const pyData = await pyRes.json();
    assert.strictEqual(pyData.technology.slug, "python");
    assert.strictEqual(pyData.technology.runnableInSandbox, true);
    assert.strictEqual(pyData.technology.reviewStatus, "needs human review");
    assert.strictEqual(pyData.technology.sourceUrl, "https://docs.python.org/3/");
    assert.ok(Array.isArray(pyData.technology.commonErrors), "Must include commonErrors");

    // 3. Verify static detail for Redis (read-only in sandbox)
    const redisRes = await fetch("http://localhost:5096/api/technologies/redis");
    assert.strictEqual(redisRes.status, 200);
    const redisData = await redisRes.json();
    assert.strictEqual(redisData.technology.slug, "redis");
    assert.strictEqual(redisData.technology.runnableInSandbox, false, "Redis must be read-only in sandbox");

    // 4. Verify 404 for nonexistent slug
    const notFoundRes = await fetch("http://localhost:5096/api/technologies/unknown-tech");
    assert.strictEqual(notFoundRes.status, 404, "Unknown slug must return 404");
  } finally {
    server.close();
    await closeDB();
  }
});
