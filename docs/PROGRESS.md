# Codara: Project Implementation Progress & Verification Tracker

This document tracks the verified status, execution tests, unverified items, and known gaps for each phase of **Codara** in `D:\codara`.

---

## Overall Status Summary

- **Current Active Phase:** Phase 10 (Evaluation; paused at provider rate limit)
- **Last Verified Phase:** Phase 9 (Progress & Bookmarks implementation and automated tests)
- **Git State:** Evaluation checkpoint is ignored and resumable; existing legacy evaluator files remain outside the Phase 10 deliverables.

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
  - `GET /api/health` verified with automated test (`server/test/health.test.js`) returning HTTP 200 with MongoDB status and Docker runner availability reported.
  - Client scaffolded with Vite + React, Monaco Editor, React Flow, and Lucide icons.
  - Dark-mode design system with HSL variables, glassmorphic cards, and typography in `client/src/index.css`.
  - Vite reverse-proxy for `/api` to port 5000 verified. Production build (`npm run build`) succeeded in 1.71s.
- **What Is Unverified:**
  - Docker runner availability depends on Docker Desktop and pre-pulled images; the health endpoint reports it separately from MongoDB.
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
    - The legacy `JUDGE0_URL` setting is unused by the active runner.
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
- **Status:** Implemented & Smoke Verified
- **What Was Verified:**
  - Added authenticated, rate-limited `POST /api/ai/compare` with catalog validation, per-technology retrieval, versioned caching, bounded what-if presets, response-schema checks, graph integrity validation, and citations tied to retrieved chunk ids.
  - Added the Compare page with 2–3 technology selection, a 300-character project description, rerunnable what-if presets, side-by-side React Flow diagrams, trade-off matrix, recommendation, and verified sources.
  - Compare schema/route regression tests pass, including invalid cached-response retry and missing-source disclosure. All 10 Compare evaluation cases are enabled.
  - One real Redis/JavaScript comparison returned HTTP 200 from Groq after Gemini quota exhaustion; both diagrams and all cited chunk ids passed graph/source validation. JavaScript retrieval was empty, so the response correctly marked the recommendation insufficient rather than guessing.
  - Full server suite passed: 36 tests, 0 failures, 0 skipped. Client production build passed; client lint completed with existing warnings in unrelated files.
- **What Is Unverified:**
  - A grounded recommendation with retrieved chunks for every selected technology has not been observed in the real comparison smoke test.
  - The full evaluation suite has not been run; placeholder evaluation wording remains.
- **How to Run:**
  ```powershell
  cd server
  node --test test/compare.test.js
  cd ..\client
  npm run lint
  npm run build
  ```

---

### Phase 9: Progress & Bookmarks
- **Status:** Implemented & Automated Tests Verified
- **What Was Verified:**
  - Added authenticated `/api/progress/dashboard`, section-view, bookmark, and unbookmark routes backed by `user_progress` and `user_bookmarks` MongoDB collections.
  - Progress records explicit section views, submitted deterministic quiz results, exercises only when every public and hidden test passes, and successfully generated scenarios. Set-like events are deduplicated; scenario generation remains a separate count rather than a completion step.
  - Progress is scoped to the JWT user id. The dashboard reports five section steps, quiz completion, catalog exercise passes, quiz best/last scores and attempts, scenario count, and technology bookmarks.
  - Added progress/bookmark controls to technology pages and a Progress dashboard; updated API, product, and acceptance-criteria documentation.
  - Focused progress tests passed: 3 tests, 0 failures. Full server suite passed: 40 tests, 0 failures, 0 skipped. Client production build passed.
- **What Is Unverified:**
  - Cross-session persistence has been exercised through the service and route tests using an in-memory Mongo-compatible mock, not a live MongoDB restart or browser logout/login session.
  - Visual browser behavior and real-user navigation have not been manually tested.
- **How to Run:**
  ```powershell
  cd server
  node --test test/progress.test.js
  node --test
  cd ..\client
  npm run build
  ```

---

