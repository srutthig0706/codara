const express = require("express");
const authMiddleware = require("../middleware/auth");
const { sandboxRateLimiter } = require("../middleware/rateLimiter");
const { 
  SUPPORTED_LANGUAGES, 
  checkDockerHealth,
  checkJudge0Health, 
  executeCode 
} = require("../services/sandbox.service");

const router = express.Router();

// GET /api/sandbox/status - check execution runner status and available languages
router.get("/status", async (req, res) => {
  const isDockerOnline = await checkDockerHealth();
  return res.status(200).json({
    dockerOnline: isDockerOnline,
    judge0Online: false,
    activeRunner: isDockerOnline ? "docker" : "runner_unavailable",
    supportedLanguages: SUPPORTED_LANGUAGES,
    note: isDockerOnline 
      ? "Docker container runner is active (isolated throwaway containers)." 
      : "Docker is offline or required runner images are missing."
  });
});

// POST /api/sandbox/execute - execute code in sandbox
router.post("/execute", authMiddleware, sandboxRateLimiter, async (req, res) => {
  try {
    const { sourceCode, languageId, stdin, expectedOutput } = req.body;

    if (!sourceCode || typeof sourceCode !== "string") {
      return res.status(400).json({ error: "sourceCode string is required." });
    }

    const langId = Number(languageId);
    if (!langId) {
      return res.status(400).json({ error: "Valid numeric languageId is required." });
    }

    if (langId === 999) {
      return res.status(400).json({
        error: "Redis requires an external background server daemon and cannot be executed as a standalone script.",
        readOnly: true
      });
    }

    const result = await executeCode({
      sourceCode,
      languageId: langId,
      stdin: stdin || "",
      expectedOutput: expectedOutput || null
    });

    return res.status(200).json({ execution: result });
  } catch (err) {
    console.error("[SANDBOX] Execution error:", err.message);
    return res.status(500).json({ error: "Failed to execute submission in sandbox." });
  }
});

module.exports = router;
