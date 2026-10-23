# Liggy — Agentic Auto E-Invoice Generator

Liggy is an AI-assisted e-invoice application for small businesses. It helps users extract and review invoice information, create invoice PDFs, and keep customer and sales records. The React website is in `client/`, the Express API is in `server/`, and the Python multi-agent invoice workflow is in `src/`. Firestore stores user accounts, customers, and invoices. Approved invoice PDFs are written to `generated_invoices/` on the computer running the backend.


## Team and project

|                       |                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------ |
| **Team name**         | Chili Pan MEE Penang                                                                 |
| **Team domain**       | Domain 2 — Alpha Red                                                                 |
| **SDG track (1–17)**  | -                                                                                    |
| **Team leader**       | Tai Kai Xuan                                                                         |
| **University**        | Taylor University , University Teknologi Malaysia                                    |
| **Number of members** | 5                                                                                    |
| **Team members**      | Soo Jiaquan, Tai Kai Xuan, Chung Wei Yong, Aaron Ling Ji Hong, Kenneth Saw Chzi Yang |

## Project links

| Resource            | Link                                                                             |
| ------------------- | -------------------------------------------------------------------------------- |
| GitHub repository   | [SDC_HACKATHON_PROJECT](https://github.com/CHUNG-WEI-YONG/SDC_HACKATHON_PROJECT) |
| Replit live app     | [Open Liggy on Replit](https://sdchackathonproject-2.replit.app/)                 |
| Implementation demo | https://youtu.be/ESC0dAIl8T8                                                     |
| RunPod endpoint     | Usage of Runpod in API for agent                                                 |
| Slide deck          | _[Add the slide deck URL]_                                                       |
| Demo video          | _[Add the demo video URL]_                                                       |

## Overview

### Problem

Small businesses need a straightforward way to turn invoice documents into usable records and keep track of customer spending and sales. _[Add your team's specific problem statement and target users here. Describe why this problem matters in 2–4 sentences.]_

### Solution

Liggy combines an invoice workflow with an AI agent that extracts invoice details for the user to review. After approval, the application saves the invoice record and PDF, updates customer and sales views, and keeps the generated invoice available in history. _[Add any project-specific value or differentiator your team wants to highlight.]_

### Key features

- Upload supported invoice documents or enter invoice details manually, then review the extracted information and preview.
- Use the invoice agent workflow to analyze documents and assist with invoice creation.
- Save approved invoices and PDFs, and review invoice history, customers, daily sales, and monthly insights.
- Ask Liggy AI Help questions about the application's invoice and agent workflow.

### Technology stack

| Layer                     | Technology                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Frontend                  | React and Vite (`client/`)                                                           |
| Backend API               | Node.js and Express (`server/`)                                                      |
| Agent workflow            | Python multi-agent invoice workflow (`src/`)                                         |
| Database                  | Firebase Cloud Firestore                                                             |
| AI / inference            | Configurable OpenAI-compatible model API; RunPod may host/provide the model endpoint |
| Development and UI design | VS Code for local development; Replit was used for frontend UI design and iteration  |

## Project structure

```text
sdc/
├── client/                 # React + Vite frontend
├── server/                 # Express API and Firebase Admin connection
├── src/                    # Python invoice agent and workflow
├── tests/                  # API security checks and lightweight load test
├── example_payment/        # Sample JPG payment invoices ordered by image clarity
├── docs/                   # Project documentation
├── runpod/                 # RunPod deployment notes and future assets
├── submission/             # Final report, slides, and demo materials
├── generated_invoices/     # PDFs created locally (ignored by Git)
├── requirements.txt        # Python agent dependencies
├── .env.example            # Safe template for local configuration
├── firebase.json           # Firebase CLI Firestore rules configuration
└── README.md               # Setup and project guide
```

### JPG payment image examples

The [`example_payment/`](example_payment/) folder is for sample JPG payment or invoice images used to check how well the document-upload workflow handles different image quality. Place ten JPG files there and number them by clarity: **level 1 is the clearest** and **level 10 is the least clear**. Suggested names are `level-01.jpg` through `level-10.jpg`.

To use an example, start Liggy, open **E-Invoice**, select the JPG, and choose **Analyze Invoice**. Compare the extracted fields with the image, note which details need manual correction, and verify that unclear or unreadable details are surfaced for review before approval. These examples are manual workflow samples; they are not automatically run by the Node test scripts in `tests/`.

The folder is currently empty in this checkout. Add only images that are safe to share with the project; remove real customer names, account numbers, and other private payment details before committing them.

The `submission/` folder is where the team can place completed submission files. Use the official templates from the Google Drive folder above. Rename each file to include the team name where required. Expected documents (confirm exact names in the downloaded templates):

```text
submission/
├── SDC2026_ChiliPanMEEPenang_Preliminary.pdf       # [Add completed preliminary submission]
├── SDC2026_ChiliPanMEEPenang_TechDeclaration.pdf   # [Add completed technology declaration]
├── SDC2026_ChiliPanMEEPenang_Replit_POU.pdf        # [Add Replit proof of use]
└── SDC2026_ChiliPanMEEPenang_Runpod_POU.pdf        # [Add RunPod proof of use]
```

If the official template uses a different year or filename format, follow the template's required naming convention.

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

Open PowerShell or the VS Code terminal and run:

```powershell
git clone https://github.com/CHUNG-WEI-YONG/SDC_HACKATHON_PROJECT.git
cd SDC_HACKATHON_PROJECT
code .
```

If `code .` is not recognized, open VS Code, choose **File → Open Folder**, and select the new `SDC_HACKATHON_PROJECT` folder.

When you already have the project and want newer changes, open its folder in VS Code and run:

```powershell
git pull
```

If you have edited files locally, save open files, then commit or stash your code changes before pulling. Do not commit `.env` files, API keys, or Firebase service-account files.

## 2. Install the Python invoice-agent requirements

In the VS Code terminal, make sure the current folder is the project root, then run:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

The dependency file is `requirements.txt` at the project root. The invoice-agent source code remains in `src/`.

To print the full path to the Python executable inside this project's virtual environment, run this from the project root:

```powershell
.\.venv\Scripts\python.exe -c "import sys; print(sys.executable)"
```

Copy the printed path into `PYTHON_EXECUTABLE` in `.env` in Step 5. For example, it will look similar to `C:\Users\YourName\path\to\SDC_HACKATHON_PROJECT\.venv\Scripts\python.exe`. Forward slashes also work in `.env` values.

## 3. Install the app requirements

In the same terminal, run:

```powershell
cd server
npm install
cd ..
cd client
npm install
cd ..
```

Run `npm install` separately in `server/` and `client/`; each folder has its own `package.json` and lockfile. The final `cd ..` returns the terminal to the project root.

## 4. Set up your AI API key and model

Get an API key from the AI provider you want to use. This API key is separate from your Firebase service-account JSON file. Copy the example file at the project root:

```powershell
Copy-Item .env.example .env
```

Open the root `.env` file in VS Code and replace the example AI values with the details from your provider:

```dotenv
# Invoice agent: choose a model with image input and tool/function calling
APIKEY=your_provider_api_key
AI_URL=https://your_provider_base_url/v1
BASEMODEL=your_vision_and_tool_calling_model

# Liggy Help chatbot: these can use the same provider settings if supported
OPENAI_API_KEY=your_provider_api_key
OPENAI_BASE_URL=https://your_provider_base_url/v1
OPENAI_MODEL=your_json_capable_model
```

Use the exact base URL and model ID from your provider. The invoice agent needs image input for JPG and scanned documents, and tool/function calling to return structured invoice fields. The chatbot model needs JSON response support. If the same model supports both workflows, use the same key, URL, and model in both groups. These settings require an OpenAI-compatible API, not an OpenAI account. DeepSeek is optional; use the URL and model ID currently documented by whichever provider you choose.

Keep `.env` private and do not upload it to GitHub. The app also reads Firebase and server settings from this same root `.env` file; fill those in during Step 5. Generate a random session secret with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## 5. Set up Firebase Cloud Firestore

1. Create or select a project in the [Firebase console](https://console.firebase.google.com/).
2. Create a **Cloud Firestore** database in **Native mode**.
3. In **Project settings → Service accounts**, generate and download a service-account JSON key.
4. Store the JSON file somewhere private, outside the project folder and outside GitHub.

Open the root `.env` file and set these Firebase and server values:

```dotenv
GOOGLE_CLOUD_PROJECT=your-firebase-project-id
GOOGLE_APPLICATION_CREDENTIALS=C:/full/path/to/your-firebase-service-account.json
SESSION_SECRET=paste-the-random-value-you-generated
PYTHON_EXECUTABLE=C:/full/path/to/SDC_HACKATHON_PROJECT/.venv/Scripts/python.exe
```

For `GOOGLE_CLOUD_PROJECT`, use the Firebase project's **Project ID**. For `GOOGLE_APPLICATION_CREDENTIALS`, use the full path to the downloaded JSON file. For `PYTHON_EXECUTABLE`, use the full path to the virtual-environment Python from Step 2. Forward slashes work in Windows `.env` paths. Do not paste the JSON contents into the README or commit the key file.

The app's backend uses Firebase Admin credentials to access Firestore. Firebase is needed even when the website runs locally because account, customer, and invoice-history data are stored in the cloud database. This is not the Firebase web app configuration or a Firebase API key.

If you already configured Google Application Default Credentials (ADC), leave `GOOGLE_APPLICATION_CREDENTIALS` blank. See Google's [local ADC setup guide](https://cloud.google.com/docs/authentication/set-up-adc-local-dev-environment).

For local development without a cloud Firestore database, use the Firestore Emulator instead. Install the Firebase CLI and Java, run `firebase emulators:start --only firestore --project demo-liggy` from the project root, then set `GOOGLE_CLOUD_PROJECT=demo-liggy`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, and leave `GOOGLE_APPLICATION_CREDENTIALS` blank. Keep the emulator running while you use the app.

The SMTP fields in `.env.example` are optional. Configure them only if you want Liggy to send invoice PDFs by email.

## 6. Run the backend and website

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

The team used Replit to design and refine the required website interface. The resulting frontend belongs in `client/`, which contains the React pages, components, and styles. When transferring a UI change from Replit, bring the updated frontend files into this project's `client/` folder and run the app locally using the steps above. The current live app is linked in [Project links](#project-links).

The browser talks to the Express API through `/api` requests. For a local run, keep provider API keys, Firebase service-account credentials, and other secrets in the root `.env`; never put them in React code or Vite client-side environment variables, where visitors could retrieve them. In Replit, add the required values through **Secrets** instead of committing an `.env` file.

The root [`.replit`](.replit) configuration runs [`replit-start.sh`](replit-start.sh), which prepares the Python and Node dependencies and starts the frontend and API for a Replit workspace preview. Add the AI settings as Replit Secrets. The current Firebase backend expects `GOOGLE_APPLICATION_CREDENTIALS` to point to a service-account JSON file, so make that file available privately in the Replit environment and set the path as a Secret; do not commit the key file. The Replit workspace run configuration is for preview and is not by itself a production deployment configuration.

**Replit proof of use:** _[Add the completed proof-of-use document at `submission/SDC2026_ChiliPanMEEPenang_Replit_POU.pdf` after downloading and completing the official template.]_

### RunPod — hosted model inference for the agent

The team uses RunPod as an AI model API service for the invoice agent. The backend launches the Python workflow, and the workflow sends document text or supported invoice images to the configured model API. The AI response is then checked by the workflow; the user reviews and approves the invoice before it is saved to Firestore and rendered as a PDF. Add the endpoint's public URL (never its secret token) in [Project links](#project-links) if the submission requires it.

Configure the RunPod endpoint in the root `.env`:

- `APIKEY` — the private key/token required by the endpoint.
- `AI_URL` — the endpoint's API base URL, using the format expected by its provider.
- `BASEMODEL` — the model name or ID expected by the endpoint.

The current invoice-agent implementation uses an OpenAI-compatible Chat Completions interface. Its model must support image input and tool/function calling. If Liggy AI Help uses that same endpoint, set `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` to compatible values too; its model must support JSON responses. If the RunPod worker exposes a different request format, it needs a server-side adapter before it can work with this code. Do not expose the RunPod token in `client/`.

RunPod is the team's configured AI service; another compatible AI provider can be used for local development by changing the environment values. Firestore is still needed for sign-in and saved customer/invoice records. The `runpod/` folder is currently documentation space; it does not contain an automatic deployment configuration. Add the completed official proof-of-use document at `submission/SDC2026_ChiliPanMEEPenang_Runpod_POU.pdf` when available.

## Challenges and learnings

_[Fill this section in before submission. Describe the main development or integration challenges, how the team addressed them, and what the team learned about agent workflows, invoice processing, security, or deployment.]_

## Future improvements

- [ ] _[Add a planned feature or improvement.]_
- [ ] _[Add another planned feature or improvement.]_

## Team roles and profiles

| Name                  | Role                               | GitHub profile                                       |
| --------------------- | ---------------------------------- | ---------------------------------------------------- |
| Tai Kai Xuan          | Team leader — _[add project role]_ | _[add profile link or leave blank]_                  |
| Soo Jiaquan           | _[add project role]_               | _[add profile link or leave blank]_                  |
| Chung Wei Yong        | _[add project role]_               | [@CHUNG-WEI-YONG](https://github.com/CHUNG-WEI-YONG) |
| Aaron Ling Ji Hong    | _[add project role]_               | _[add profile link or leave blank]_                  |
| Kenneth Saw Chzi Yang | _[add project role]_               | _[add profile link or leave blank]_                  |


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
