const { spawn } = require("child_process");
const { runCode, checkDockerAvailable } = require("./dockerRunner.service");

// Language IDs mapping
const SUPPORTED_LANGUAGES = [
  { id: 71, name: "Python (3.11/3.12)", slug: "python", extension: "py", runnable: true },
  { id: 63, name: "JavaScript (Node.js)", slug: "javascript", extension: "js", runnable: true },
  { id: 999, name: "Redis (In-Memory Daemon)", slug: "redis", extension: "redis", runnable: false, note: "Read-only: requires backing server daemon" }
];

const STATUS_MAP = {
  accepted: { id: 3, description: "Accepted" },
  ran: { id: 3, description: "Accepted" },
  wrong_answer: { id: 4, description: "Wrong Answer" },
  timeout: { id: 5, description: "Time Limit Exceeded" },
  compile_error: { id: 6, description: "Compilation Error" },
  runtime_error: { id: 11, description: "Runtime Error" },
  output_limit: { id: 12, description: "Output Limit Exceeded" },
  runner_unavailable: { id: 13, description: "Runner Unavailable" }
};

/**
 * Checks if Docker runner is ready and pre-pulled images are present.
 */
async function checkDockerHealth() {
  const result = await checkDockerAvailable();
  return result.available;
}

/**
 * Backward-compatible alias for existing health routes.
 */
async function checkJudge0Health() {
  return await checkDockerHealth();
}

/**
 * Mock runner kept strictly for unit testing offline paths.
 * Never used to label real examples "verified".
 */
function executeViaMockRunner({ sourceCode, languageId, stdin = "", expectedOutput = null }) {
  return new Promise((resolve) => {
    let command = "";
    let args = [];

    if (languageId === 71) {
      command = "python";
      args = ["-c", sourceCode];
    } else if (languageId === 63) {
      command = "node";
      args = ["-e", sourceCode];
    } else {
      return resolve({
        status: { id: 13, description: "Internal Error" },
        stdout: "",
        stderr: "Language not supported for execution in mock runner.",
        runner: "mock",
        time: "0.00",
        timeMs: 0
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
      const elapsedMs = Math.round(performance.now() - startTime);
      const elapsed = (elapsedMs / 1000).toFixed(3);

      if (timedOut) {
        return resolve({
          status: { id: 5, description: "Time Limit Exceeded" },
          statusName: "timeout",
          stdout: stdoutData,
          stderr: "Execution timed out (3.5s limit exceeded).",
          time: elapsed,
          timeMs: elapsedMs,
          runner: "mock"
        });
      }

      if (code !== 0) {
        return resolve({
          status: { id: 11, description: "Runtime Error (NZEC)" },
          statusName: "runtime_error",
          stdout: stdoutData,
          stderr: stderrData,
          time: elapsed,
          timeMs: elapsedMs,
          runner: "mock"
        });
      }

      const trimmedActual = stdoutData.trim();
      const trimmedExpected = (expectedOutput || "").trim();
      const passed = expectedOutput !== null ? trimmedActual === trimmedExpected : true;

      resolve({
        status: {
          id: passed ? 3 : 4,
          description: passed ? "Accepted" : "Wrong Answer"
        },
        statusName: passed ? "accepted" : "wrong_answer",
        stdout: stdoutData,
        stderr: stderrData,
        time: elapsed,
        timeMs: elapsedMs,
        runner: "mock"
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timeoutTimer);
      resolve({
        status: { id: 13, description: "Internal Error" },
        statusName: "runner_unavailable",
        stdout: "",
        stderr: `Failed to spawn mock runtime: ${err.message}`,
        runner: "mock",
        time: "0.00",
        timeMs: 0
      });
    });
  });
}

/**
 * Unified Code Runner Interface:
 * Executes code via the Docker container runner with backward compatibility for status ids.
 */
async function executeCode({ sourceCode, languageId, stdin = "", expectedOutput = null, timeLimitMs }) {
  let langSlug = null;
  if (languageId === 71 || languageId === "71" || languageId === "python") langSlug = "python";
  if (languageId === 63 || languageId === "63" || languageId === "javascript") langSlug = "javascript";

  if (!langSlug) {
    return {
      status: { id: 13, description: "Runner Unavailable" },
      statusName: "runner_unavailable",
      stdout: "",
      stderr: "Language not supported for sandboxed execution.",
      time: "0.00",
      timeMs: 0,
      runner: "docker"
    };
  }

  const result = await runCode({
    language: langSlug,
    code: sourceCode,
    stdin: stdin || "",
    timeLimitMs
  });

  let statusName = result.status;
  if (statusName === "accepted" && expectedOutput !== null) {
    const trimmedActual = (result.stdout || "").trim();
    const trimmedExpected = String(expectedOutput).trim();
    if (trimmedActual !== trimmedExpected) {
      statusName = "wrong_answer";
    }
  }

  const statusObj = STATUS_MAP[statusName] || { id: 13, description: statusName };

  return {
    status: statusObj,
    statusName,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    timeMs: result.timeMs ?? 0,
    time: ((result.timeMs ?? 0) / 1000).toFixed(3),
    runner: "docker"
  };
}

module.exports = {
  SUPPORTED_LANGUAGES,
  checkDockerHealth,
  checkJudge0Health,
  executeCode,
  runCode,
  executeViaMockRunner
};
