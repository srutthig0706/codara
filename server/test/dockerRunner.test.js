const test = require("node:test");
const assert = require("node:assert");
const {
  buildDockerRunArgs,
  truncateOutput,
  computeCacheKey,
  mapStatus,
  runCode,
  clearCache
} = require("../services/dockerRunner.service");

test("Unit Tests: Docker Runner Pure Logic", async (t) => {
  // 1. Command builder produces valid argument array with required security flags
  await t.test("buildDockerRunArgs generates compliant argument array", () => {
    const args = buildDockerRunArgs({
      containerName: "test-container-1",
      hostDir: "D:\\codara\\.runs\\test1",
      language: "python",
      image: "python:3.12-slim"
    });

    assert.ok(Array.isArray(args), "Must return argument array, never a shell string");
    assert.strictEqual(args[0], "run");
    assert.ok(args.includes("--rm"), "Must include --rm");
    assert.ok(args.includes("--network") && args[args.indexOf("--network") + 1] === "none", "Must isolate network");
    assert.ok(args.includes("--memory") && args[args.indexOf("--memory") + 1] === "128m", "Must limit memory");
    assert.ok(args.includes("--memory-swap") && args[args.indexOf("--memory-swap") + 1] === "128m", "Must limit memory swap");
    assert.ok(args.includes("--cpus") && args[args.indexOf("--cpus") + 1] === "0.5", "Must limit cpus");
    assert.ok(args.includes("--pids-limit") && args[args.indexOf("--pids-limit") + 1] === "64", "Must limit pids");
    assert.ok(args.includes("--read-only"), "Must be read-only");
    assert.ok(args.includes("--cap-drop") && args[args.indexOf("--cap-drop") + 1] === "ALL", "Must drop all capabilities");
    assert.ok(args.includes("--security-opt") && args[args.indexOf("--security-opt") + 1] === "no-new-privileges", "Must enforce no-new-privileges");
    assert.ok(args.includes("--user") && args[args.indexOf("--user") + 1] === "1000:1000", "Must run as non-root user");
    assert.ok(args.includes("-v"), "Must mount volume");
    assert.ok(args.includes("python:3.12-slim"));
    assert.ok(args.includes("--env") && args[args.indexOf("--env") + 1] === "PYTHONPATH=/app");
    assert.deepStrictEqual(args.slice(-3), ["python", "-u", "/app/script.py"]);

    const jsArgs = buildDockerRunArgs({
      containerName: "test-container-js",
      hostDir: "D:\\codara\\.runs\\test-js",
      language: "javascript",
      image: "node:22-slim"
    });
    assert.ok(jsArgs.includes("--require"));
    assert.ok(jsArgs.includes("/app/runner-start.js"));
  });

  // 2. Truncation logic caps at limit and appends notice
  await t.test("truncateOutput preserves small text and caps large text", () => {
    const shortText = "Hello, world!";
    const shortRes = truncateOutput(shortText, 64 * 1024);
    assert.strictEqual(shortRes.truncated, false);
    assert.strictEqual(shortRes.text, shortText);

    const oversizedText = "A".repeat(70000);
    const cappedRes = truncateOutput(oversizedText, 1000);
    assert.strictEqual(cappedRes.truncated, true);
    assert.ok(cappedRes.text.includes("[Output truncated: exceeded 64 KB limit]"));
    assert.ok(Buffer.byteLength(cappedRes.text, "utf-8") < 2000);
  });

  // 3. Cache key computation is deterministic SHA-256
  await t.test("computeCacheKey produces deterministic SHA-256 hash", () => {
    const key1 = computeCacheKey({ language: "python", code: "print(1)", stdin: "" });
    const key2 = computeCacheKey({ language: "python", code: "print(1)", stdin: "" });
    const key3 = computeCacheKey({ language: "python", code: "print(2)", stdin: "" });

    assert.strictEqual(key1, key2, "Identical inputs must yield identical cache keys");
    assert.notStrictEqual(key1, key3, "Different code must yield different keys");
    assert.strictEqual(key1.length, 64, "Key must be 64-character SHA-256 hex string");
  });

  // 4. Status mapping accurately classifies execution outcomes
  await t.test("mapStatus maps exit codes and errors correctly", () => {
    assert.strictEqual(mapStatus({ exitCode: 0, timedOut: false }), "accepted");
    assert.strictEqual(mapStatus({ exitCode: 0, timedOut: true }), "timeout");
    assert.strictEqual(mapStatus({ exitCode: 0, outputExceeded: true }), "output_limit");
    assert.strictEqual(
      mapStatus({ exitCode: 1, stderr: "SyntaxError: invalid syntax" }),
      "compile_error"
    );
    assert.strictEqual(
      mapStatus({ exitCode: 1, stderr: "IndentationError: unexpected indent" }),
      "compile_error"
    );
    assert.strictEqual(
      mapStatus({ exitCode: 1, stderr: "ZeroDivisionError: division by zero" }),
      "runtime_error"
    );
  });
});

