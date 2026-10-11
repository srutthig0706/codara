# Codara: Project Implementation Progress & Verification Tracker

This document tracks the verified status, execution tests, unverified items, and known gaps for each phase of **Codara** in `D:\codara`.

---

## Overall Status Summary

- **Current Active Phase:** Phase 10 (Evaluation Scripts & README)
- **Last Verified Phase:** Phase 7 (Tests Module)
- **Git State:** Clean, all secrets gitignored, no `.env`, `.runs`, or `node_modules` committed.

---

## Phase-by-Phase Tracker

### Phase 0: Project Specifications & Blueprint
- **Status:** **Completed & Verified**
- **What Was Verified:**
  - `docs/PROJECT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/RULES.md`, `docs/TASKS.md`, `docs/DESIGN_DECISIONS.md` created.
  - Zod schemas defined for all bounded AI outputs.
  - `server/.env` gitignored and protected. Pre-flight check script `check-env.js` verified.
- **What Is Unverified:**
  - Code implementation paused pending Phase 1.
- **How to Run / Verify:**
  ```powershell
  # Check documentation integrity
  git status
  ```

---

### Phase 1: Project Skeleton
- **Status:** **Completed & Verified**
- **What Was Verified:**
  - Express server bootstrapped with CORS, JSON body parser, and graceful MongoDB connection pooling (`server/config/db.js`).
  - `GET /api/health` verified with automated test (`server/test/health.test.js`) returning HTTP 200 with MongoDB connected and Judge0 status reported.
  - Client scaffolded with Vite + React, Monaco Editor, React Flow, and Lucide icons.
  - Dark-mode design system with HSL variables, glassmorphic cards, and typography in `client/src/index.css`.
  - Vite reverse-proxy for `/api` to port 5000 verified. Production build (`npm run build`) succeeded in 1.71s.
- **What Is Unverified:**
  - Judge0 Docker daemon is offline (handled gracefully via the offline fallback).
- **How to Run:**
  ```powershell
  # Test backend health check
  cd d:\codara\server
  npm test

  # Run dev server
  npm start
  ```

---

### Phase 2: Authentication System
- **Status:** **Completed & Verified**
- **What Was Verified:**
  - Password hashing with `bcryptjs` (salt rounds = 10) and unique email index in MongoDB `users` collection.
  - JWT token generation using `JWT_SECRET` with 7-day expiry and stateless Bearer authorization middleware (`server/middleware/auth.js`).
  - Validation schemas with Zod (`RegisterSchema`, `LoginSchema`).
  - Automated integration test (`server/test/auth.test.js`) verifying:
    - Successful registration returning user + JWT.
    - Duplicate email conflict rejection (409).
    - Correct password login returning user + JWT.
    - Wrong password rejection (401).
    - Protected `/api/auth/me` access with Bearer token (returns user without passwordHash).
    - Unauthorized access rejection without Bearer token (401).
  - Client state management (`AuthContext.jsx`), `LoginPage.jsx`, `RegisterPage.jsx`, and dynamic `Navbar.jsx` with logout.
  - Client production build verified.
- **What Is Unverified:**
  - None for Phase 2.
- **How to Run:**
  ```powershell
  cd d:\codara\server
  npm test
  ```

---

### Phase 3: Catalog & Static Content
- **Status:** **Completed & Verified**
- **What Was Verified:**
  - Seeded 3 core technologies into MongoDB `technologies` collection:
    - **Python:** `runnableInSandbox: true`, official docs: `https://docs.python.org/3/` (PSFL)
    - **JavaScript (Node.js):** `runnableInSandbox: true`, official docs: `https://nodejs.org/docs/latest/api/` (MIT)
    - **Redis:** `runnableInSandbox: false`, official docs: `https://redis.io/docs/latest/` (RSALv2/SSPLv1)
  - All URLs verified with HTTP 200 responses.
  - All content marked with `reviewStatus: "needs human review"`.
  - Technology catalog and detail API endpoints (`server/routes/tech.routes.js`).
  - Automated integration test (`server/test/tech.test.js`) verifying catalog listing, static details, and 404 responses.
  - Responsive frontend: `CatalogPage.jsx`, `TechnologyPage.jsx` with static tabs (Overview, Why & Where, Setup, Common Pitfalls, Code Example), and `ReviewBanner.jsx`.
- **What Is Unverified:**
  - Content marked for human review per Rule 5.
- **How to Run:**
  ```powershell
  # Seed database
  node scripts/seed_technologies.js

  # Run test suite
  cd d:\codara\server
  npm test
  ```

---

