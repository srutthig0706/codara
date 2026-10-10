const test = require("node:test");
const assert = require("node:assert");
const { app } = require("../server");
const { connectDB, closeDB } = require("../config/db");

test("Phase 1: Server and MongoDB health check", async (t) => {
  await connectDB();
  
  const server = app.listen(5098);
  
  try {
    const res = await fetch("http://localhost:5098/api/health");
    assert.strictEqual(res.status, 200, "Health endpoint should return HTTP 200 when MongoDB is connected");
    
    const body = await res.json();
    assert.strictEqual(body.status, "ok");
    assert.strictEqual(body.server, "running");
    assert.strictEqual(body.mongo, "connected");
    assert.ok(body.judge0 === "reachable" || body.judge0 === "offline", "Judge0 status should be reported");
    assert.ok(body.timestamp, "Timestamp must be included");
  } finally {
    server.close();
    await closeDB();
  }
});
