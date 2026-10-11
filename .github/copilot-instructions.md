# Codara Copilot Instructions

## Project and sources of truth

- Codara is a learning platform for programming technologies. The supported development environment is Windows 11 with PowerShell, rooted at `D:\codara`.
- The client is React + Vite; the server is Node.js + Express with local MongoDB, JWT authentication, and Zod validation.
- The code runner is Docker-based, not Judge0.
- Treat `docs/` as the source of truth. Consult `PROJECT_SPEC.md`, `ARCHITECTURE.md`, `RULES.md`, `TASKS.md`, `DESIGN_DECISIONS.md`, and `PROGRESS.md` before making related changes.

## Security and repository boundaries

- Never read, print, log, or commit values from `server/.env`. Never ask the user for keys or secrets.
- Do not use destructive Git commands or install packages globally.
- Keep all reads, writes, and commands inside `D:\codara`.
- Never commit `server/.env`, `.runs/`, or `infra/judge0/`.
- Before committing, inspect Git status and staged paths for secrets and unrelated changes. Stage only files for the requested task.

## Product rules

- Sandbox execution and stored answer keys determine correctness. AI must never grade, award scores, or decide whether an answer is correct.
- Never return answer keys, hidden tests, or reference solutions from an API before the user has answered.
- Validate all AI output as Zod JSON, allow citations only to retrieved chunks, cache responses with a key that includes `promptVersion`, and rate-limit AI routes.
- Do not add free-form chatbot functionality.

## Engineering expectations

- Never fabricate sources, licenses, quotations, or results. Do not claim something works unless you ran the relevant verification.
- Make no unrequested changes and keep files small; prefer focused, surgical edits.
- For every task, run relevant tests and the full server suite (`cd server; node --test`), fix failures, check Git status for secrets, update `docs/PROGRESS.md` with verified/unverified/next step, and commit with a clear message.

## Final response

- Keep the final reply to at most 10 lines.
- State what changed, exact test counts, and what remains unverified. Avoid long explanations.