### Phase 10: Evaluation & Benchmarking
- **Status:** Evaluation Paused at Provider Rate Limit
- **What Was Verified:**
  - Added 30 editable cases (10 Explain, 10 Scenario, 10 Compare) across Python, JavaScript, and Redis. Compare cases are now enabled; wording and expected points remain editable placeholders.
  - Added paired retrieval/no-retrieval evaluation with resumable checkpoints, AI and Docker-cache opt-outs, provider pinning (`--provider gemini|groq`), provider/model recording, schema checks, raw citation-produced/resolved counts, and Docker example execution results.
  - The two-case smoke run completed both modes for an Explain and a Scenario case. Reports were renamed with the `smoke-` prefix and gitignored; they are not benchmark results for publication.
  - The full run is pinned to Groq and checkpointed: 13/30 cases completed (27/60 mode results); a Groq quota/rate-limit response stopped `javascript-scenario-01` without retrieval. The harness printed the exact resume command for the current batch.
  - Migrated the checkpoint to the provider-stable `results/.eval-checkpoint-groq.json`; the harness now resumes across dates and names final reports using the completion date. `--provider groq --status` reports checkpoint counts without database or provider calls.
  - Verified the original dated checkpoint was preserved byte-for-byte during migration (matching SHA-256); the checkpoint-only command reported 13/30 completed cases and 27/60 mode results without dotenv, database, or LLM initialization. Focused harness tests passed: 4 tests, 0 failures.
  - Fixed evaluation validator binding: `loadEvaluationServices()` had block-scoped validator destructuring that left the outer `validateScenarioGraph` undefined. Invalid provider output now retains a typed validation error; the harness checkpoints that mode as schema-invalid with provider/model and continues, while rate limits still stop without provider fallback. Scenario and Compare routes return a friendly 502 for validation failures. Added mocked-LLM and route regression tests; focused tests: 12 passed, 0 failed.
  - Full server suite after the fix: 46 tests passed, 0 failures, 0 skipped.
  - Resumed only `javascript-scenario-01` with Groq. Its existing with-retrieval result was skipped; the without-retrieval result completed after Groq's JSON-format retry and was checkpointed as schema-valid using `openai/gpt-oss-20b`. Checkpoint now has 14/30 complete cases (28/60 mode results).
  - After resuming the checkpoint, the full server suite passed: 40 tests, 0 failures, 0 skipped.
  - After adding same-provider retry for Groq JSON-format rejection and clean 429 checkpoint reporting, full server suite passed: 37 tests, 0 failures, 0 skipped.
  - Runner diagnosis: three concurrent short Node.js programs initially all hit the 5-second timeout. With an extended diagnostic limit, Docker/interpreter startup was about 2.6-3.6 seconds and Node process uptime about 0.4-1.2 seconds; pre-Docker wait estimates also included health checks and queueing. The timeout now starts at a language-runtime bootstrap marker, with separate queue/startup caps.
  - Focused Docker and evaluation/provider tests passed during Phase 10: 18 tests, 0 failures. The Phase 8 completion full server suite passed: 36 tests, 0 failures, 0 skipped.
- **What Is Unverified:**
  - The full evaluation is paused at 14/30 complete cases (28/60 mode results checkpointed); 16 cases and 32 mode results remain. Resume with Groq only.
  - `results/summary.md` has not been generated because the evaluation is incomplete. Case wording/expected points remain placeholders for human editing.
  - The rare Windows volume-mount fallback path was not triggered by the current Docker tests.
- **How to Run:**
  ```powershell
  # Inspect the checkpoint only; this makes no provider calls.
  node scripts/eval/run-eval.js --provider groq --status
  # Resume the current batch; completed modes are skipped from the checkpoint.
  node scripts/eval/run-eval.js --provider groq --case-ids python-scenario-03,javascript-scenario-01,javascript-scenario-02,javascript-scenario-03,javascript-scenario-04,redis-scenario-01
  # Retry only the remaining mode for javascript-scenario-01 when diagnosing its prior failure.
  node scripts/eval/run-eval.js --provider groq --case-ids javascript-scenario-01
  # Then continue with the remaining batches in order.
  node scripts/eval/run-eval.js --provider groq --case-ids redis-scenario-02,redis-scenario-03,python-compare-01,python-compare-02,python-compare-03,javascript-compare-01
  node scripts/eval/run-eval.js --provider groq --case-ids javascript-compare-02,javascript-compare-03,redis-compare-01,redis-compare-02,redis-compare-03,redis-compare-04
  cd server
  node --test
  ```

---

## Known Gaps & Items Flagged for Human Review
1. **Pre-Seeded Content:** All initial descriptions, pitfalls, and setup instructions will bear `reviewStatus: "needs human review"`.
2. **Official Documentation URLs & Licenses:** URLs and licenses must be verified against actual upstream documentation.
3. **Local Docker runner availability:** Requires Docker Desktop and the pre-pulled Python/Node images. The rare Windows volume-mount fallback path has not been triggered by tests.

---

## Copilot Instructions Update (2026-10-11)

- **Verified:** Added `.github/copilot-instructions.md` covering Codara architecture, security boundaries, product rules, task verification/commit expectations, and concise final reporting. Initial full server suite: 27 tests passed, 0 failed.
- **Unverified:** Whether future Copilot sessions consistently follow the new instructions cannot be verified in this task.
- **Next step:** Review instruction effectiveness during future Codara tasks and revise only if needed.

## Final Consistency Pass (2026-10-11)

- **Verified:** Updated README setup/run/seed/test/evaluation instructions and aligned `PROJECT_SPEC.md`, `ARCHITECTURE.md`, `TASKS.md`, and `DESIGN_DECISIONS.md` with the hardened local Docker runner. Judge0 is documented only as an evaluated and rejected approach; it is not an active runner dependency. Added `docs/HANDOVER.md`.
- **Verified:** `cd server; node --test` passed 40 tests, 0 failed, 0 skipped on the final run. `cd client; npm run build` passed. `node scripts/verify_code_snippets.js` passed both runnable catalog examples and all 7 seeded exercise cases; Redis was verified read-only.
- **Observed:** The first full-suite attempt had a transient Docker runner-unavailable result for its first Python integration case (38/40 passed); the snippet verifier and subsequent full-suite run passed after Docker execution succeeded. No runner code was changed in this documentation pass.
- **Unverified:** Full evaluation remains incomplete as described in Phase 10. Human review of seeded content, answer keys, source URLs/licenses, and evaluation cases/scores remains pending. Live browser walkthrough and real MongoDB persistence restart remain unverified.
- **Next step:** Human review, complete the pinned-provider evaluation, and use `docs/HANDOVER.md` for setup/demo.
