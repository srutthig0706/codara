# Codara: Project Implementation Roadmap & Acceptance Criteria

This document outlines the sequential phases (0 through 10) for building **Codara** in `D:\codara`. Work must proceed **one phase at a time**. After each phase is complete, summarize what was built, how to run and test it, note any unverified items, and await user approval before proceeding.

---

## Overview of Phases

| Phase | Title | Core Deliverables | Dependencies |
| :---: | :--- | :--- | :--- |
| **0** | **Foundational Specifications** | `PROJECT_SPEC.md`, `ARCHITECTURE.md`, `RULES.md`, `TASKS.md` | None |
| **1** | **Project Skeleton** | Client + Server scaffolding, MongoDB connect, `/api/health` | Phase 0 approved |
| **2** | **Authentication System** | Register, Login, Logout, bcrypt, JWT middleware, Protected routes | Phase 1 |
| **3** | **Catalog & Static Content** | Seed Python/Redis/MongoDB, Catalog Page, Tech Detail Page | Phase 2 |
| **4** | **Local RAG Pipeline** | Transformers.js (`all-MiniLM-L6-v2`), Chunking, Cosine similarity | Phase 3 |
| **5** | **AI Wrapper, Explain & Scenario** | `generateJSON` (Gemini + Groq failover + SHA-256 cache), React Flow | Phase 4 |
| **6** | **Judge0 CE & Code Sandbox** | Monaco Editor, Judge0 client, Runnable vs Read-Only execution | Phase 5 |
| **7** | **Tests Module** | Stored Quizzes (MCQ/TF), Sandboxed Code Exercises, AI Reflections | Phase 6 |
| **8** | **Compare Alternatives** | Multi-tech comparison, Trade-off matrix, What-If presets | Phase 5 |
| **9** | **Progress & Bookmarks** | User progress tracking, bookmarking system, dashboard state | Phase 7, 8 |
| **10** | **Evaluation & Benchmarking** | 30 test cases (with vs without RAG), CSV/JSON output, README.md | Phase 9 |

---

## Phase 0: Project Specifications & Architectural Blueprint
- **Goal:** Establish comprehensive, unambiguous specifications, architectural blueprints, pedagogical rules, and roadmaps before writing application code.
- **Tasks:**
  1. Draft `docs/PROJECT_SPEC.md` covering vision, stack constraints, bounded AI philosophy, and viva defense points.
  2. Draft `docs/ARCHITECTURE.md` specifying folder structures, MongoDB collections, API routes, Zod schemas, Mermaid system diagrams, and subsystem designs.
  3. Draft `docs/RULES.md` formalizing the 8 non-negotiable core engineering and pedagogical rules.
  4. Draft `docs/TASKS.md` detailing all 10 phases with concrete acceptance criteria.
- **Acceptance Criteria:**
  - [x] All 4 documents created in `D:\codara\docs\`.
  - [x] Clear explanation of why no vector database is required.
  - [x] Clear explanation of deterministic grading vs. AI tutoring.
  - [x] Zero secrets present or requested.
  - [ ] User review and approval received ("proceed").

---

## Phase 1: Project Skeleton
- **Goal:** Establish a working full-stack client-server baseline with local MongoDB connectivity and health verification.
- **Tasks:**
  1. Setup `server/` with Express, `cors`, `dotenv`, and native MongoDB driver.
  2. Implement `server/config/db.js` for MongoDB connection pool management.
  3. Implement `GET /api/health` returning server status, MongoDB ping, and Judge0 reachability status.
  4. Scaffold `client/` using Vite + React with clean vanilla CSS tokens (`client/src/index.css`).
  5. Verify proxy configuration in `vite.config.js` connecting `client` to `server`.
- **Acceptance Criteria:**
  - [ ] Running `npm start` in `server/` connects to `mongodb://localhost:27017/codara`.
  - [ ] `GET /api/health` returns HTTP 200 with `{ status: "ok", mongo: "connected", judge0: "reachable" | "offline" }`.
  - [ ] Running `npm run dev` in `client/` displays the initial Codara application shell.
  - [ ] Client successfully fetches and displays health status from backend.

---

## Phase 2: Authentication System
- **Goal:** Implement secure, stateless JWT authentication with bcrypt password hashing and clean UI views.
- **Tasks:**
  1. Define user validation schemas with Zod (`server/schemas/auth.schema.js`).
  2. Implement `POST /api/auth/register` (hash password with bcrypt, unique email index in `users` collection).
  3. Implement `POST /api/auth/login` (verify password, issue JWT signed with `JWT_SECRET`).
  4. Implement `server/middleware/auth.js` to protect sensitive API routes.
  5. Build `client/src/pages/LoginPage.jsx` and `client/src/pages/RegisterPage.jsx` with input validation and error feedback.
  6. Implement client-side AuthContext managing user session, token storage, and protected routing.
