# Liggy — agentic Auto E-Invoice Generator

Liggy is a small-business e-invoice application. The React website is in `client/`, the Express API is in `server/`, and the Python multi-agent invoice workflow is in `src/`. Firestore stores user accounts, customers, and invoices. Approved invoice PDFs are written to `generated_invoices/` on the computer running the backend.

## Team and project

|                  |                                                                        |
| ---------------- | ---------------------------------------------------------------------- |
| **Team name**    | Chili Pan MEE Penang                                                   |
| **Domain**       | Domain 2 — Alpha Red                                                   |
| **Team leader**  | Tai Kai Xuan                                                           |
| **Team members** | Soo Jiaquan, Chung Wei Yong, Aaron Ling Ji Hong, Kenneth Saw Chzi Yang |
| **Project demo** | _Add your demo URL here before sharing or submitting._                 |

## Project structure

```text
sdc/
├── client/                 # React + Vite frontend
├── server/                 # Express API and Firebase Admin connection
├── src/                    # Python invoice agent and workflow
├── tests/                  # API security checks and lightweight load test
├── docs/                   # Project documentation
├── runpod/                 # RunPod deployment notes and future assets
├── submission/             # Final report, slides, and demo materials
├── generated_invoices/     # PDFs created locally (ignored by Git)
├── requirements.txt        # Python agent dependencies
├── .env.example            # Safe template for local configuration
├── firebase.json           # Firebase CLI Firestore rules configuration
└── README.md               # Setup and project guide
```

The application request path is:

```text
Browser UI (client/) → API (server/) → invoice agent (src/) → AI model API
                                             ├── Firestore: users and business records
                                             └── generated_invoices/: PDF files
```

This guide uses Windows and PowerShell and starts from a fresh clone.

## Requirements