### Phase 4: Local RAG Pipeline
- **Status:** **Completed & Verified**
- **What Was Verified:**
  - Local embedding generation via `@xenova/transformers` (`all-MiniLM-L6-v2`, 384 dimensions) running ONNX in-process on CPU without remote vector APIs.
  - Ingestion utility `scripts/ingest_docs.js` processed 15 curated chunks across Python, JavaScript, and Redis and saved them to MongoDB `doc_chunks`.
  - In-memory vector store `memoryChunkStore` loaded at startup (`server/services/rag.service.js`).
  - Cosine similarity retrieval measured with `scripts/test_retrieval.js`:
    - Cold start: ~203 ms.
    - Subsequent in-memory queries: 6.43 ms to 15.52 ms.
    - Accurate top-1 match across all test queries with verified official URLs.
    - Out-of-domain query safely returned empty verified sources list.
  - Integration test suite (`server/test/rag.test.js`) verified embedding dimensions, cosine similarity math, chunk memory loading, and threshold filtering.
- **What Is Unverified:**
  - None for Phase 4.
- **How to Run:**
  ```powershell
  # Ingest documentation chunks
  node scripts/ingest_docs.js

  # Benchmark retrieval & latency
  node scripts/test_retrieval.js

  # Run test suite
  cd d:\codara\server
  npm test
  ```

---

### Phase 5: Dual LLM Wrapper, Explain & Scenario
- **Status:** **Completed & Verified**
- **What Was Verified:**
  - Unified server-side LLM wrapper `generateJSON(prompt, schema)` (`server/services/llm.service.js`) with:
    - Primary Gemini API (`gemini-3.8-flash` / `gemini-flash-latest`)
    - Fallback Groq Cloud API (`openai/gpt-oss-20b`)
    - Zod schema validation with automatic single retry on validation error
    - Strict citation grounding (enforcing retrieved documentation source URLs only)
  - Cryptographic caching (`server/services/cache.service.js`):
    - Key formula: `SHA-256(technology + ":" + action + ":" + normalizedInput + ":" + promptVersion)`
    - Tested cache hits in $< 50\text{ ms}$ with zero secondary LLM calls.
  - Rate limiting via `express-rate-limit` on `/api/ai/*` routes (`server/middleware/rateLimiter.js`).
  - Strict Zod schemas and graph topology validation (`server/schemas/ai.schema.js`) verifying:
    - All edges reference existing source/target node IDs
    - Technology node presence in `withTech` graph
  - Live API routes: `POST /api/ai/explain` and `POST /api/ai/scenario`.
  - Frontend UI:
    - `ExplainModal.jsx` with summary, mechanism, analogy, takeaway, and verified citations panel.
    - `ScenarioPage.jsx` featuring `@xyflow/react` spatial graph viewer toggling "Without Technology" (bottleneck nodes in crimson) vs "With Technology" (stabilized nodes in emerald).
  - Client production build verified.
- **What Is Unverified:**
  - None for Phase 5.
- **How to Run:**
  ```powershell
  # Run all test suites
  cd d:\codara\server
  npm test
  ```

---

### Phase 6: Code Sandbox & Hardened Docker Runner
- **Status:** **Completed & Verified**
- **What Was Verified:**
  - Hardened Docker-based throwaway container runner implemented (`server/services/dockerRunner.service.js`):
    - Arguments array execution with `child_process.spawn("docker", args)` (never shell strings, zero command interpolation).
    - Hardened security flags: `--rm --network none --memory 128m --memory-swap 128m --cpus 0.5 --pids-limit 64 --read-only --tmpfs /tmp:rw,size=16m --cap-drop ALL --security-opt no-new-privileges --user 1000:1000`.
    - Pre-pulled local images: `python:3.12-slim` and `node:22-slim` (never pulled at runtime).
    - Code mounted read-only via ephemeral folder `d:\codara\.runs\<runId>` (gitignored, automatically unlinked in `finally`), with automatic fallback to `docker create` + `docker cp` + `docker start`.
    - Wall-clock timeout (default 5.0s): executes `docker rm -f <container>` on expiry and returns `status: "timeout"`.
    - Stream output capping: stdout and stderr capped at 64 KB with truncation notice.
    - Concurrency semaphore limiting execution to 2 simultaneous containers with FIFO queueing.
    - In-memory cryptographic SHA-256 caching for identical `(language + code + stdin)` queries returning in 0ms with zero Docker calls.
    - Non-secret runner configuration centralized in `server/config/runner.config.js`.
  - Updated pre-flight script `server/check-env.js`:
    - Checks Docker daemon responsiveness and verifies presence of `python:3.12-slim` and `node:22-slim` without printing secrets.
    - `JUDGE0_URL` made optional and unused.
  - Automated test suite verified (`npm test` in `server/`):
    - 12 unit tests and real integration tests in `server/test/dockerRunner.test.js`:
      - Argument array security flags verification
      - Output truncation at 64 KB
      - Deterministic SHA-256 cache key computation
      - Outcome classification (`accepted`, `timeout`, `compile_error`, `runtime_error`, `output_limit`)
      - Python real container execution: `print(2+2)` -> `4`
      - Node.js real container execution: `console.log(2+2)` -> `4`
      - Infinite loop timeout (`while True: pass`) terminates at 1.5s limit
      - Python syntax error (`def invalid(:`) maps to `compile_error`
      - JavaScript syntax error (`const bad = ;`) maps to `compile_error`
      - Cached execution returns in 0ms
    - Full server test suite passing 19 of 19 tests.
  - Live Code Snippets & Exercise Verification (`scripts/verify_code_snippets.js`):
    - **Catalog Python:** `verified_passed` (1365ms, stdout: `Original: 120.0, After 15.0% discount: 102.0`)
    - **Catalog JavaScript:** `verified_passed` (2214ms, stdout: `Initiating async operations... Completed requests: [ 101, 102 ]`)
    - **Catalog Redis:** `read_only_verified` (`runnableInSandbox: false`, correctly flagged read-only)
    - **Exercise `Valid Alphanumeric Palindrome` (Python):** 4/4 test cases passed (2 public, 2 hidden)
    - **Exercise `Word Frequency Counter` (JavaScript):** 3/3 test cases passed (2 public, 1 hidden)
