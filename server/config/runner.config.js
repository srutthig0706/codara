const path = require("path");

module.exports = {
  RUNNER_DIR: path.resolve(__dirname, "../../.runs"),
  DEFAULT_TIMEOUT_MS: 5000,
  MAX_CONCURRENCY: 2,
  MAX_OUTPUT_BYTES: 64 * 1024, // 64 KB
  PYTHON_IMAGE: "python:3.12-slim",
  NODE_IMAGE: "node:22-slim",
  CONTAINER_CPU: "0.5",
  CONTAINER_MEMORY: "128m",
  CONTAINER_MEMORY_SWAP: "128m",
  CONTAINER_PIDS_LIMIT: 64,
  CONTAINER_TMPFS: "/tmp:rw,size=16m",
  CONTAINER_USER: "1000:1000"
};