Install [Git](https://git-scm.com/downloads), [VS Code](https://code.visualstudio.com/), [Node.js 20 or newer](https://nodejs.org/) with npm, and [Python 3.10 or newer](https://www.python.org/downloads/).

The app also needs an OpenAI-compatible AI provider and Firestore to analyze invoices and save account/business data. Email is optional.

## 1. Clone and open the project

In PowerShell, run:

```powershell
git clone https://github.com/CHUNG-WEI-YONG/SDC_HACKATHON_PROJECT.git
cd SDC_HACKATHON_PROJECT
code .
```

If `code .` does not work, open VS Code and use **File → Open Folder** to select `SDC_HACKATHON_PROJECT`.

## 2. Create the Python environment and install agent requirements

Run these commands from the repository root:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

The Python requirements are at the repository root so setup and deployment tools can find them easily. The agent source code remains in `src/`.

## 3. Install the website and API packages

From the repository root, run:

```powershell
cd server
npm install
cd ..\client
npm install
cd ..
```

Run `npm install` separately in `server/` and `client/`; each folder has its own `package.json` and lockfile.

## 4. Configure AI and Firestore

Copy the root template to create your private configuration file:

```powershell
Copy-Item .env.example .env
```

Open `.env` in VS Code and replace the example values:

```dotenv
GOOGLE_CLOUD_PROJECT=your-firebase-project-id
GOOGLE_APPLICATION_CREDENTIALS=C:/path/to/firebase-service-account.json

PORT=3001
CLIENT_ORIGIN=http://localhost:5173
PYTHON_EXECUTABLE=C:/path/to/SDC_HACKATHON_PROJECT/.venv/Scripts/python.exe
SESSION_SECRET=your-long-random-secret

APIKEY=your_provider_api_key
AI_URL=https://your-provider-api-base-url/v1
BASEMODEL=your_vision_and_tool_calling_model

OPENAI_API_KEY=your_provider_api_key
OPENAI_BASE_URL=https://your-provider-api-base-url/v1
OPENAI_MODEL=your_json_capable_model
```

Use your AI provider's documented API base URL and model names. The invoice-agent model must support image inputs and tool/function calling. The Liggy Help model must support JSON output. The `OPENAI_...` values may use the same key, URL, and model as the agent values when that model supports both workflows. These are OpenAI-compatible settings and do not require an OpenAI account.

For `PYTHON_EXECUTABLE`, use the full path to the virtual environment Python created in Step 2. Forward slashes work in Windows `.env` paths. Generate a random session secret with:

```powershell
py -c "import secrets; print(secrets.token_urlsafe(48))"
```

### Firestore setup

For the standard local setup, create a Firebase project, enable **Cloud Firestore**, then create a service-account JSON key in **Project settings → Service accounts**. Save that key outside this repository and set `GOOGLE_CLOUD_PROJECT` and `GOOGLE_APPLICATION_CREDENTIALS` in `.env`. The service account needs permission to access Firestore.

The app uses Firestore even when running locally because sign-in, customer records, and invoice history need a database. For local development without a cloud database, you can use the Firestore Emulator instead: install the Firebase CLI and Java, run `firebase emulators:start --only firestore --project demo-liggy` from the root, then set `GOOGLE_CLOUD_PROJECT=demo-liggy`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, and leave `GOOGLE_APPLICATION_CREDENTIALS` blank. If the emulator selects a different port, use the port it reports. The emulator must stay running while you use the app.

The SMTP fields in `.env.example` are optional. Configure them only if you want Liggy to send invoice PDFs by email.

## 5. Run the backend and website

Open two VS Code terminals. Run both from the repository root before entering the folder commands.

### Terminal 1 — API and Python invoice agent

```powershell
cd server
npm start
```

Keep the terminal open. The API launches the Python invoice agent automatically. You do not start the agent separately.

### Terminal 2 — website

```powershell
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and create an account or sign in. Stop either process with **Ctrl+C** in its terminal.

## Use the app

On **E-Invoice**, type invoice details or upload a PDF, JPG/JPEG, PNG, WebP, TXT, JSON, or CSV document (up to 10 MB). Review the extracted fields and preview, then approve or reject. Approved invoices are saved to Firestore and their PDFs are written under `generated_invoices/`. Invoice History lets you preview or download saved PDFs. Customers, Daily Sales Report, and Monthly Insights use the signed-in account's saved invoices. Liggy AI answers questions about these app workflows. Email delivery requires SMTP configuration.

## How Replit and RunPod fit into the project

### Replit — frontend design and iteration

Replit was used to design and refine the required website interface. The resulting frontend belongs in `client/`, which contains the React pages, components, and styles. When transferring a UI change from Replit, bring the updated frontend files into this project's `client/` folder and run the app locally using the steps above.

The browser talks to the Express API through `/api` requests. Keep provider API keys, Firebase service-account credentials, and other secrets in the backend's root `.env`; never put them in React code or Vite client-side environment variables, where visitors could retrieve them.

### RunPod — hosted model inference for the agent

RunPod can host or provide access to the model endpoint used by the invoice agent. The backend launches the Python workflow, and the workflow sends document text or supported invoice images to the configured model API. The AI response is then checked by the workflow; the user reviews and approves the invoice before it is saved to Firestore and rendered as a PDF.

Configure the RunPod endpoint in the root `.env`:

- `APIKEY` — the private key/token required by the endpoint.
- `AI_URL` — the endpoint's API base URL, using the format expected by its provider.
- `BASEMODEL` — the model name or ID expected by the endpoint.

The current invoice-agent implementation uses an OpenAI-compatible Chat Completions interface. Its model must support image input and tool/function calling. If Liggy AI Help uses that same endpoint, set `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` to compatible values too; its model must support JSON responses. If the RunPod worker exposes a different request format, it needs a server-side adapter before it can work with this code. Do not expose the RunPod token in `client/`.

RunPod is optional for local development if you use another compatible AI provider. Firestore is still needed for sign-in and saved customer/invoice records. The `runpod/` folder is currently documentation space; it does not contain an automatic deployment configuration.

## Run the security and load checks

With the API running, open another terminal at the repository root:

```powershell
node --test tests/app-security.test.mjs
node tests/load-test.mjs light
```

The load script only calls `/api/health`; it does not create invoices or call the AI provider. See [tests/README.md](tests/README.md) for the optional signed-in test and the `medium` and `stress` levels.

## Troubleshooting

- **`ERR_MODULE_NOT_FOUND` for a server package:** run `cd server` then `npm install`; wait for it to complete before `npm start`.
- **Website start script not found:** use `npm run dev` from `client/`.
- **Invoice agent cannot start:** confirm the Python requirements installed and `PYTHON_EXECUTABLE` points to `.venv/Scripts/python.exe`.
- **AI request fails:** check `APIKEY`, `AI_URL`, `BASEMODEL`, and the matching `OPENAI_...` values in the root `.env`, then restart the backend.
- **Firestore sign-in or save fails:** verify the Firebase project ID and service-account file path, or confirm the Firestore Emulator is running and `FIRESTORE_EMULATOR_HOST` is correct.
- **Email fails:** check the SMTP values. Invoice creation and saving work without email delivery configured.

See [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) for a folder map. Never commit `.env`, service-account keys, local databases, customer PDFs, generated invoices, or dependency/build folders. For production, use HTTPS, a unique session secret, secured credentials, backups, and persistent file storage.