- **Judge0 Evaluation & cgroup Limitation:**
  - Judge0 CE (v1.13.1) was evaluated, but its sandbox relies on Linux cgroup v1. On Windows 11 with Docker Desktop/WSL2 (cgroup v2), Judge0 returns an internal fault: `No such file or directory @ rb_sysopen - /box/script.py`. Rather than attempting unsupported host kernel modifications, the backend was migrated to the hardened Docker throwaway runner. `infra/judge0` remains untouched and gitignored.
- **What Is Unverified:**
  - Phase 7 (Tests Module) integration with student submission workflow.
- **How to Run:**
  ```powershell
  # Pre-flight environment check
  cd d:\codara\server
  node check-env.js

  # Run full test suite
  npm test

  # Run end-to-end code snippet verification
  cd d:\codara
  node scripts/verify_code_snippets.js
  ```

---

### Phase 7: Tests Module
- **Status:** **Completed & Verified**
- **What Was Verified:**
  - Seeded conceptual quizzes for Python, JavaScript, and Redis in `quizzes` collection.
  - Seeded coding challenges with visible and hidden test cases in `code_exercises` collection (`scripts/seed_tests.js`).
  - `GET /api/tests/quizzes/:slug`: fetches questions with `correctAnswerIndex` and `explanation` withheld from client.
  - `POST /api/tests/quizzes/:slug/submit`: deterministic evaluation strictly against database keys; returns score, pass/fail status, and per-question explanation breakdown. Zero AI grading involved per Rule 1.
  - `GET /api/tests/exercises`: lists all coding challenges with metadata.
  - `GET /api/tests/exercises/:slug`: fetches challenge details with hidden test cases withheld from client.
  - `POST /api/tests/exercises/:slug/run`: runs student code against public test cases with real Docker runner (`python:3.12-slim`, `node:22-slim`).
  - `POST /api/tests/exercises/:slug/submit`: official grading executing student code against all public and hidden test cases in real Docker runner. Verified reference solution passed 100%, and buggy solution failed.
  - `POST /api/tests/exercises/:slug/feedback`: grounded AI tutor reflections using `generateJSON` with Zod schema (`ExerciseErrorFeedbackSchema` / `ExerciseSuccessFollowUpSchema`), failover between Gemini and Groq, and SHA-256 caching. Explains failures without giving code answers; challenges successful students with algorithmic reflection questions.
  - Frontend: `TestsPage.jsx` with tabs for Conceptual Quizzes and Coding Exercises, Monaco Editor, live test runner console, and AI tutor feedback drawer.
  - Automated integration test suite (`server/test/testsModule.test.js`): 8/8 tests passed.
  - Production client build verified in 1.51s.
- **What Is Unverified:**
  - Evaluation benchmarks against 30 test queries (Phase 10).
- **How to Run:**
  ```powershell
  # Seed quizzes and exercises
  node scripts/seed_tests.js

  # Run Phase 7 automated integration tests
  cd d:\codara\server
  node --test test/testsModule.test.js
  ```

---

### Phase 8: Compare Alternatives
- **Status:** Pending Execution
- **What Was Verified:** -
- **What Is Unverified:** -
- **How to Run:** -

---

### Phase 9: Progress & Bookmarks
- **Status:** Pending Execution
- **What Was Verified:** -
- **What Is Unverified:** -
- **How to Run:** -

---

### Phase 10: Evaluation & Benchmarking
- **Status:** Pending Execution
- **What Was Verified:** -
- **What Is Unverified:** -
- **How to Run:** -

---

## Known Gaps & Items Flagged for Human Review
1. **Pre-Seeded Content:** All initial descriptions, pitfalls, and setup instructions will bear `reviewStatus: "needs human review"`.
2. **Official Documentation URLs & Licenses:** URLs and licenses must be verified against actual upstream documentation.
3. **Judge0 CE Docker Container:** To be verified in Phase 6. Fallback interface is required if local Docker is offline.
