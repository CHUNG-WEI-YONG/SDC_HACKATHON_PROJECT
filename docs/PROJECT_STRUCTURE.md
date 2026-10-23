# Project structure

All application source code lives under `src/`:

- `src/client/` — React and Vite website.
- `src/server/` — Express API and Firebase Admin integration.
- `src/agents.py`, `src/workflow.py`, `src/main.py`, and other top-level Python modules — invoice agent, workflow, Firestore persistence, document reading, and PDF generation.
- `tests/` — API security, bridge readiness, startup, and safe health-endpoint load checks.
- `example_payment/` — JPG payment or invoice samples, ranked by clarity (level 1 clearest, level 10 least clear).
- `docs/` — project documentation.
- `runpod/` — RunPod deployment notes.
- `submission/` — presentation, report, and other final project deliverables.
- `generated_invoices/` — PDFs generated at runtime; kept local and ignored by Git.
- `requirements.txt` — Python dependencies for the agent, kept at the project root.
- `.env.example` — template for the root `.env`; the real `.env` must stay private.

The server locates the repository root relative to `src/server/index.js`, so it can be started from any current working directory. The Python agent derives data and source paths from `__file__`.
