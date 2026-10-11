require("dotenv").config();
const { MongoClient } = require("mongodb");
const { spawn } = require("child_process");
const runnerConfig = require("./config/runner.config");

const placeholders = ["your_jwt_secret_key", "your_gemini_api_key", "your_groq_api_key"];
const report = (name, ok, detail = "") =>
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? " - " + detail : ""}`);

async function checkDocker() {
  return new Promise((resolve) => {
    const versionProc = spawn("docker", ["version", "--format", "{{.Server.Version}}"]);
    let verOut = "";
    versionProc.stdout.on("data", (d) => { verOut += d.toString(); });
    versionProc.on("close", (code) => {
      if (code !== 0 || !verOut.trim()) {
        return resolve({ ok: false, detail: "Docker daemon not responding" });
      }

      // Check images
      const imgProc = spawn("docker", [
        "image",
        "inspect",
        runnerConfig.PYTHON_IMAGE,
        runnerConfig.NODE_IMAGE,
        "--format",
        "{{.RepoTags}}"
      ]);
      imgProc.on("close", (imgCode) => {
        if (imgCode !== 0) {
          return resolve({ ok: false, detail: "Images missing (python:3.12-slim / node:22-slim)" });
        }
        resolve({ ok: true, detail: "daemon active, images pre-pulled (python & node)" });
      });
      imgProc.on("error", (err) => resolve({ ok: false, detail: err.message }));
    });
    versionProc.on("error", (err) => resolve({ ok: false, detail: err.message }));
  });
}

async function main() {
  const { PORT, MONGO_URI, JWT_SECRET, GEMINI_API_KEY, GROQ_API_KEY } = process.env;

  report("PORT", !!PORT && !isNaN(Number(PORT)), PORT);

  const jwtOk = !!JWT_SECRET && !placeholders.includes(JWT_SECRET) && JWT_SECRET.length >= 32;
  report("JWT_SECRET", jwtOk, jwtOk ? "" : "placeholder, missing, or shorter than 32 characters");

  try {
    const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 4000 });
    await client.connect();
    await client.db().command({ ping: 1 });
    await client.close();
    report("MONGO_URI", true, "connected");
  } catch (e) {
    report("MONGO_URI", false, e.message);
  }

  try {
    if (!GEMINI_API_KEY || placeholders.includes(GEMINI_API_KEY)) throw new Error("missing or placeholder");
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": GEMINI_API_KEY },
    });
    report("GEMINI_API_KEY", r.ok, `HTTP ${r.status}`);
  } catch (e) {
    report("GEMINI_API_KEY", false, e.message);
  }

  try {
    if (!GROQ_API_KEY || placeholders.includes(GROQ_API_KEY)) throw new Error("missing or placeholder");
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    });
    report("GROQ_API_KEY", r.ok, `HTTP ${r.status}`);
  } catch (e) {
    report("GROQ_API_KEY", false, e.message);
  }

  const dockerStatus = await checkDocker();
  report("DOCKER_RUNNER", dockerStatus.ok, dockerStatus.detail);
}

main();