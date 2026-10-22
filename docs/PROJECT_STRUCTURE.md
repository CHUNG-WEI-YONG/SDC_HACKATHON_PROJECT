# Project structure

- `client/` — React and Vite website.
- `server/` — Express API and Firebase Admin integration.
- `src/` — Python multi-agent invoice workflow and Firestore persistence.
- `tests/` — API security checks and a safe health-endpoint load check.
- `docs/` — project documentation.
- `runpod/` — reserved for RunPod deployment assets; local setup does not depend on it.
- `submission/` — presentation, report, and other final project deliverables.
- `generated_invoices/` — PDFs generated at runtime; kept local and ignored by Git.
- `requirements.txt` — Python dependencies for the agent.
- `.env.example` — template for the root `.env`; the real `.env` must stay private.

The server locates the repository root relative to its own source file, so it can be started from any current working directory. The Python agent similarly derives data and source paths from `__file__`.
