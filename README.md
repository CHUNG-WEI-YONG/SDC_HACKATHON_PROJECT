# Liggy

Liggy is a small business e-invoice app. Its React client connects to an Express API, which calls the Python invoice agent in `src/`. Users can type an invoice or upload a document, review and approve the agent's draft, save a PDF, manage customers and invoice history, and view daily and monthly sales summaries.

## Requirements

- Node.js 20 or newer with npm
- Python 3.10 or newer
- An OpenAI API key, or an API key for an OpenAI-compatible service supported by `langchain-openai`

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

Create `liggy/server/.env` by copying `liggy/server/.env.example`, then add your AI key and model settings:

```dotenv
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
PYTHON_EXECUTABLE=C:/path/to/sdc/.venv/Scripts/python.exe
SESSION_SECRET=replace-this-with-a-long-random-secret

OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o-mini
# Optional for an OpenAI-compatible service:
# OPENAI_BASE_URL=https://api.example.com/v1
```

The invoice agent and Liggy Help use these AI settings. If your provider uses a different model, set `OPENAI_MODEL` to a model available to your account. Keep `.env` private and do not commit API keys. The `.env.example` file documents optional SMTP settings for emailing saved invoices.

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

Set `PYTHON_EXECUTABLE` in `.env` to the full path of the virtual environment's Python executable, replacing `C:/path/to/sdc` with the actual path to this project. This makes the backend use the same Python environment where you installed the agent dependencies.

## How invoices and reports work

1. Sign in and open **E-Invoice**.
2. Enter invoice details manually or upload a PDF, image, TXT, JSON, or CSV document.
3. Review the agent's extracted or checked fields and the invoice preview. Correct anything that needs editing.
4. Approve to save the invoice PDF and record. Rejected drafts are not stored as approved sales.
5. When the customer has an email address, Liggy offers to send the saved PDF. Sending requires SMTP settings in `liggy/server/.env`.
6. **Customers** and **Invoice History** show records for the signed-in account. **Daily Sales Report** and **Monthly Insights** recalculate from that account's saved approved invoices and update when the invoice list changes.
7. **Liggy AI** is an in-app help chat for the invoice workflow, customer records, PDFs, reports, and account features. It refuses unrelated questions and does not approve or send invoices on the user's behalf.

## Data and privacy

The SQLite database is `sme_records.db` in the project root. It is initialized and migrated when the Python bridge starts. Each user has a separate customer and invoice scope within that database. Passwords are stored as salted password hashes; the app uses a signed, HTTP-only session cookie.

The first account registered against an older database receives its existing unassigned sample/business records. New accounts start with their own empty customer and invoice records. Generated invoice PDFs are written under `generated_invoices/`; the API checks that the signed-in user owns an invoice before serving its PDF.

For a shared deployment, back up `sme_records.db` and `generated_invoices/` together, protect the server and environment file, and use HTTPS. Do not use a committed development database as a source of production customer records.

## Troubleshooting

- **AI key/model error:** Check `OPENAI_API_KEY`, `OPENAI_MODEL`, and optional `OPENAI_BASE_URL` in `liggy/server/.env`, then restart the backend.
- **Cannot connect to the agent:** Confirm Python dependencies installed successfully and `PYTHON_EXECUTABLE` points to the intended Python interpreter.
- **Email could not send:** Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`; restart the backend.
- **Wrong or missing account data:** Confirm you are signed into the intended email account. Business records are separated by account.
