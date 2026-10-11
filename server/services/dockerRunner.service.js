const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const config = require("../config/runner.config");

// In-memory cache for execution results (SHA-256 key -> result)
const executionCache = new Map();
const MAX_CACHE_ENTRIES = 500;
const STARTUP_GRACE_MS = 30_000;
const DOCKER_COMMAND_TIMEOUT_MS = 10_000;

// Concurrency Semaphore (max 2 concurrent runs)
let activeRuns = 0;
const runQueue = [];

function acquireSlot(maxWaitMs) {
  if (activeRuns < config.MAX_CONCURRENCY) {
    activeRuns++;
    return Promise.resolve(true);
  }
  return new Promise(resolve => {
    const queued = {
      grant: () => {
        clearTimeout(queued.timeout);
        activeRuns++;
        resolve(true);
      },
      timeout: setTimeout(() => {
        const queueIndex = runQueue.indexOf(queued);
        if (queueIndex !== -1) runQueue.splice(queueIndex, 1);
        resolve(false);
      }, maxWaitMs)
    };
    runQueue.push(queued);
  });
}

function buildEntryCommand(language, scriptName) {
  return language === "python"
    ? ["python", "-u", `/app/${scriptName}`]
    : ["node", "--require", "/app/runner-start.js", `/app/${scriptName}`];
}

function writeRuntimeBootstrap(hostDir, language, runtimeMarker) {
  const bootstrapName = language === "python" ? "sitecustomize.py" : "runner-start.js";
  const bootstrap = language === "python"
    ? `import os\nos.write(2, ${JSON.stringify(runtimeMarker)}.encode("utf-8"))\n`
    : `require("fs").writeSync(2, ${JSON.stringify(runtimeMarker)});\n`;
  fs.writeFileSync(path.join(hostDir, bootstrapName), bootstrap, "utf-8");
  return bootstrapName;
}

function releaseSlot() {
  activeRuns--;
  if (runQueue.length > 0) {
    const next = runQueue.shift();
    next.grant();
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
  const launchCmd = buildEntryCommand(language, scriptName);

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
    ...(language === "python" ? ["--env", "PYTHONPATH=/app"] : []),
    image,
    ...launchCmd
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

function killContainerProcess(proc, containerName) {
  try {
    spawn("docker", ["rm", "-f", containerName]);
  } catch (err) {
    console.error(`[Docker Runner] Failed to request container cleanup: ${err.message}`);
  }
  try {
    proc.kill("SIGKILL");
  } catch (err) {
    console.error(`[Docker Runner] Failed to stop Docker process: ${err.message}`);
  }
}

function runDockerCommand(args, timeoutMs = DOCKER_COMMAND_TIMEOUT_MS) {
  return new Promise(resolve => {
    const proc = spawn("docker", args);
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill("SIGKILL");
      } catch (err) {
        console.error(`[Docker Runner] Failed to stop timed-out Docker command: ${err.message}`);
      }
    }, timeoutMs);

    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ ...result, stdout, stderr, timedOut });
    };
    proc.stdout.on("data", chunk => { stdout += chunk.toString(); });
    proc.stderr.on("data", chunk => { stderr += chunk.toString(); });
    proc.on("error", err => finish({ code: -1, error: err.message }));
    proc.on("close", code => finish({ code, error: null }));
  });
}