- **Acceptance Criteria:**
  - [ ] New user can register; duplicate email returns clean 409 error.
  - [ ] Passwords stored in MongoDB as bcrypt hashes (never plain text).
  - [ ] Logging in issues a signed JWT; subsequent protected route calls accept Bearer token.
  - [ ] Unauthenticated requests to protected routes return 401 Unauthorized.
  - [ ] Client seamlessly logs in, persists session in memory/localStorage, and logs out.

---

## Phase 3: Catalog and Static Content
- **Goal:** Build the technology catalog and static overview hub for Python, Redis, and MongoDB with verified documentation sources.
- **Tasks:**
  1. Create `server/routes/tech.routes.js` to serve catalog entries and detail views.
  2. Write seed script (`scripts/seed_technologies.js`) to populate MongoDB with initial curated data for:
     - **Python** (`runnableInSandbox: true`)
     - **Redis** (`runnableInSandbox: false`)
     - **MongoDB** (`runnableInSandbox: false`)
  3. Include verified official URLs, licenses, and `reviewStatus: "needs human review"`.
  4. Build `client/src/pages/CatalogPage.jsx` displaying technology cards with category tags and review badges.
  5. Build `client/src/pages/TechnologyPage.jsx` with tabbed navigation: *Overview*, *Why & Where*, *Setup*, *Common Pitfalls*.
- **Acceptance Criteria:**
  - [ ] Seeding script populates `technologies` collection without duplicates.
  - [ ] Catalog renders all 3 technologies with purpose-first summaries.
  - [ ] Technology page shows all 4 static sections with "needs human review" banner and source links.
  - [ ] Zero AI calls used to display static content.

---

## Phase 4: Local RAG Pipeline
- **Goal:** Ingest documentation, compute local 384-dimensional dense embeddings via Transformers.js, and provide sub-millisecond in-memory cosine similarity retrieval.
- **Tasks:**
  1. Create document chunking and ingestion utility (`scripts/ingest_docs.js`).
  2. Use `@xenova/transformers` (`all-MiniLM-L6-v2`) in Node.js to generate 384-dimensional embeddings.
  3. Store chunks with embeddings, source URLs, and metadata in `doc_chunks` collection.
  4. Implement `server/services/rag.service.js` with cosine similarity retrieval:
     $$\text{sim}(u, v) = \frac{u \cdot v}{\|u\|_2 \|v\|_2}$$
  5. Implement retrieval test script (`scripts/test_retrieval.js`) testing top-3 chunks for sample queries with similarity scores.
- **Acceptance Criteria:**
  - [ ] Ingestion script processes documentation markdown/text and populates `doc_chunks`.
  - [ ] Embeddings generated locally on CPU via ONNX without external API requests.
  - [ ] Cosine similarity retrieval returns top-k chunks with scores $\ge 0.40$ in $< 10\text{ ms}$.
  - [ ] Queries outside the domain return empty results triggering the "No verified docs found" rule.

---

## Phase 5: Dual LLM Wrapper, Explain & Scenario
- **Goal:** Implement the resilient `generateJSON(prompt, schema)` wrapper with Gemini/Groq failover, MongoDB SHA-256 caching, and build the Explain and Scenario (With/Without React Flow) modules.
- **Tasks:**
  1. Implement `server/services/llm.service.js` with:
     - Gemini 1.5/2.0 API as primary.
     - Groq Cloud API as fallback.
     - Zod schema validation on all outputs with single-retry error feedback.
  2. Implement `server/services/cache.service.js` hashing requests with SHA-256 and storing in `ai_cache`.
  3. Create `POST /api/ai/explain` injecting retrieved doc chunks and returning grounded JSON.
  4. Create `POST /api/ai/scenario` returning React Flow nodes and edges for "With vs. Without" architecture graphs.
  5. Build client UI:
     - Bounded action buttons on `TechnologyPage`.
     - `ExplainModal` with verified source attribution badges.
     - `ScenarioPage` utilizing `@xyflow/react` / `reactflow` displaying interactive node graphs with problem nodes highlighted in red and stabilized nodes highlighted in emerald.
- **Acceptance Criteria:**
  - [ ] `generateJSON` successfully parses and returns validated JSON matching schema.
  - [ ] Simulating Gemini quota exhaustion (or API key invalidation) automatically falls back to Groq without client disruption.
  - [ ] Repeated identical queries return from MongoDB cache in $< 5\text{ ms}$ with zero API calls.
  - [ ] Explain action displays verified source citations matching retrieved chunks.
  - [ ] Scenario renders interactive With vs. Without graph in React Flow.

---

