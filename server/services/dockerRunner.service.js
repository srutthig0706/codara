const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const config = require("../config/runner.config");

// In-memory cache for execution results (SHA-256 key -> result)
const executionCache = new Map();
const MAX_CACHE_ENTRIES = 500;

// Concurrency Semaphore (max 2 concurrent runs)
let activeRuns = 0;
const runQueue = [];

function acquireSlot() {
  if (activeRuns < config.MAX_CONCURRENCY) {
    activeRuns++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    runQueue.push(resolve);
  });
}

function releaseSlot() {
  activeRuns--;
  if (runQueue.length > 0) {
    activeRuns++;
    const next = runQueue.shift();
    next();
  }
}

/**
 * Normalizes language string to 'python' or 'javascript'.
 */
function normalizeLanguage(lang) {
  if (!lang) return null;
  const l = String(lang).toLowerCase().trim();
  if (l === "python" || l === "py" || l === "71") return "python";
  if (l === "javascript" || l === "js" || l === "node" || l === "nodejs" || l === "63") return "javascript";
  return null;
}

/**
 * Pure function: Builds arguments array for docker run.
 * Guaranteed to be an array of arguments; never a shell string.
 */
function buildDockerRunArgs({
  containerName,
  hostDir,
  language,
  image,
  memory = config.CONTAINER_MEMORY,
  memorySwap = config.CONTAINER_MEMORY_SWAP,
  cpus = config.CONTAINER_CPU,
  pidsLimit = config.CONTAINER_PIDS_LIMIT,
  tmpfs = config.CONTAINER_TMPFS,
  user = config.CONTAINER_USER
}) {
  const scriptName = language === "python" ? "script.py" : "script.js";
  const entryCmd = language === "python"
    ? ["python", "-u", `/app/${scriptName}`]
    : ["node", `/app/${scriptName}`];

  return [
    "run",
    "--rm",
    "-i",
    "--name", containerName,
    "--network", "none",
    "--memory", memory,
    "--memory-swap", memorySwap,
    "--cpus", String(cpus),
    "--pids-limit", String(pidsLimit),
    "--read-only",
    "--tmpfs", tmpfs,
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--user", user,
    "-v", `${hostDir}:/app:ro`,
    image,
    ...entryCmd
  ];
}

/**
 * Pure function: Truncates output to maxBytes and appends notice if truncated.
 */
function truncateOutput(text = "", maxBytes = config.MAX_OUTPUT_BYTES) {
  if (typeof text !== "string") text = String(text || "");
  const byteLen = Buffer.byteLength(text, "utf-8");
  if (byteLen <= maxBytes) {
    return { text, truncated: false };
  }

  // Truncate safely within byte limit
  const buf = Buffer.from(text, "utf-8").subarray(0, maxBytes);
  const truncatedStr = buf.toString("utf-8");
  const notice = "\n[Output truncated: exceeded 64 KB limit]";
  return {
    text: truncatedStr + notice,
    truncated: true
  };
}

/**
 * Pure function: Computes SHA-256 cryptographic cache key.
 */
function computeCacheKey({ language, code, stdin = "" }) {
  const normLang = normalizeLanguage(language) || String(language);
  const payload = `${normLang}:${code}:${stdin || ""}`;
  return crypto.createHash("sha256").update(payload, "utf-8").digest("hex");
}

/**
 * Pure function: Maps execution results to standardized statuses.
 */
function mapStatus({ exitCode, timedOut, outputExceeded, stderr = "" }) {
  if (timedOut) return "timeout";
  if (outputExceeded) return "output_limit";
  if (exitCode === 0) return "accepted";

  // Check for compile / syntax errors
  if (
    stderr.includes("SyntaxError:") ||
    stderr.includes("IndentationError:") ||
    stderr.includes("TabError:")
  ) {
    return "compile_error";
  }

  return "runtime_error";
}

/**
 * Checks if Docker is available and required runner images exist.
 */
async function checkDockerAvailable() {
  try {
    const versionProc = spawn("docker", ["version", "--format", "{{.Server.Version}}"]);
    let out = "";
    versionProc.stdout.on("data", (d) => { out += d.toString(); });
    const code = await new Promise((resolve) => {
      versionProc.on("close", resolve);
      versionProc.on("error", () => resolve(-1));
    });

    if (code !== 0 || !out.trim()) {
      return { available: false, reason: "Docker daemon is not running or CLI is unreachable" };
    }
  } catch (err) {
    return { available: false, reason: `Docker unreachable: ${err.message}` };
  }

  try {
    const imgProc = spawn("docker", [
      "image",
      "inspect",
      config.PYTHON_IMAGE,
      config.NODE_IMAGE,
      "--format",
      "{{.RepoTags}}"
    ]);
    const imgCode = await new Promise((resolve) => {
      imgProc.on("close", resolve);
      imgProc.on("error", () => resolve(-1));
    });

    if (imgCode !== 0) {
      return { available: false, reason: "Required runner images are missing (pre-pulled images required)" };
    }

    return { available: true };
  } catch (err) {
    return { available: false, reason: `Image inspection failed: ${err.message}` };
  }
}

