const test = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");
const { app } = require("../server");
const { connectDB, closeDB } = require("../config/db");

test("Phase 6: Code Sandbox & Execution Runner", async (t) => {
  await connectDB();
  const server = app.listen(5094);

  const testUser = {
    userId: "64a000000000000000000001",
    email: "coder@university.edu",
    name: "Coder"
  };
  const token = jwt.sign(testUser, process.env.JWT_SECRET, { expiresIn: "1h" });

  try {
    // 1. Status route check
    const statusRes = await fetch("http://localhost:5094/api/sandbox/status");
    assert.strictEqual(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.ok(statusData.activeRunner, "Must report active runner");
    assert.ok(Array.isArray(statusData.supportedLanguages));

    // 2. Reject unauthenticated execution
    const unauthRes = await fetch("http://localhost:5094/api/sandbox/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceCode: "print(1)", languageId: 71 })
    });
    assert.strictEqual(unauthRes.status, 401, "Must require authentication");

    // 3. Execute valid Python code
    const pyRes = await fetch("http://localhost:5094/api/sandbox/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        sourceCode: "print(2 + 2)",
        languageId: 71,
        expectedOutput: "4"
      })
    });
    assert.strictEqual(pyRes.status, 200);
    const pyData = await pyRes.json();
    assert.strictEqual(pyData.execution.status.id, 3, "Accepted status expected");
    assert.strictEqual(pyData.execution.stdout.trim(), "4");

    // 4. Execute valid JavaScript code
    const jsRes = await fetch("http://localhost:5094/api/sandbox/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        sourceCode: "console.log(10 * 10);",
        languageId: 63,
        expectedOutput: "100"
      })
    });
    assert.strictEqual(jsRes.status, 200);
    const jsData = await jsRes.json();
    assert.strictEqual(jsData.execution.status.id, 3);
    assert.strictEqual(jsData.execution.stdout.trim(), "100");

    // 5. Reject Redis execution as read-only daemon
    const redisRes = await fetch("http://localhost:5094/api/sandbox/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        sourceCode: "SET key 1",
        languageId: 999
      })
    });
    assert.strictEqual(redisRes.status, 400);
    const redisData = await redisRes.json();
    assert.strictEqual(redisData.readOnly, true, "Redis must be flagged read-only");

    // 6. Python runtime error
    const errRes = await fetch("http://localhost:5094/api/sandbox/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        sourceCode: "raise ValueError('intentional error')",
        languageId: 71
      })
    });
    assert.strictEqual(errRes.status, 200);
    const errData = await errRes.json();
    assert.strictEqual(errData.execution.status.id, 11, "Runtime error status expected");
    assert.ok(errData.execution.stderr.includes("ValueError"), "Stderr must capture error trace");
  } finally {
    server.close();
    await closeDB();
  }
});
