const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const { connectDB, pingDB } = require("./config/db");
const { loadChunksIntoMemory } = require("./services/rag.service");

const app = express();
const PORT = process.env.PORT || 5000;
const JUDGE0_URL = process.env.JUDGE0_URL || "http://localhost:2358";

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require("./routes/auth.routes");
const techRoutes = require("./routes/tech.routes");
const aiRoutes = require("./routes/ai.routes");
const sandboxRoutes = require("./routes/sandbox.routes");
app.use("/api/auth", authRoutes);
app.use("/api/technologies", techRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/sandbox", sandboxRoutes);

// Pre-flight health check endpoint
const { checkDockerHealth } = require("./services/sandbox.service");

app.get("/api/health", async (req, res) => {
  const mongoOk = await pingDB();
  const dockerOk = await checkDockerHealth();

  const allHealthy = mongoOk;
  return res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "ok" : "degraded",
    server: "running",
    mongo: mongoOk ? "connected" : "disconnected",
    dockerRunner: dockerOk ? "ready" : "offline",
    judge0: "offline",
    timestamp: new Date().toISOString()
  });
});

// Root ping
app.get("/", (req, res) => {
  res.json({ name: "Codara API", status: "online", docs: "/docs" });
});

let serverInstance = null;

async function startServer() {
  try {
    const db = await connectDB();
    await loadChunksIntoMemory(db);
    serverInstance = app.listen(PORT, () => {
      console.log(`[Codara Server] Listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("[Codara Server] Startup failed:", err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