## Phase 6: Judge0 CE & Code Sandbox
- **Goal:** Integrate self-hosted Judge0 CE, embed Monaco Editor, and establish sandboxed execution with clear support labels.
- **Tasks:**
  1. Implement `server/services/sandbox.service.js` to communicate with `JUDGE0_URL` (`http://localhost:2358`).
  2. Implement graceful degradation: detect if Judge0 is unreachable and return structured fallback messages without crashing.
  3. Implement `POST /api/sandbox/execute` accepting student code and language ID.
  4. Build `client/src/components/CodeEditor.jsx` integrating `@monaco-editor/react`.
  5. Enforce Rule 7: Python examples are editable and executable; Redis/MongoDB examples are rendered read-only with explicit badges explaining the requirement for external daemons.
- **Acceptance Criteria:**
  - [ ] Executable Python snippet sends code to Judge0 and returns stdout/stderr.
  - [ ] If Judge0 is stopped, system displays clean notice: "Execution engine offline — offline reference code available".
  - [ ] Read-only banner is prominent on non-executable technologies (Redis, MongoDB).

---

## Phase 7: Tests Module (Quizzes & Code Exercises)
- **Goal:** Deliver deterministic assessment for multiple-choice/true-false quizzes and coding exercises, accompanied by post-test AI feedback.
- **Tasks:**
  1. Seed initial quizzes and code exercises in `quizzes` and `code_exercises` collections.
  2. Implement `POST /api/tests/quizzes/submit` validating answers against stored keys (zero AI involved).
  3. Implement `POST /api/tests/exercises/submit` running code in Judge0 against public and hidden test cases.
  4. Implement AI feedback endpoints:
     - On code failure: `POST /api/ai/feedback/failure` (AI explains error grounded in compiler stderr + reference solution).
     - On code success: `POST /api/ai/feedback/reflection` (AI asks follow-up: "Why did you choose this approach?").
  5. Build `client/src/pages/TestsPage.jsx` with quiz runner and split-screen code editor/test runner.
- **Acceptance Criteria:**
  - [ ] Quizzes strictly graded by database answer keys.
  - [ ] Code exercises run against both visible and hidden test cases in Judge0.
  - [ ] AI does not grade; AI generates targeted feedback only after test results are confirmed.

---

## Phase 8: Compare Alternatives
- **Goal:** Implement multi-technology trade-off visualizer with side-by-side diagrams, comparison matrices, and preset "What-If" architectural pivot buttons.
- **Tasks:**
  1. Implement `POST /api/ai/compare` accepting 2–3 technology slugs and a project description.
  2. Synthesize side-by-side React Flow graphs, structured trade-off criteria matrix, and preset what-if pivots.
  3. Build `client/src/pages/ComparePage.jsx` allowing users to select technologies, enter a scenario, view the trade-off matrix, and click preset "What-If" buttons (e.g., "What if data must survive server restart?").
- **Acceptance Criteria:**
  - [ ] Compares selected technologies with clear architectural trade-offs.
  - [ ] What-if buttons update the verdict dynamically.
  - [ ] All outputs validated via `CompareResponseSchema`.

---

## Phase 9: Progress Tracking & Bookmarks
- **Goal:** Enable students to track topic completion and bookmark key concepts, scenarios, and exercises.
- **Tasks:**
  1. Implement `user_progress` and `user_bookmarks` models and API routes.
  2. Update client state when quizzes/exercises are completed.
  3. Add bookmark toggle buttons across technology pages and code exercises.
  4. Build student dashboard view summarizing completed technologies, quiz scores, and pinned items.
- **Acceptance Criteria:**
  - [ ] User progress persists in MongoDB across page reloads.
  - [ ] Bookmarked items appear in the student's dashboard.
  - [ ] Clean visual indicators for completed exercises and modules.

---

## Phase 10: Evaluation & Benchmarking
- **Goal:** Build an automated evaluation suite running 30 curated test queries (with vs. without RAG retrieval), outputting benchmark metrics to CSV/JSON, and provide complete setup documentation in `README.md`.
- **Tasks:**
  1. Create `scripts/evaluate_rag.js` containing 30 diverse pedagogical queries (factual, architectural, misconception-based).
  2. Run evaluation in two modes:
     - **Condition A (With RAG):** Local retrieval active, citations enforced.
     - **Condition B (Without RAG / Zero Context):** Baseline LLM response.
  3. Measure retrieval latency, citation accuracy, and hallucination rate.
  4. Output results to `eval_results.json` and `eval_results.csv`.
  5. Write comprehensive `README.md` with step-by-step setup, Docker instructions, environment variable keys, and troubleshooting tips.
- **Acceptance Criteria:**
  - [ ] Evaluation script executes all 30 test cases without unhandled errors.
  - [ ] Generates clean CSV and JSON reports comparing RAG vs. No-RAG metrics.
  - [ ] `README.md` allows any examiner or student to set up and run the project from scratch.
