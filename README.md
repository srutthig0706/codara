# Codara: Interactive Pedagogical Computer Science Platform

Codara is a full-stack, pedagogical developer education platform designed to teach core computer science abstractions and systems through bounded AI, deterministic verification, interactive Monaco coding sandboxes, and structural architecture comparisons in React Flow.

---

## 1. Architectural Philosophy

1. **Deterministic Truth Over AI Grading:** The LLM is strictly prohibited from grading code or assigning quiz scores. Stored database answer keys and sandboxed runtime execution results are the sole arbiters of correctness. The LLM acts exclusively as an explanatory tutor post-execution.
2. **Zero Free-Form Chat:** No open-ended chatbot interfaces. AI is confined to 5 bounded structured actions: *Explain*, *Scenario (With vs. Without)*, *Compare Alternatives*, *Teach to Code*, and *Tests Module*.
3. **Hardened Local Docker Code Runner:** Instead of depending on third-party SaaS APIs or cgroup-incompatible sandbox daemons, Codara executes code in hardened, throwaway Docker containers (`python:3.12-slim` and `node:22-slim`) with strict resource constraints and network isolation.
4. **Local Dense Vector RAG:** In-process CPU embeddings via `@xenova/transformers` (`all-MiniLM-L6-v2`) with cosine similarity search across curated documentation chunks—no external vector database SaaS required.

---

## 2. Prerequisites & Installation

- **Node.js:** v20+ or v22+
- **MongoDB:** Local instance running at `mongodb://localhost:27017/codara`
- **Docker Desktop:** Windows 11 with WSL2 engine active
- **Pre-pulled Runner Images:**
  ```powershell
  docker pull python:3.12-slim
  docker pull node:22-slim
  ```

---

## 3. Environment Configuration

All environment variables reside in `server/.env` (gitignored, never committed):
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/codara
JWT_SECRET=<32+ char secret>
GEMINI_API_KEY=<Google Gemini API Key>
GROQ_API_KEY=<Groq Cloud API Key>
```

Non-secret runner configuration resides in `server/config/runner.config.js` with default resource limits:
- Memory: `128m` (swap: `128m`)
- CPUs: `0.5`
- PIDs limit: `64`
- Network: `none`
- Max Output: `64 KB`
- Timeout: `5000 ms`
- Concurrency limit: `2`

---

## 4. Pre-Flight Verification

Verify your environment without leaking keys or secrets:
```powershell
cd server
node check-env.js
```
Expected output:
```
OK   PORT - 5000
OK   JWT_SECRET
OK   MONGO_URI - connected
OK   GEMINI_API_KEY - HTTP 200
OK   GROQ_API_KEY - HTTP 200
OK   DOCKER_RUNNER - daemon active, images pre-pulled (python & node)
```

---

## 5. Running the Application

### Backend:
```powershell
cd server
npm start
```
Starts Express server on `http://localhost:5000`.

### Frontend:
```powershell
cd client
npm run dev
```
Starts Vite development server on `http://localhost:5173`.

---

## 6. Running Tests & Code Verification

### Server Automated Test Suite:
```powershell
cd server
npm test
```
Executes all unit tests and real container integration tests (Python/Node execution, infinite loop timeouts, and syntax error classifications).

### End-to-End Snippet & Exercise Verification:
```powershell
node scripts/verify_code_snippets.js
```
Runs all catalog examples and seeded code exercises against the real Docker runner and confirms execution statuses.

---

## 7. Security Notice & Scope

> [!WARNING]
> **Local / Educational Demo Scope Only:**
> The backend runner spawns containers by communicating directly with the local Docker daemon. Because access to the Docker socket allows host container creation, this runner is designed exclusively for local academic evaluation, offline demonstrations, and viva defense. It must **never** be exposed to an untrusted public network without hypervisor-level isolation (such as AWS Firecracker, gVisor, or Cloudflare Workers).
