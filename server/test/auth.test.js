const test = require("node:test");
const assert = require("node:assert");
const { app } = require("../server");
const { connectDB, getDB, closeDB } = require("../config/db");

test("Phase 2: Authentication flow (register, duplicate, login, auth middleware)", async (t) => {
  await connectDB();
  const db = getDB();
  const testEmail = `test_${Date.now()}@university.edu`;
  const testPassword = "securePassword123";

  const server = app.listen(5097);
  let authToken = null;

  try {
    // 1. Register new user
    const regRes = await fetch("http://localhost:5097/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Student",
        email: testEmail,
        password: testPassword
      })
    });
    assert.strictEqual(regRes.status, 201, "Registration should return 201 Created");
    const regData = await regRes.json();
    assert.ok(regData.token, "Registration must return JWT token");
    assert.strictEqual(regData.user.email, testEmail);

    // 2. Reject duplicate email
    const dupRes = await fetch("http://localhost:5097/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Another Name",
        email: testEmail,
        password: "anotherPassword"
      })
    });
    assert.strictEqual(dupRes.status, 409, "Duplicate email must return 409 Conflict");

    // 3. Login with valid credentials
    const loginRes = await fetch("http://localhost:5097/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });
    assert.strictEqual(loginRes.status, 200, "Login must return 200 OK");
    const loginData = await loginRes.json();
    assert.ok(loginData.token, "Login must return JWT token");
    authToken = loginData.token;

    // 4. Reject login with invalid password
    const badLoginRes = await fetch("http://localhost:5097/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "wrongPassword"
      })
    });
    assert.strictEqual(badLoginRes.status, 401, "Invalid password must return 401");

    // 5. Access protected /api/auth/me with Bearer token
    const meRes = await fetch("http://localhost:5097/api/auth/me", {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.strictEqual(meRes.status, 200, "Protected route must return 200 with valid token");
    const meData = await meRes.json();
    assert.strictEqual(meData.user.email, testEmail);
    assert.strictEqual(meData.user.passwordHash, undefined, "passwordHash must never be exposed");

    // 6. Access protected /api/auth/me without token
    const noTokenRes = await fetch("http://localhost:5097/api/auth/me");
    assert.strictEqual(noTokenRes.status, 401, "Missing token must return 401 Unauthorized");

    // Clean up test user
    await db.collection("users").deleteOne({ email: testEmail });
  } finally {
    server.close();
    await closeDB();
  }
});
