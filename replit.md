# Running Liggy on Replit

Keep the existing React/Vite client, Express API, Python invoice workflow, and
Firebase Firestore database. Do not replace Firestore for Replit setup.

## Start

Use the Run button (`bash ./replit-start.sh`). The website listens on port 5000
and proxies relative `/api` requests to Express on internal port 3001. The
startup script installs missing Node dependencies from the existing lockfiles.
Python dependencies in `requirements.txt` are installed in Replit's managed
Python environment; no virtual environment is needed.
Node.js 22 is required by the imported Firebase Admin dependency.

## Required configuration

Use Replit Secrets; never commit credentials or paste them into chat.

- `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete JSON of an existing Firebase
  service account with permission to use the project's Firestore database.
  Both Node and Python accept this secret. Local setups can still use
  `GOOGLE_APPLICATION_CREDENTIALS` pointing to a private service-account file.
- `SESSION_SECRET`: a secure session-signing secret (already configured).
- Invoice AI: `APIKEY`, `AI_URL` (OpenAI-compatible base URL), and `BASEMODEL`.
  The invoice workflow also accepts `OPENAI_API_KEY`, `OPENAI_BASE_URL`,
  and `OPENAI_MODEL` as alternatives.
- AI Help specifically uses `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and
  `OPENAI_MODEL`. Configure those too if both AI features should be enabled.
- SMTP settings from `.env.example` are optional and only needed to email PDFs.

Restart after changing configuration. Without valid Firestore credentials,
account access and saved business records cannot be verified or used. Without
AI configuration, invoice processing is unavailable.

## Checks

- `npm run build --prefix client`
- `GET /api/health` through the website checks that the Express proxy works.
- Account, invoice, PDF, and AI checks require the external services above.