/**
 * Fallback runner using docker create + docker cp + docker start
 * if volume mounting fails on Windows Docker Desktop.
 */
async function executeWithCpFallback({
  containerName,
  hostDir,
  scriptName,
  image,
  language,
  stdin,
  timeLimitMs
}) {
  const startTime = performance.now();
  const entryCmd = language === "python"
    ? ["python", "-u", `/app/${scriptName}`]
    : ["node", `/app/${scriptName}`];

  // 1. docker create
  const createArgs = [
    "create",
    "-i",
    "--name", containerName,
    "--network", "none",
    "--memory", config.CONTAINER_MEMORY,
    "--memory-swap", config.CONTAINER_MEMORY_SWAP,
    "--cpus", String(config.CONTAINER_CPU),
    "--pids-limit", String(config.CONTAINER_PIDS_LIMIT),
    "--tmpfs", config.CONTAINER_TMPFS,
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--user", config.CONTAINER_USER,
    image,
    ...entryCmd
  ];

  const createProc = spawn("docker", createArgs);
  const createCode = await new Promise((res) => createProc.on("close", res));
  if (createCode !== 0) {
    return {
      status: "runner_unavailable",
      stdout: "",
      stderr: "Fallback container creation failed.",
      timeMs: Math.round(performance.now() - startTime)
    };
  }

  try {
    // 2. docker cp script into container
    const scriptPath = path.join(hostDir, scriptName);
    const cpProc = spawn("docker", ["cp", scriptPath, `${containerName}:/app/${scriptName}`]);
    const cpCode = await new Promise((res) => cpProc.on("close", res));
    if (cpCode !== 0) {
      return {
        status: "runner_unavailable",
        stdout: "",
        stderr: "Fallback file copy to container failed.",
        timeMs: Math.round(performance.now() - startTime)
      };
    }

    // 3. docker start -a -i
    return await new Promise((resolve) => {
      let rawStdout = "";
      let rawStderr = "";
      let timedOut = false;
      let outputExceeded = false;

      const proc = spawn("docker", ["start", "-a", "-i", containerName]);

      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        try {
          spawn("docker", ["rm", "-f", containerName]);
        } catch (e) {}
        try {
          proc.kill("SIGKILL");
        } catch (e) {}
      }, timeLimitMs);

      if (stdin) {
        try {
          proc.stdin.write(stdin);
          proc.stdin.end();
        } catch (e) {}
      } else {
        try {
          proc.stdin.end();
        } catch (e) {}
      }

      proc.stdout.on("data", (chunk) => {
        rawStdout += chunk.toString();
        if (Buffer.byteLength(rawStdout, "utf-8") > config.MAX_OUTPUT_BYTES) {
          outputExceeded = true;
          try { proc.kill("SIGKILL"); } catch (e) {}
        }
      });

      proc.stderr.on("data", (chunk) => {
        rawStderr += chunk.toString();
        if (Buffer.byteLength(rawStderr, "utf-8") > config.MAX_OUTPUT_BYTES) {
          outputExceeded = true;
          try { proc.kill("SIGKILL"); } catch (e) {}
        }
      });

      proc.on("close", (exitCode) => {
        clearTimeout(timeoutTimer);
        const elapsed = Math.round(performance.now() - startTime);

        // Cleanup container
        try { spawn("docker", ["rm", "-f", containerName]); } catch (e) {}

        const stdoutTrunc = truncateOutput(rawStdout);
        const stderrTrunc = truncateOutput(rawStderr);
        if (stdoutTrunc.truncated || stderrTrunc.truncated) outputExceeded = true;

        const finalStatus = mapStatus({
          exitCode: exitCode ?? -1,
          timedOut,
          outputExceeded,
          stderr: stderrTrunc.text
        });

        resolve({
          status: finalStatus,
          stdout: stdoutTrunc.text,
          stderr: timedOut ? `Execution timed out (${timeLimitMs}ms limit exceeded).` : stderrTrunc.text,
          timeMs: elapsed
        });
      });
    });
  } finally {
    try { spawn("docker", ["rm", "-f", containerName]); } catch (e) {}
  }
}

/**
 * Core runner function adhering to:
 * runCode({ language, code, stdin, timeLimitMs }) -> { status, stdout, stderr, timeMs }
 */
