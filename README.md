# Liggy — Agentic E-Invoice Generator



Liggy is an AI-assisted e-invoice application for small businesses. It helps users extract and review invoice information, create invoice PDFs, and keep customer and sales records. The React website, Express API, and Python multi-agent invoice workflow are all organized under `src/` (`src/client/`, `src/server/`, and the Python modules at the top level of `src/`). Firestore stores user accounts, customers, and invoices. Approved invoice PDFs are written to `generated_invoices/` on the computer running the backend.

## Team and project

|                       |                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------ |
| **Team name**         | Chili Pan MEE Penang                                                                 |
| **Team domain**       | Domain 2 — Alpha Red                                                                 |
| **SDG track (1–17)**  | Not provided |
| **Team leader**       | Tai Kai Xuan                                                                         |
| **University**        | Taylor's University; Universiti Teknologi Malaysia                                    |
| **Number of members** | 5                                                                                    |
| **Team members**      | Soo Jiaquan, Tai Kai Xuan, Chung Wei Yong, Aaron Ling Ji Hong, Kenneth Saw Chzi Yang |

## Project links

| Resource            | Link                                                                             |
| ------------------- | -------------------------------------------------------------------------------- |
| GitHub repository   | [SDC_HACKATHON_PROJECT](https://github.com/CHUNG-WEI-YONG/SDC_HACKATHON_PROJECT) |
| Replit live demo    | [Open Liggy on Replit](https://sdchackathonproject-2.replit.app/)                |
| Implementation demo | https://youtu.be/ESC0dAIl8T8                                                     |
| RunPod endpoint     | Configured with `AI_URL` in local `.env` or private Replit Secrets; see [RunPod usage notes](runpod/README.md) |
| Slide deck          | https://drive.google.com/drive/folders/1p8ZpaN2ZKjMJ3OuVcsbuiWO3Cf-kmMO0?usp=sharing |
| Video Pitch         | https://youtu.be/-2Jy8WmOT34  |

## Overview

### Problem

E-invoicing can help businesses manage invoices and sales records, but small businesses may find it difficult to adopt digital tools or turn existing invoice documents into organized records. They need a straightforward way to capture invoice details, manage customer spending, and track sales.

### Solution

Liggy helps small businesses create and manage e-invoices. Its AI agent extracts invoice details from uploaded documents, while users can also enter details manually. Users review and approve the information before Liggy generates the PDF and saves the invoice record to its history. The saved records also contribute to customer and sales views.

Liggy’s agentic AI workflow is designed to reduce repetitive manual data entry and simplify invoice management, while keeping the user in control of approval.

### Key features

- Upload supported invoice documents or enter invoice details manually, then review the extracted information and preview.
- Use the invoice agent workflow to analyze documents and assist with invoice creation.
- Save approved invoices and PDFs, and review invoice history, customers, daily sales, and monthly insights.
- Ask Liggy AI Help questions about the application's invoice and agent workflow.

### Technology stack

| Layer                     | Technology                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Frontend                  | React and Vite (`src/client/`)                                                       |
| Backend API               | Node.js and Express (`src/server/`)                                                  |
| Agent workflow            | Python multi-agent invoice workflow (`src/`)                                         |
| Database                  | Firebase Cloud Firestore                                                             |
| AI / inference            | Configurable OpenAI-compatible model API; RunPod may host/provide the model endpoint |
| Development and UI design | VS Code for local development; Replit was used for frontend UI design and iteration  |

## Project structure

```text
sdc/
├── src/                    # All application source code
│   ├── client/              # React + Vite frontend
│   ├── server/              # Express API and Firebase Admin connection
│   ├── agents.py            # Invoice-agent verification logic
│   ├── main.py              # Python invoice workflow entry point
│   └── ...                  # Workflow, schema, database, PDF, and bridge modules
├── tests/                  # API security, bridge, startup, and load checks
├── example_payment/        # Sample JPG payment invoices ordered by image clarity
├── docs/                   # Project documentation
├── runpod/                 # RunPod AI endpoint usage notes
├── submission/             # Preliminary, technology, Replit, and RunPod documents
├── generated_invoices/     # PDFs created locally (ignored by Git)
├── requirements.txt        # Python agent dependencies
├── .env.example            # Safe template for local configuration
├── firebase.json           # Firebase CLI Firestore rules configuration
└── README.md               # Setup and project guide
```

### JPG payment image examples

The [`example_payment/`](example_payment/) folder is for sample JPG payment or invoice images used to check how well the document-upload workflow handles different image quality. Place ten JPG files there and number them by clarity: **level 1 is the clearest** and **level 10 is the least clear**. Suggested names are `level-01.jpg` through `level-10.jpg`.

To use an example, start Liggy, open **E-Invoice**, select the JPG, and choose **Analyze Invoice**. Compare the extracted fields with the image, note which details need manual correction, and verify that unclear or unreadable details are surfaced for review before approval. These examples are manual workflow samples; they are not automatically run by the Node test scripts in `tests/`.

### Architecture

The application request path is:

```text
Browser UI (src/client/) → API (src/server/) → invoice agent (Python modules in src/) → AI model API
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

The dependency file is `requirements.txt` at the project root. The invoice-agent source code, website, and API are organized under `src/`. The Python requirements file remains at the project root.

To print the full path to the Python executable inside this project's virtual environment, run this from the project root:

```powershell
.\.venv\Scripts\python.exe -c "import sys; print(sys.executable)"
```

Copy the printed path into `PYTHON_EXECUTABLE` in `.env` in Step 5. For example, it will look similar to `C:\Users\YourName\path\to\SDC_HACKATHON_PROJECT\.venv\Scripts\python.exe`. Forward slashes also work in `.env` values.

## 3. Install the app requirements

In the same terminal, run:

```powershell
cd src\server
npm install
cd ..\..
cd src\client
npm install
cd ..\..
```

Run `npm install` separately in `src/server/` and `src/client/`; each folder has its own `package.json` and lockfile. The `cd ..\..` commands return the terminal to the project root.

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
cd src\server
npm start
```

Keep the terminal open. The API launches the Python invoice agent automatically. You do not start the agent separately.

### Terminal 2 — website

```powershell
cd src\client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and create an account or sign in. Stop either process with **Ctrl+C** in its terminal.

## Run on Replit

1. Import this GitHub repository into Replit or open the existing Repl.
2. Add the required values under **Secrets**. For Firestore account access, set `GOOGLE_CLOUD_PROJECT` and `FIREBASE_SERVICE_ACCOUNT_JSON` (the complete service-account JSON value). Set `SESSION_SECRET` to a long, private random value.
3. To analyze invoices, also set `APIKEY`, `AI_URL`, and `BASEMODEL` for the OpenAI-compatible AI endpoint. Set `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` if you want the separate Liggy Help chatbot configured.
4. Press **Run**. The root `.replit` configuration starts the application.
5. For a published deployment, add the same required Secrets to the deployment environment and redeploy.

Never put secret values in the README, source code, or GitHub. The RunPod API key is supplied through `APIKEY`; use the RunPod endpoint URL in `AI_URL`.

## Use the app

On **E-Invoice**, type invoice details or upload a PDF, JPG/JPEG, PNG, WebP, TXT, JSON, or CSV document (up to 10 MB). Review the extracted fields and preview, then approve or reject. Approved invoices are saved to Firestore and their PDFs are written under `generated_invoices/`. Invoice History lets you preview or download saved PDFs. Customers, Daily Sales Report, and Monthly Insights use the signed-in account's saved invoices. Liggy AI answers questions about these app workflows. Email delivery requires SMTP configuration.

## Tests

See [tests/README.md](tests/README.md) for security checks, startup checks, load levels, and instructions. The tests do not run invoice generation or write business records.

## How Replit and RunPod fit into the project

### Replit — frontend design and iteration

The team used Replit to design and refine the required website interface. The frontend source is in `src/client/`. Replit's project configuration can also run the client and API for preview. The live app is linked in [Project links](#project-links).

For local development, keep API keys and credentials in the root `.env` file. In Replit, configure them as private Secrets. The Python invoice bridge needs Firestore access to validate accounts and save business records. Set `GOOGLE_CLOUD_PROJECT` and provide either `FIREBASE_SERVICE_ACCOUNT_JSON` containing the service-account JSON or `GOOGLE_APPLICATION_CREDENTIALS` pointing to a private key file available in that environment. Use credentials from the same Firebase project, and never commit or publish them.

The root [`.replit`](.replit) file runs [`replit-start.sh`](replit-start.sh) for the Replit workspace. The deployment build and start commands are configured separately in `.replit`; after changing Secrets, restart or redeploy so the backend receives the updated values.

### RunPod — hosted model inference for the agent

The team uses RunPod as an AI model API service for the invoice agent. The backend launches the Python workflow, and the workflow sends document text or supported invoice images to the configured model API. The AI response is then checked by the workflow; the user reviews and approves the invoice before it is saved to Firestore and rendered as a PDF. Add the endpoint's public URL (never its secret token) in [Project links](#project-links) if the submission requires it.

Configure the RunPod endpoint in the root `.env`:

- `APIKEY` — the private key/token required by the endpoint.
- `AI_URL` — the endpoint's API base URL, using the format expected by its provider.
- `BASEMODEL` — the model name or ID expected by the endpoint.

## Challenges and learnings

### Connecting the app to the AI workflow

Liggy's frontend, Express API, and Python invoice workflow run as separate parts of the application. Passing invoice data between them and configuring the model endpoint, API key, and model ID required careful coordination.

**What we learned:** Clear boundaries between services and consistent environment-variable setup make the workflow easier to run and troubleshoot. API keys and credentials must stay in private environment settings and must never be uploaded to GitHub.

### Extracting details from invoice documents

Invoice layouts and image quality vary. Blurry or poorly lit images can make invoice fields harder for the agent to read.

**What we learned:** AI extraction should support the user rather than replace review. Users can check and correct extracted details before approving an invoice.

### Keeping business records and PDFs available

Firestore stores invoice history and business data, while generated PDFs are written to the local `generated_invoices/` folder. A local PDF may be unavailable after a deployment or restart, even when its invoice record remains in Firestore.

**What we learned:** Database records and files need suitable persistent storage. The app can attempt to recreate a missing PDF from saved invoice details; a future cloud-storage integration would make PDF availability more reliable across deployments.

### Keeping users in control

AI can misread unclear documents or unexpected formats.

**What we learned:** A review-and-approval step helps users catch errors before an invoice becomes a saved business record.

## Future improvements

- Store generated PDFs in persistent cloud file storage so invoice previews remain available after restarts and deployments.
- Improve image preprocessing and evaluate extraction across different invoice languages, layouts, and image quality levels.
- Show which extracted fields need extra attention so users can review uncertain results more quickly.
- Add more date filters, charts, and export options to customer and sales reports.
- Let users review the recipient and email content before sending an invoice.
- Expand automated checks for invoice approval, PDF recovery, email delivery, and per-user data separation.
- Explore integration with an official e-invoicing platform after confirming its technical and business requirements.

## Team roles and profiles

| Name                  | Role                                    | GitHub profile                          |
| --------------------- | --------------------------------------- | --------------------------------------- |
| Tai Kai Xuan          | Team leader                             | https://github.com/xuan-yay             |
| Soo Jiaquan           | FrontEnd and Backend                    | https://github.com/Yiibruh111           |
| Chung Wei Yong        | Multiagent System Design                | https://github.com/CHUNG-WEI-YONG       |
| Aaron Ling Ji Hong    | System Testing                          | Not provided |
| Kenneth Saw Chzi Yang | Code Reviewing and Document Preparation | https://github.com/kennethsawchzi-pixel |



## Troubleshooting

- **`ERR_MODULE_NOT_FOUND` for a server package:** run `cd src\server` then `npm install`; wait for it to complete before `npm start`.
- **Website start script not found:** use `npm run dev` from `src/client/`.
- **Invoice agent cannot start:** confirm the Python requirements installed and `PYTHON_EXECUTABLE` points to `.venv/Scripts/python.exe`.
- **AI request fails:** check `APIKEY`, `AI_URL`, `BASEMODEL`, and the matching `OPENAI_...` values in the root `.env`, then restart the backend.
- **Firestore sign-in or save fails:** verify the Firebase project ID and service-account file path, or confirm the Firestore Emulator is running and `FIRESTORE_EMULATOR_HOST` is correct.
- **Email fails:** check the SMTP values. Invoice creation and saving work without email delivery configured.

See [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) for a folder map. Never commit `.env`, service-account keys, local databases, customer PDFs, generated invoices, or dependency/build folders. For production, use HTTPS, a unique session secret, secured credentials, backups, and persistent file storage.

## Submission checklist

- [x] Team name, domain, leader, and member names are listed.
- [x] SDG track
- [x] Slide deck
- [x] Live demo and demo video links are listed above.
- [x] Replit proof of use: [`SDC_Chili_Pan_MEE_Penang_REPLIT_Pou.pdf`](submission/SDC_Chili_Pan_MEE_Penang_REPLIT_Pou.pdf).
- [x] RunPod proof of use: [`SDC2026 Chili Pan MEE Penang RUNPOD Pou.pdf`](<submission/SDC2026 Chili Pan MEE Penang RUNPOD Pou.pdf>).
- [x] Preliminary submission: [`SDC Chili Pan MEE Penang Preliminary.pdf`](<submission/SDC Chili Pan MEE Penang Preliminary.pdf>).
- [x] Technology declaration: [`SDC ChiliPanMeePenang tools declaration docs.pdf`](<submission/SDC ChiliPanMeePenang tools declaration docs.pdf>).
- [x] Local setup and test instructions are documented above and in [`tests/README.md`](tests/README.md).
- [x] `.env`, API keys, and service-account credentials are excluded from Git.

## License

This project is licensed under the [Apache License 2.0](LICENSE).
