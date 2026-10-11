# Codara Handover

## Start the Application

Prerequisites: Windows 11, Node.js 22 LTS with npm, local MongoDB, Docker Desktop using WSL2, and configured LLM provider credentials for AI actions. The Docker runner needs the `python:3.12-slim` and `node:22-slim` images. Do not commit `server/.env`, `.runs`, or generated evaluation output.

From `D:\codara`, install dependencies and pull runner images if this is a fresh setup:

```powershell
cd server
npm install
cd ..\client
npm install
cd ..
docker pull python:3.12-slim
docker pull node:22-slim
```

Create a private `server/.env` with `PORT`, `MONGO_URI`, `JWT_SECRET` (32 or more characters), `GEMINI_API_KEY`, and `GROQ_API_KEY`. Start MongoDB and Docker Desktop, then seed the local catalog, tests, and RAG chunks once:

```powershell
node scripts/seed_technologies.js
node scripts/seed_tests.js
node scripts/ingest_docs.js
```

Start the API and client in separate PowerShell windows:

```powershell
Set-Location D:\codara\server
npm start
```

```powershell
Set-Location D:\codara\client
npm run dev
```

Open `http://localhost:5173`; the API runs at `http://localhost:5000` and Vite proxies `/api` requests to it. Register an account before the demo. Check environment readiness using `Set-Location D:\codara\server; node check-env.js`; this reports statuses, not secret values.

## Five-Minute Demo

1. **Login (0:00–0:30):** Open the Vite URL and log in with the prepared demo account, or register if one has not been created.
2. **Technology page (0:30–1:15):** Open Python or JavaScript from the catalog. Show the reviewed static sections, code example, section progress, and bookmark control.
3. **Scenario (1:15–2:15):** Launch the bounded Scenario action, submit a short topic, and show both the “without” and “with” architecture graphs. Point out highlighted failure points and source links; generation requires working LLM credentials and retrieved content.
4. **Tests module (2:15–3:15):** Open Tests. Submit a quiz and show deterministic score feedback. Open a Python or JavaScript exercise, run a solution, and submit it to demonstrate the Docker runner grading the stored tests.
5. **Compare (3:15–5:00):** Open Compare, select two catalog technologies, enter a short project description, and generate. Show side-by-side diagrams, trade-offs, sources, and one what-if preset. Explain that insufficient retrieved evidence is reported rather than guessed.

The timings are approximate; AI generation and Docker startup depend on local resources and provider availability. Redis is intentionally read-only in the code runner because it requires a backing daemon.

## Human Review Checklist

- [ ] Review all seeded technology descriptions, setup guidance, common errors, and code examples in `scripts/seed_technologies.js`.
- [ ] Verify every seeded quiz question, correct answer key, and explanation in `scripts/seed_tests.js`.
- [ ] Verify upstream source URLs and license names/attributions for both seeded technology content and ingested document chunks.
- [ ] Replace all placeholder inputs and expected points in `scripts/eval/cases.json`.
- [ ] Resume and complete the evaluation with a single pinned provider; review all machine metrics and failures.
- [ ] Score factual accuracy for each completed case (0–2) in `results/rubric.md`; keep human scores blank until reviewers assign them.

## Known Limitations and Unverified Items

- The full evaluation is incomplete: the latest checkpoint records 13 of 30 cases complete (27 of 60 mode results) in `results/.eval-checkpoint-groq.json`, and Groq stopped on a quota/rate limit during `javascript-scenario-01` without retrieval. Inspect without provider calls using `node scripts/eval/run-eval.js --provider groq --status`. `results/summary.md` is not yet a complete benchmark. Continue with the same pinned provider and batch commands in `docs/PROGRESS.md`.
- Evaluation case text and expected points are placeholders until a human edits and approves them; automatic structural and citation checks are not factual accuracy scoring.
- Seeded learning material, quiz answer keys, source URLs, and license attributions have not received comprehensive human review.
- AI features depend on external provider availability, network access, quotas, and rate limits. Do not switch providers mid-run when continuing a pinned evaluation.
- The code runner requires the local Docker daemon and pre-pulled images, supports Python and Node.js only, and does not run Redis. Docker daemon access is privileged; this project is intended for local academic use, not direct untrusted public deployment.
- One initial full-suite attempt encountered a transient `runner_unavailable` result during the first Docker/Python integration case; the real snippet verifier and a subsequent full suite passed. If Docker is cold or under load, confirm Docker Desktop is healthy and rerun the checks.
- Automated progress persistence tests use a Mongo-compatible in-memory test double; live MongoDB restart persistence and manual browser/visual testing remain unverified.
- Client lint completes with warnings, including pre-existing unused-import and hook warnings. The production build and current server tests are the primary verified checks.
- The uncommon Windows Docker volume-mount fallback path has not been exercised in the current verification.

## Verification Commands

```powershell
Set-Location D:\codara\server
node --test
Set-Location D:\codara\client
npm run build
Set-Location D:\codara
node scripts/verify_code_snippets.js
```