async function runCode({
  language,
  code,
  stdin = "",
  timeLimitMs = config.DEFAULT_TIMEOUT_MS
}) {
  const normLang = normalizeLanguage(language);
  if (!normLang) {
    return {
      status: "runner_unavailable",
      stdout: "",
      stderr: `Unsupported language: '${language}'. Supported languages: 'python', 'javascript'.`,
      timeMs: 0
    };
  }

  if (typeof code !== "string" || !code.trim()) {
    return {
      status: "accepted",
      stdout: "",
      stderr: "",
      timeMs: 0
    };
  }

  // Check cache for identical execution
  const cacheKey = computeCacheKey({ language: normLang, code, stdin });
  if (executionCache.has(cacheKey)) {
    const cached = executionCache.get(cacheKey);
    return { ...cached, timeMs: 0, cached: true };
  }

  // Check Docker health before queueing
  const dockerHealth = await checkDockerAvailable();
  if (!dockerHealth.available) {
    return {
      status: "runner_unavailable",
      stdout: "",
      stderr: `Code runner is unavailable: ${dockerHealth.reason}.`,
      timeMs: 0
    };
  }

  // Acquire concurrency slot (max 2 concurrent runs)
  await acquireSlot();

  const runId = `run-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const containerName = `codara-${runId}`;
  const hostDir = path.resolve(config.RUNNER_DIR, runId);
  const scriptName = normLang === "python" ? "script.py" : "script.js";
  const image = normLang === "python" ? config.PYTHON_IMAGE : config.NODE_IMAGE;

  try {
    // Ensure .runs directory exists
    fs.mkdirSync(hostDir, { recursive: true });
    fs.writeFileSync(path.join(hostDir, scriptName), code, "utf-8");

    const startTime = performance.now();
    const runArgs = buildDockerRunArgs({
      containerName,
      hostDir,
      language: normLang,
      image
    });

    const runResult = await new Promise((resolve) => {
      let rawStdout = "";
      let rawStderr = "";
      let timedOut = false;
      let outputExceeded = false;
      let mountErrorDetected = false;

      const proc = spawn("docker", runArgs);

      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        try {
          spawn("docker", ["rm", "-f", containerName]);
        } catch (e) {}
        try {
          proc.kill("SIGKILL");
        } catch (e) {}
      }, timeLimitMs);

      if (stdin) {
        try {
          proc.stdin.write(stdin);
          proc.stdin.end();
        } catch (e) {}
      } else {
        try {
          proc.stdin.end();
        } catch (e) {}
      }

      proc.stdout.on("data", (chunk) => {
        rawStdout += chunk.toString();
        if (Buffer.byteLength(rawStdout, "utf-8") > config.MAX_OUTPUT_BYTES) {
          outputExceeded = true;
          try { proc.kill("SIGKILL"); } catch (e) {}
        }
      });

      proc.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        rawStderr += text;
        if (text.includes("docker: Error response from daemon") && text.includes("mount")) {
          mountErrorDetected = true;
        }
        if (Buffer.byteLength(rawStderr, "utf-8") > config.MAX_OUTPUT_BYTES) {
          outputExceeded = true;
          try { proc.kill("SIGKILL"); } catch (e) {}
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timeoutTimer);
        resolve({
          status: "runner_unavailable",
          stdout: "",
          stderr: `Failed to spawn docker process: ${err.message}`,
          timeMs: Math.round(performance.now() - startTime)
        });
      });

      proc.on("close", (exitCode) => {
        clearTimeout(timeoutTimer);
        const elapsed = Math.round(performance.now() - startTime);

        if (mountErrorDetected) {
          return resolve({ needsFallback: true });
        }

        const stdoutTrunc = truncateOutput(rawStdout);
        const stderrTrunc = truncateOutput(rawStderr);
        if (stdoutTrunc.truncated || stderrTrunc.truncated) outputExceeded = true;

        const finalStatus = mapStatus({
          exitCode: exitCode ?? -1,
          timedOut,
          outputExceeded,
          stderr: stderrTrunc.text
        });

        resolve({
          status: finalStatus,
          stdout: stdoutTrunc.text,
          stderr: timedOut ? `Execution timed out (${timeLimitMs}ms limit exceeded).` : stderrTrunc.text,
          timeMs: elapsed
        });
      });
    });

    let finalOutput = runResult;
    if (runResult.needsFallback) {
      finalOutput = await executeWithCpFallback({
        containerName: `${containerName}-fb`,
        hostDir,
        scriptName,
        image,
        language: normLang,
        stdin,
        timeLimitMs
      });
    }

    // Cache valid results (do not cache timeouts or runner_unavailable errors)
    if (finalOutput.status !== "timeout" && finalOutput.status !== "runner_unavailable") {
      if (executionCache.size >= MAX_CACHE_ENTRIES) {
        const firstKey = executionCache.keys().next().value;
        executionCache.delete(firstKey);
      }
      executionCache.set(cacheKey, finalOutput);
    }

    return finalOutput;
  } finally {
    // Cleanup per-run temporary host directory
    try {
      if (fs.existsSync(hostDir)) {
        fs.rmSync(hostDir, { recursive: true, force: true });
      }
    } catch (e) {
      // Best-effort cleanup
    }
    releaseSlot();
  }
}

/**
 * Resets the in-memory execution cache (for tests).
 */
function clearCache() {
  executionCache.clear();
}

module.exports = {
  runCode,
  buildDockerRunArgs,
  truncateOutput,
  computeCacheKey,
  mapStatus,
  checkDockerAvailable,
  normalizeLanguage,
  clearCache
};
