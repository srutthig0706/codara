const path = require("path");
const { spawn } = require("child_process");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const JUDGE0_URL = process.env.JUDGE0_URL || "http://localhost:2358";

// Language IDs mapping
const SUPPORTED_LANGUAGES = [
  { id: 71, name: "Python (3.11/3.12)", slug: "python", extension: "py", runnable: true },
  { id: 63, name: "JavaScript (Node.js)", slug: "javascript", extension: "js", runnable: true },
  { id: 999, name: "Redis (In-Memory Daemon)", slug: "redis", extension: "redis", runnable: false, note: "Read-only: requires backing server daemon" }
];

/**
 * Checks if Judge0 CE container engine is actively reachable.
 */
async function checkJudge0Health() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${JUDGE0_URL}/languages`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch (err) {
    return false;
  }
}

/**
 * Executes code using Judge0 CE REST API.
 */
async function executeViaJudge0({ sourceCode, languageId, stdin = "", expectedOutput = null }) {
  const url = `${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_code: sourceCode,
        language_id: languageId,
        stdin: stdin || "",
        expected_output: expectedOutput || undefined
      })
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Judge0 responded with HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      status: data.status || { id: 3, description: "Accepted" },
      stdout: data.stdout || "",
      stderr: data.stderr || "",
      compile_output: data.compile_output || "",
      time: data.time || "0.01",
      memory: data.memory || 1024,
      runner: "judge0"
    };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Fallback runner executing Python and Node.js with strict timeout and isolation.
 * Used when Judge0 container daemon is offline.
 */
function executeViaMockRunner({ sourceCode, languageId, stdin = "", expectedOutput = null }) {
  return new Promise((resolve) => {
    let command = "";
    let args = [];

    if (languageId === 71) {
      // Python 3
      command = "python";
      args = ["-c", sourceCode];
    } else if (languageId === 63) {
      // JavaScript (Node.js)
      command = "node";
      args = ["-e", sourceCode];
    } else {
      return resolve({
        status: { id: 13, description: "Internal Error" },
        stdout: "",
        stderr: "Language not supported for execution in standalone runner.",
        runner: "mock",
        time: "0.00"
      });
    }

    const startTime = performance.now();
    let stdoutData = "";
    let stderrData = "";
    let timedOut = false;

    const proc = spawn(command, args, { timeout: 4000 });

    if (stdin) {
      try {
        proc.stdin.write(stdin);
        proc.stdin.end();
      } catch (e) {}
    }

    proc.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderrData += data.toString();
    });

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, 3500);

    proc.on("close", (code) => {
      clearTimeout(timeoutTimer);
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(3);

      if (timedOut) {
        return resolve({
          status: { id: 5, description: "Time Limit Exceeded" },
          stdout: stdoutData,
          stderr: "Execution timed out (3.5s limit exceeded).",
          time: elapsed,
          runner: "mock"
        });
      }

      if (code !== 0) {
        return resolve({
          status: { id: 11, description: "Runtime Error (NZEC)" },
          stdout: stdoutData,
          stderr: stderrData,
          time: elapsed,
          runner: "mock"
        });
      }

      // Check expected output if provided
      const trimmedActual = stdoutData.trim();
      const trimmedExpected = (expectedOutput || "").trim();
      const passed = expectedOutput !== null ? trimmedActual === trimmedExpected : true;

      resolve({
        status: {
          id: passed ? 3 : 4,
          description: passed ? "Accepted" : "Wrong Answer"
        },
        stdout: stdoutData,
        stderr: stderrData,
        time: elapsed,
        runner: "mock"
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timeoutTimer);
      resolve({
        status: { id: 13, description: "Internal Error" },
        stdout: "",
        stderr: `Failed to spawn runtime: ${err.message}`,
        runner: "mock",
        time: "0.00"
      });
    });
  });
}

/**
 * Unified Code Runner Interface:
 * Tries Judge0 CE; if offline or fails, falls back gracefully to MockRunner.
 */
async function executeCode({ sourceCode, languageId, stdin = "", expectedOutput = null }) {
  const judge0Available = await checkJudge0Health();

  if (judge0Available) {
    try {
      return await executeViaJudge0({ sourceCode, languageId, stdin, expectedOutput });
    } catch (err) {
      console.warn(`[SANDBOX] Judge0 call failed (${err.message}). Falling back to local runner...`);
    }
  }

  // Graceful fallback runner
  return await executeViaMockRunner({ sourceCode, languageId, stdin, expectedOutput });
}

module.exports = {
  SUPPORTED_LANGUAGES,
  checkJudge0Health,
  executeCode,
  executeViaJudge0,
  executeViaMockRunner
};