function monitorContainerExecution({ proc, containerName, runtimeMarker, timeLimitMs }) {
  return new Promise(resolve => {
    const startedAt = performance.now();
    let rawStdout = "";
    let rawStderr = "";
    let timedOut = false;
    let startupTimedOut = false;
    let outputExceeded = false;
    let mountErrorDetected = false;
    let runtimeStartedAt = null;
    let settled = false;
    let runtimeTimer = null;
    let startupTimer = setTimeout(() => {
      if (runtimeStartedAt !== null) return;
      startupTimedOut = true;
      killContainerProcess(proc, containerName);
    }, STARTUP_GRACE_MS);
    const overallTimer = setTimeout(() => {
      startupTimedOut = runtimeStartedAt === null;
      killContainerProcess(proc, containerName);
    }, timeLimitMs + STARTUP_GRACE_MS);

    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(overallTimer);
      clearTimeout(startupTimer);
      if (runtimeTimer) clearTimeout(runtimeTimer);
      resolve(result);
    };

    const capOutput = () => {
      if (Buffer.byteLength(rawStdout, "utf-8") > config.MAX_OUTPUT_BYTES ||
          Buffer.byteLength(rawStderr, "utf-8") > config.MAX_OUTPUT_BYTES) {
        outputExceeded = true;
        try {
          proc.kill("SIGKILL");
        } catch (err) {
          console.error(`[Docker Runner] Failed to stop output-limited process: ${err.message}`);
        }
      }
    };

    proc.stdout.on("data", chunk => {
      rawStdout += chunk.toString();
      capOutput();
    });
    proc.stderr.on("data", chunk => {
      rawStderr += chunk.toString();
      if (rawStderr.includes("docker: Error response from daemon") && rawStderr.includes("mount")) {
        mountErrorDetected = true;
      }
      if (runtimeStartedAt === null && rawStderr.includes(runtimeMarker)) {
        runtimeStartedAt = performance.now();
        clearTimeout(startupTimer);
        startupTimer = null;
        rawStderr = rawStderr.replace(runtimeMarker, "");
        runtimeTimer = setTimeout(() => {
          timedOut = true;
          killContainerProcess(proc, containerName);
        }, timeLimitMs);
      }
      capOutput();
    });
    proc.on("error", err => {
      finish({
        status: "runner_unavailable",
        stdout: "",
        stderr: `Failed to spawn docker process: ${err.message}`,
        timeMs: Math.round(performance.now() - startedAt),
        containerStartupMs: null,
        programTimeMs: null
      });
    });
    proc.on("close", exitCode => {
      const endedAt = performance.now();
      if (mountErrorDetected && !timedOut && !startupTimedOut) {
        finish({ needsFallback: true });
        return;
      }

      const stdoutTrunc = truncateOutput(rawStdout);
      const stderrTrunc = truncateOutput(rawStderr);
      if (stdoutTrunc.truncated || stderrTrunc.truncated) outputExceeded = true;

      let status;
      let stderr = stderrTrunc.text;
      if (startupTimedOut && !timedOut) {
        status = "runner_unavailable";
        stderr = `Container startup exceeded hard cap (${STARTUP_GRACE_MS}ms).`;
      } else {
        status = mapStatus({
          exitCode: exitCode ?? -1,
          timedOut,
          outputExceeded,
          stderr: stderrTrunc.text
        });
        if (timedOut) stderr = `Execution timed out (${timeLimitMs}ms user-code limit exceeded).`;
      }

      finish({
        status,
        stdout: stdoutTrunc.text,
        stderr,
        timeMs: Math.round(endedAt - startedAt),
        containerStartupMs: runtimeStartedAt === null ? null : Math.round(runtimeStartedAt - startedAt),
        programTimeMs: runtimeStartedAt === null ? null : Math.round(endedAt - runtimeStartedAt)
      });
    });
  });
}

/**
 * Checks if Docker is available and required runner images exist.
 */
