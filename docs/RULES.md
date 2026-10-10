# Codara: Core Engineering & Pedagogical Rules

This document specifies the non-negotiable operational and pedagogical rules governing the design, implementation, and maintenance of **Codara**. Every contributor, subagent, and system component must adhere to these directives.

---

## Rule 1: Deterministic Truth Over AI Grading
- **Ground Truth Authority:** Stored answer keys in MongoDB and sandbox execution results in Judge0 CE are the **sole arbiters** of whether a student's answer or code is correct.
- **Strict Prohibition on AI Grading:** The LLM is strictly forbidden from awarding scores, grading correctness, or marking answers as right or wrong.
- **Role of the AI:** The LLM acts solely as an explanatory and reflective tutor. It receives the deterministic test results (e.g., standard output, error trace, failed assertions, execution diff) and stored reference solutions to personalize feedback, explain algorithmic errors, or challenge the student with reflection questions on design trade-offs.

---

## Rule 2: Strict Zod JSON Enforcement & Grounded Citations
- **Zero Free-Form Text from LLMs:** All LLM outputs must be structured JSON, strictly validated against Zod schemas on the server before reaching the client.
- **Citation Integrity:** The LLM may only cite source URLs and document titles that were explicitly retrieved via the local RAG pipeline and injected into the prompt.
- **Anti-Hallucination Rejection:** Any LLM response that invents outside citations or references documents not in the retrieved context will be rejected and retried or stripped.
- **Explicit Insufficiency:** If no document chunks exceed the retrieval similarity threshold ($\ge 0.40$), the system must explicitly display: *"No verified documentation found for this query in our local index"* rather than allowing the LLM to speculate or invent facts.

---

## Rule 3: Bounded AI Actions Only (No Conversational Chatbots)
- **No Chat Interface:** The post-login interface must **never** feature an open-ended conversational chatbot or generic messaging box.
- **Five Bounded Actions Only:** AI capabilities are strictly confined to five discrete, purpose-built interfaces:
  1. **Explain:** Grounded conceptual clarification citing retrieved documentation chunks.
  2. **Scenario (With vs. Without):** Structural architectural comparison rendered as nodes and edges in React Flow, highlighting failure points in the absence of the technology.
  3. **Compare Alternatives:** Architectural trade-off matrix across 2–3 technologies with side-by-side diagrams and interactive preset "What-If" buttons.
  4. **Teach to Code:** Structured step-by-step coding lessons using the Monaco Editor.
  5. **Tests Module:** Deterministic quizzes and sandboxed coding challenges with post-execution AI feedback.

---

## Rule 4: Aggressive Caching & Protective Rate-Limiting
- **Cryptographic Caching:** Every bounded AI request is hashed using SHA-256 (`SHA-256(action + techSlug + normalizedPrompt + schemaHash)`) and looked up in MongoDB `ai_cache`. If present, the cached response is returned immediately with zero LLM API calls.
- **Rate-Limiting:** All `/api/ai/*` and `/api/sandbox/*` routes must be protected using `express-rate-limit` to prevent quota exhaustion and protect against accidental loops.

---

## Rule 5: Static Content First & Human Review Transparency
- **Static Before Generative:** Core technology information (Overview, Why it exists, Where it is used, Setup guide, Common beginner errors) must be served directly from MongoDB static collections without calling any LLM.
- **Human Review Flag:** All AI-drafted or pre-seeded educational content must bear an explicit badge: `reviewStatus: "needs human review"`.
- **Verified Sources Only:** Every static entry and document chunk must record valid `sourceName`, `sourceUrl`, and `license`. URLs must be verified official documentation pages. Invented or non-existent URLs and licenses are strictly prohibited.

---

## Rule 6: Two-Pronged Tests Module
- **Quizzes (MCQ / True-False):**
  - Questions and options are fetched from MongoDB (with answer keys withheld from the client).
  - Submissions are evaluated strictly against stored keys on the server.
- **Code Exercises:**
  - Evaluated by executing code in Judge0 CE against stored test suites, including **hidden test cases** never exposed to the client.
  - **On Failure:** AI generates a grounded failure explanation referencing compiler/test output and the stored reference solution.
  - **On Success:** AI asks a reflective follow-up: *"Why did you choose this approach?"* comparing the student's submission against reference design patterns (feedback, not a grade).

---

## Rule 7: Sandbox Feasibility & Read-Only Fallbacks
- **Feasibility Classification:** Technologies that cannot be executed as standalone scripts in standard Judge0 CE containers (e.g., Redis server daemon, MongoDB multi-node replica set) must be explicitly flagged with `runnableInSandbox: false`.
- **Read-Only Display:** For non-runnable technologies, code snippets must be rendered in Monaco in read-only mode, clearly labeled as `[Read-Only Example: Requires Local / Containerized Service]`, paired with structural explanations or client-side simulations.

---

## Rule 8: Environment Security & Development Protocol
- **Secret Isolation:** Environment variables (`PORT`, `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `JUDGE0_URL`) must reside exclusively in `server/.env`.
- **Zero Secret Exposure:** Keys and secret strings must **never** be logged to the console, printed to files, committed to git, or requested from the user. Only environment variable names may be referenced.
- **Git Hygiene:** `server/.env` and `node_modules` must remain in `.gitignore`.
- **Small Working Commits:** Make focused git commits after each working step.
- **Explicit Permission:** Always ask before installing anything globally, deleting files, or running destructive commands.
- **Workspace Confinement:** All file access and execution must strictly remain within `D:\codara`.
