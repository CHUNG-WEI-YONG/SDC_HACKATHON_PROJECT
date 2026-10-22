# Liggy

Liggy is a small business e-invoice app. Its React client connects to an Express API, which calls the Python invoice agent in `src/`. Users can type an invoice or upload a document, review and approve the agent's draft, save a PDF, manage customers and invoice history, and view daily and monthly sales summaries.

## Requirements

- Node.js 20 or newer with npm
- Python 3.10 or newer
- A DeepSeek API key (or another OpenAI-compatible API and model supported by both SDKs)

## Setup

Open PowerShell in the project folder (`sdc`). Create a Python environment and install the agent dependencies:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r src\requirements.txt
```

Install the JavaScript dependencies for both the server and client:

```powershell
cd liggy\server
npm install
cd ..\client
npm install
cd ..\..
```

Create `liggy/server/.env` by copying `liggy/server/.env.example`, then add your AI key and model settings. Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of a Firebase service account JSON file with access to the project's Cloud Firestore database. Keep that file outside the repository. On Google Cloud, you can omit the variable and use Application Default Credentials attached to the service instead.

```dotenv
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
PYTHON_EXECUTABLE=C:/path/to/sdc/.venv/Scripts/python.exe
GOOGLE_APPLICATION_CREDENTIALS=C:/path/to/firebase-service-account.json
SESSION_SECRET=replace-this-with-a-long-random-secret

OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-flash
```

The invoice agent uses DeepSeek's OpenAI-compatible Chat Completions API at `https://api.deepseek.com` and the `deepseek-flash` model. Its structured invoice extraction uses function-call output, so the Python agent explicitly disables DeepSeek thinking mode for those calls. The chatbot uses the same API/model but does not use function calling. DeepSeek's current model guide lists `deepseek-flash` and `deepseek-v4-pro`; the legacy `deepseek-chat` model was discontinued in July 2026. See [DeepSeek's API quick start](https://api-docs.deepseek.com/guides/search_fetch), [tool-call guide](https://api-docs.deepseek.com/guides/tool_calls/), and [model list and pricing](https://api-docs.deepseek.com/quick_start/pricing/).

Also create `liggy/server/.env` from `liggy/server/.env.example` for app/session/email settings. Set `PYTHON_EXECUTABLE` to the full path of your project's virtual-environment Python (for example `C:/path/to/sdc/.venv/Scripts/python.exe`) and set a long random `SESSION_SECRET`. SMTP values are optional and only needed to send invoice emails. `.env` files are ignored by Git; never commit API keys.

For production, configure a unique, long, random `SESSION_SECRET` and serve the app over HTTPS. The development secret fallback is only for local use.

## Run the app

Start the backend in one PowerShell window:

```powershell
cd liggy\server
npm run dev
```

Start the frontend in another PowerShell window:

```powershell
cd liggy\client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Create an account or sign in. The Vite development server forwards `/api` requests to the backend on port 3001. The Python agent is launched by the backend; you do not need to start it separately.

If PowerShell blocks activation of the virtual environment, set `PYTHON_EXECUTABLE` in `liggy/server/.env` to the full path of the virtual environment's Python executable.

## How invoices and reports work

1. Sign in and open **E-Invoice**.
2. Enter invoice details manually or upload a PDF, image, TXT, JSON, or CSV document.
3. Review the agent's extracted or checked fields and the invoice preview. Correct anything that needs editing.
4. Approve to save the invoice PDF and record. Rejected drafts are not stored as approved sales.
5. When the customer has an email address, Liggy offers to send the saved PDF. Sending requires SMTP settings in `liggy/server/.env`.
6. **Customers** and **Invoice History** show records for the signed-in account. **Daily Sales Report** and **Monthly Insights** recalculate from that account's saved approved invoices and update when the invoice list changes.
7. **Liggy AI** is an in-app help chat for the invoice workflow, customer records, PDFs, reports, and account features. It refuses unrelated questions and does not approve or send invoices on the user's behalf.

## Data and privacy

Users, customers, and invoices are stored in Cloud Firestore. The Python invoice agent and Express server use Firebase Admin credentials from `GOOGLE_APPLICATION_CREDENTIALS` (or Application Default Credentials). Each user's customers and invoices are stored in subcollections under that user's Firestore record. Passwords are stored as salted password hashes; the app uses a signed, HTTP-only session cookie.

Generated invoice PDFs are written under `generated_invoices/`; the API checks that the signed-in user owns an invoice before serving its PDF. Existing data in `sme_records.db` is not automatically copied to Firestore.

For a shared deployment, configure Firestore backups, protect the server and environment file, and use HTTPS.

## Troubleshooting

- **Invoice agent key/model error:** Check `APIKEY`, `AI_URL`, and `BASEMODEL` in `src/.env`. **Chatbot configuration error:** Check its matching `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` values. Restart the backend after changing either set.
- **Cannot connect to the agent:** Confirm Python dependencies installed successfully and `PYTHON_EXECUTABLE` points to the intended Python interpreter.
- **Email could not send:** Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`; restart the backend.
- **Wrong or missing account data:** Confirm you are signed into the intended email account. Business records are separated by account.
