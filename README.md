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

- **Node.js:** v22 LTS (includes npm)
- **MongoDB:** Local instance running at `mongodb://localhost:27017/codara`
- **Docker Desktop:** Windows 11 with WSL2 engine active
- **Docker runner images:** Pull once; the runner does not pull images at runtime.
  ```powershell
  docker pull python:3.12-slim
  docker pull node:22-slim
  ```

---

## 3. Environment Configuration

Create `server/.env` locally (it is gitignored and must never be committed). Configure `PORT`, `MONGO_URI`, `JWT_SECRET` (at least 32 characters), `GEMINI_API_KEY`, and `GROQ_API_KEY`. Never paste secrets into source files or logs. The app uses configured LLM providers for bounded AI features; the pre-flight checker reports both provider configurations.

Non-secret runner configuration resides in `server/config/runner.config.js` with default resource limits:
- Memory: `128m` (swap: `128m`)
- CPUs: `0.5`
- PIDs limit: `64`
- Network: `none`
- Max Output: `64 KB`
- Timeout: `5000 ms`
- Concurrency limit: `2`

The user-code timeout starts after the interpreter bootstrap marker, so Docker/interpreter startup and time spent waiting for a runner slot do not consume the code's execution budget. Container startup and queue waits have separate hard caps. Runner timing results expose `queueWaitMs`, `containerStartupMs`, and `programTimeMs` separately.

---

### Compare Alternatives

Authenticated users can open **Compare** from the navigation or a technology page. Select two or three catalog technologies, describe the project (up to 300 characters), and run the comparison. The result includes a side-by-side React Flow diagram for each technology, an easier/harder/breaks trade-off table, a recommendation, and retrieved-source links. The **10x users**, **Beginner team**, and **Offline support** preset buttons rerun the comparison under that constraint. When documentation retrieval returns no relevant source for a technology, the page explicitly marks its evidence as insufficient rather than inventing architecture or trade-offs.

---

### Learning Progress & Bookmarks

Progress is stored per authenticated user in MongoDB and remains available after logout and a later login. Codara records a technology section only when it is viewed, a quiz when it is submitted (including its deterministic score), an exercise only after all tests pass, and a scenario only after successful graph validation. The technology page shows progress and lets users bookmark/unbookmark the technology. The **Progress** dashboard shows per-technology completion steps, quiz best scores, passed exercises, generated scenario counts, and bookmarked technologies. Completion steps are the five technology sections, the quiz, and the catalog exercises for that technology. No streaks, badges, or leaderboards are used.

---

## 4. Pre-Flight Verification

Verify your environment without leaking keys or secrets:
```powershell
cd D:\codara\server
node check-env.js
```
The checker reports whether MongoDB, configured LLM providers, Docker, and both runner images are available. It reports status only and does not print key values.

### Seed local data

With MongoDB running and `server/.env` configured, run from the repository root:
```powershell
node scripts/seed_technologies.js
node scripts/seed_tests.js
node scripts/ingest_docs.js
```
These seed the technology catalog, quizzes, coding exercises, and embedded documentation chunks used for retrieval.

---

## 5. Running the Application

### Backend:
```powershell
cd D:\codara\server
npm start
```
Starts Express on `http://localhost:5000`; startup connects to MongoDB and loads document chunks into memory.

### Frontend:
```powershell
cd D:\codara\client
npm run dev
```
Starts Vite development server on `http://localhost:5173`.
Open the Vite URL, register an account, then log in. Keep the backend running in its own terminal; Vite proxies `/api` requests to it.

---

## 6. Running Tests & Code Verification

### Server Automated Test Suite:
```powershell
cd D:\codara\server
node --test
```
Executes all unit tests and real container integration tests (Python/Node execution, infinite loop timeouts, and syntax error classifications).

### End-to-End Snippet & Exercise Verification:
```powershell
node scripts/verify_code_snippets.js
```
Runs all catalog examples and seeded code exercises against the real Docker runner and confirms execution statuses.

---

### AI Evaluation Harness

The evaluation harness runs each enabled case once with local documentation retrieval and once with zero retrieved context. It calls the same server-side RAG, schema-validated LLM, and Docker code-runner services as the application; the AI response cache is disabled for evaluation. Compare cases are enabled now that the Compare route and response schema are implemented; replace their placeholder wording before treating them as an evaluation benchmark.

1. Configure `server/.env` with at least one working provider key (`GEMINI_API_KEY` or `GROQ_API_KEY`), MongoDB, and the required local documentation chunks. Ensure Docker Desktop is running and the Python/Node runner images are available if generated code examples should be executed.
2. Edit `scripts/eval/cases.json` to replace the `PLACEHOLDER` inputs and expected points. Use `enabled: false` to skip any case.
3. From the repository root, run:
   ```powershell
   node scripts/eval/run-eval.js
   ```
   The script evaluates all enabled cases, waits five seconds between LLM calls by default, and resumes from the stable `results/.eval-checkpoint-<provider>.json` checkpoint if interrupted. The final report is dated when the run completes.
4. Find completed reports at `results/eval-<date>.json` and `results/eval-<date>.csv` after all enabled cases finish. They include provider and model per result, schema validity, citations produced and citations resolved to retrieved chunk IDs for both modes, response/retrieval timings, and Docker execution outcomes for fenced Python or JavaScript code (the runner cache is bypassed during evaluation). A zero-citation response is not marked as grounded. Redis examples and responses without fenced code are marked as unsupported/not provided. Use `results/rubric.md` to score factual accuracy manually; the harness never invents manual scores.

For a small smoke run, select only a few cases:
```powershell
node scripts/eval/run-eval.js --limit 2
```
Optional arguments are `--case-ids id1,id2`, `--delay-ms N`, and `--provider gemini|groq`. Pin the same provider for every batch; a pinned provider never falls back, and each result records the answering provider/model. If a provider is unavailable or rate-limited, the harness prints setup/resume instructions and does not write final result reports. Successful mode results are checkpointed so a later run can resume; final JSON/CSV files are only written when all enabled cases finish.

To inspect a pinned provider checkpoint without making provider or database calls:
```powershell
node scripts/eval/run-eval.js --provider groq --status
```

Before treating evaluation as a benchmark, replace placeholder cases, complete the pinned-provider run, and fill the manual accuracy scores using `results/rubric.md`.

## 7. Security Notice & Scope

> [!WARNING]
> **Local / Educational Demo Scope Only:**
> The backend runner spawns containers by communicating directly with the local Docker daemon. Because access to the Docker socket allows host container creation, this runner is designed exclusively for local academic evaluation, offline demonstrations, and viva defense. It must **never** be exposed to an untrusted public network without hypervisor-level isolation (such as AWS Firecracker, gVisor, or Cloudflare Workers).