async function checkDockerAvailable() {
  try {
    const versionResult = await runDockerCommand(["version", "--format", "{{.Server.Version}}"]);
    if (versionResult.timedOut || versionResult.code !== 0 || !versionResult.stdout.trim()) {
      return { available: false, reason: "Docker daemon is not running or CLI is unreachable" };
    }
  } catch (err) {
    return { available: false, reason: `Docker unreachable: ${err.message}` };
  }

  try {
    const imageResult = await runDockerCommand([
      "image",
      "inspect",
      config.PYTHON_IMAGE,
      config.NODE_IMAGE,
      "--format",
      "{{.RepoTags}}"
    ]);
    if (imageResult.timedOut || imageResult.code !== 0) {
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
  timeLimitMs,
  runtimeMarker
}) {
  const startTime = performance.now();
  const entryCmd = buildEntryCommand(language, scriptName);
  const bootstrapName = language === "python" ? "sitecustomize.py" : "runner-start.js";

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
    ...(language === "python" ? ["--env", "PYTHONPATH=/app"] : []),
    image,
    ...entryCmd
  ];

  const createResult = await runDockerCommand(createArgs);
  if (createResult.timedOut || createResult.code !== 0) {
    return {
      status: "runner_unavailable",
      stdout: "",
      stderr: "Fallback container creation failed.",
      timeMs: Math.round(performance.now() - startTime)
    };
  }

  try {
    // 2. docker cp script and runtime marker into container
    for (const filename of [scriptName, bootstrapName]) {
      const cpResult = await runDockerCommand([
        "cp",
        path.join(hostDir, filename),
        `${containerName}:/app/${filename}`
      ]);
      if (cpResult.timedOut || cpResult.code !== 0) {
        return {
          status: "runner_unavailable",
          stdout: "",
          stderr: "Fallback file copy to container failed.",
          timeMs: Math.round(performance.now() - startTime)
        };
      }
    }

    // 3. docker start -a -i
    const prepStartTime = performance.now();
    const proc = spawn("docker", ["start", "-a", "-i", containerName]);
    try {
      if (stdin) proc.stdin.write(stdin);
      proc.stdin.end();
    } catch (err) {
      console.error(`[Docker Runner] Failed to forward fallback stdin: ${err.message}`);
    }
    const result = await monitorContainerExecution({
      proc,
      containerName,
      runtimeMarker,
      timeLimitMs
    });
    return {
      ...result,
      timeMs: Math.round(performance.now() - startTime),
      containerStartupMs: result.containerStartupMs === null
        ? null
        : result.containerStartupMs + Math.round(prepStartTime - startTime)
    };
  } finally {
    try {
      spawn("docker", ["rm", "-f", containerName]);
    } catch (err) {
      console.error(`[Docker Runner] Failed to request fallback cleanup: ${err.message}`);
    }
  }
}

/**
 * Core runner function adhering to:
 * runCode({ language, code, stdin, timeLimitMs, useCache }) -> { status, stdout, stderr, timeMs }
 */
async function runCode({
  language,
  code,
  stdin = "",
  timeLimitMs = config.DEFAULT_TIMEOUT_MS,
  useCache = true
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
  if (useCache && executionCache.has(cacheKey)) {
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

  // Queue time is measured separately and is not charged against user execution.
  const queueStartedAt = performance.now();
  const acquired = await acquireSlot(timeLimitMs + STARTUP_GRACE_MS);
  const queueWaitMs = Math.round(performance.now() - queueStartedAt);
  if (!acquired) {
    return {
      status: "runner_unavailable",
      stdout: "",
      stderr: `Code runner queue exceeded hard cap (${timeLimitMs + STARTUP_GRACE_MS}ms).`,
      timeMs: 0,
      queueWaitMs
    };
  }

  const runId = `run-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const containerName = `codara-${runId}`;
  const hostDir = path.resolve(config.RUNNER_DIR, runId);
  const scriptName = normLang === "python" ? "script.py" : "script.js";
  const image = normLang === "python" ? config.PYTHON_IMAGE : config.NODE_IMAGE;

  try {
    // Ensure .runs directory exists
    fs.mkdirSync(hostDir, { recursive: true });
    fs.writeFileSync(path.join(hostDir, scriptName), code, "utf-8");

    const runtimeMarker = `CODARA_RUNTIME_STARTED_${crypto.randomBytes(16).toString("hex")}`;
    writeRuntimeBootstrap(hostDir, normLang, runtimeMarker);
    const runArgs = buildDockerRunArgs({
      containerName,
      hostDir,
      language: normLang,
      image
    });

    const proc = spawn("docker", runArgs);
    try {
      if (stdin) proc.stdin.write(stdin);
      proc.stdin.end();
    } catch (err) {
      console.error(`[Docker Runner] Failed to forward stdin: ${err.message}`);
    }
    const runResult = await monitorContainerExecution({
      proc,
      containerName,
      runtimeMarker,
      timeLimitMs
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
        timeLimitMs,
        runtimeMarker
      });
    }
    finalOutput.queueWaitMs = queueWaitMs;

    // Cache valid results (do not cache timeouts or runner_unavailable errors)
    if (useCache && finalOutput.status !== "timeout" && finalOutput.status !== "runner_unavailable") {
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