test("Integration Tests: Real Docker Container Execution", { concurrency: 1, timeout: 360000 }, async (t) => {
  clearCache();

  // 1. Python real execution: print(2+2)
  await t.test("Python: executes print(2+2) -> accepted with output 4", { timeout: 90000 }, async () => {
    const res = await runCode({
      language: "python",
      code: "print(2 + 2)"
    });

    assert.strictEqual(res.status, "accepted");
    assert.strictEqual(res.stdout.trim(), "4");
    assert.strictEqual(res.stderr, "");
    assert.ok(res.timeMs >= 0);
  });

  // 2. Node real execution: console.log(2+2)
  await t.test("Node.js: executes console.log(2+2) -> accepted with output 4", { timeout: 90000 }, async () => {
    const res = await runCode({
      language: "javascript",
      code: "console.log(2 + 2);"
    });

    assert.strictEqual(res.status, "accepted");
    assert.strictEqual(res.stdout.trim(), "4");
    assert.strictEqual(res.stderr, "");
    assert.ok(res.timeMs >= 0);
    assert.ok(res.containerStartupMs > 0, "Container/interpreter startup should be measured separately");
    assert.ok(res.programTimeMs >= 0, "Program execution time should be measured separately");
    assert.ok(res.queueWaitMs >= 0, "Queue wait should be measured separately");
  });

  await t.test("Short programs survive concurrent queue and container startup", { timeout: 120000 }, async () => {
    const results = await Promise.all([0, 1, 2].map(index => runCode({
      language: "javascript",
      code: `console.log("queued-${index}");`,
      timeLimitMs: 5000,
      useCache: false
    })));

    for (let index = 0; index < results.length; index++) {
      assert.strictEqual(results[index].status, "accepted");
      assert.strictEqual(results[index].stdout.trim(), `queued-${index}`);
      assert.ok(results[index].queueWaitMs >= 0);
      assert.ok(results[index].containerStartupMs > 0);
      assert.ok(results[index].programTimeMs >= 0);
    }
    assert.ok(results.some(result => result.queueWaitMs > 0), "One concurrent run should report queue waiting");
  });

  // 3. Infinite loop timeout handling
  await t.test("Python: infinite loop triggers timeout status and terminates", { timeout: 90000 }, async () => {
    const res = await runCode({
      language: "python",
      code: "while True: pass",
      timeLimitMs: 1500
    });

    assert.strictEqual(res.status, "timeout");
    assert.ok(res.stderr.includes("timed out"), "Stderr should report timeout notice");
    assert.ok(res.programTimeMs >= 1500, "The full user-code timeout must begin after startup");
  });

  // 4. Syntax error handling
  await t.test("Python: syntax error maps to compile_error", { timeout: 90000 }, async () => {
    const res = await runCode({
      language: "python",
      code: "def invalid_syntax(:"
    });

    assert.strictEqual(res.status, "compile_error");
    assert.ok(res.stderr.includes("SyntaxError"));
  });

  // 5. JavaScript syntax error handling
  await t.test("Node.js: syntax error maps to compile_error", { timeout: 90000 }, async () => {
    const res = await runCode({
      language: "javascript",
      code: "const bad = ;"
    });

    assert.strictEqual(res.status, "compile_error");
    assert.ok(res.stderr.includes("SyntaxError"));
  });

  // 6. Caching of identical execution
  await t.test("Cache: re-running identical code returns cached result with 0ms", { timeout: 90000 }, async () => {
    const code = "print('CACHED_TEST_OUTPUT')";
    const run1 = await runCode({ language: "python", code });
    assert.strictEqual(run1.status, "accepted");
    assert.strictEqual(run1.stdout.trim(), "CACHED_TEST_OUTPUT");

    const run2 = await runCode({ language: "python", code });
    assert.strictEqual(run2.status, "accepted");
    assert.strictEqual(run2.stdout.trim(), "CACHED_TEST_OUTPUT");
    assert.strictEqual(run2.cached, true);
    assert.strictEqual(run2.timeMs, 0);
  });
});
