# Liggy — run it in VS Code

Follow these steps in order to download, configure, and run the whole app on Windows.

## Before you start

Install these tools:

- [Git](https://git-scm.com/downloads)
- [Node.js 22 or newer](https://nodejs.org/) (includes npm)
- [Python 3.10 or newer](https://www.python.org/downloads/)
- [Visual Studio Code](https://code.visualstudio.com/)

You also need a Firebase project with **Cloud Firestore** enabled, a Firebase service-account JSON file, and an API key from an OpenAI-compatible AI provider.

## 1. Clone the project and open it in VS Code

Open PowerShell or the VS Code terminal and run:

```powershell
git clone https://github.com/CHUNG-WEI-YONG/SDC_HACKATHON_PROJECT.git
cd SDC_HACKATHON_PROJECT
code .
```

If `code .` is not recognized, open VS Code, choose **File → Open Folder**, and select the new `SDC_HACKATHON_PROJECT` folder.

When you already have the project and want to download newer changes, open its folder in VS Code and run:

```powershell
git pull
```

If you have edited files locally, save your changes before pulling. Do not commit `.env` files, API keys, or Firebase service-account files.

## 2. Install the Python invoice-agent requirements

In the VS Code terminal, make sure the current folder is the project folder, then run:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r src\requirements.txt
```

## 3. Install the app requirements

In the same terminal, run:

```powershell
cd liggy\server
npm install
cd ..\client
npm install
cd ..\..
```

## 4. Set up your AI API key and model

Get an API key from the AI provider you want to use. This API key is different from your Firebase service-account JSON file. If `src/.env` does not exist yet, copy the AI settings example:

```powershell
Copy-Item src\.env.example src\.env
```

In VS Code's Explorer, open `src/.env`. Replace the example values with details from your AI provider:

```dotenv
# Invoice agent: use a model with image input and function/tool calling
APIKEY=your_provider_api_key
AI_URL=https://your_provider_base_url
BASEMODEL=your_vision_and_tool_calling_model

# Liggy Help chatbot: these can be the same provider settings
OPENAI_API_KEY=your_provider_api_key
OPENAI_BASE_URL=https://your_provider_base_url
OPENAI_MODEL=your_json_response_model
```

Use the exact base URL and model ID from your provider. The invoice agent needs image input for JPG/PDF scans and function/tool calling to return structured invoice fields. The chatbot model needs JSON response support. If the same model supports all of these, you can enter the same key, URL, and model in both groups. These setting names work with OpenAI-compatible providers; they do not require OpenAI.

DeepSeek is optional. If you choose it, an example configuration is:

```dotenv
APIKEY=your_deepseek_api_key
AI_URL=https://api.deepseek.com
BASEMODEL=deepseek-flash
OPENAI_API_KEY=your_deepseek_api_key
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-flash
```

Liggy does not choose a provider or model for you. Set all six AI values in `src/.env`. Keep this file private and do not upload it to GitHub.

## 5. Set up Firebase Firestore

1. Create or select a project in the [Firebase console](https://console.firebase.google.com/).
2. Create a **Cloud Firestore** database in Native mode.
3. In **Project settings → Service accounts**, create and download a service-account JSON key.
4. Store that JSON file somewhere private, outside the project folder.

If `liggy/server/.env` does not exist yet, copy the server settings file:

```powershell
Copy-Item liggy\server\.env.example liggy\server\.env
```

Open `liggy/server/.env` in VS Code. Set these values:

```dotenv
PYTHON_EXECUTABLE=C:/full/path/to/SDC_HACKATHON_PROJECT/.venv/Scripts/python.exe
SESSION_SECRET=replace-with-a-long-private-random-value
GOOGLE_CLOUD_PROJECT=your-firebase-project-id
GOOGLE_APPLICATION_CREDENTIALS=C:/full/path/to/your-firebase-service-account.json
```

For `PYTHON_EXECUTABLE`, use the full path to the `.venv` created in Step 2. For `GOOGLE_APPLICATION_CREDENTIALS`, use the full path to the service-account JSON file. Keep forward slashes in these `.env` paths. You can generate a session secret by running this in the terminal and copying its output into the file:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

If you already configured Google Application Default Credentials instead of using a service-account JSON file, leave `GOOGLE_APPLICATION_CREDENTIALS` blank. Local ADC setup instructions are in Google's [guide](https://cloud.google.com/docs/authentication/set-up-adc-local-dev-environment).

SMTP settings in this file are optional. Set them only if you want the app to send invoice PDFs by email.

## 6. Run the backend and website

The backend and website need **two VS Code terminals**. In VS Code, choose **Terminal → New Terminal** to open each one.

### Terminal 1 — backend and invoice agent

```powershell
cd liggy\server
npm start
```

Leave this terminal open. The backend starts the Python invoice agent automatically; you do not need to run the agent separately.

### Terminal 2 — website

```powershell
cd liggy\client
npm run dev
```

Leave this terminal open too. Open **http://localhost:5173** in your browser. Create an account or sign in.

To stop a server, click its terminal and press **Ctrl+C**.

## What the app does

- **E-Invoice:** enter invoice details or upload a PDF, JPG/JPEG, PNG, WebP, TXT, JSON, or CSV file (up to 10 MB). Review the agent's extracted fields, verify the preview, then approve or reject. Approved invoices are saved to Firestore, and their PDFs are saved in `generated_invoices/`.
- **PDF preview and history:** preview the generated PDF below the approval section, save it to your computer, or open it from **Invoice History**.
- **Customers:** review customer records and invoice spending.
- **Daily Sales Report / Monthly Insights:** see totals from the signed-in account's saved invoices.
- **Liggy AI:** ask how to use the app's invoice workflow and business-record pages.
- **Email:** after approval, the app can offer to email the PDF if the customer has an email address. Sending requires SMTP settings.

Each account has separate records. Firestore stores account, customer, and invoice data; generated PDF files are stored on the server in `generated_invoices/`.

## If something does not start

- **AI settings error:** check all six provider settings in `src/.env`, then stop and restart the backend terminal.
- **`ERR_MODULE_NOT_FOUND` for `firebase-admin` or another server package:** from the project root, run `cd liggy\server` then `npm install`; wait for it to finish successfully before running `npm start`.
- **Website `npm start` is missing:** in `liggy\client`, use `npm run dev` (the client package defines the Vite `dev` script).
- **Function/tool-call or JSON response error:** choose a model/provider that supports the features listed in Step 4.
- **Firestore credential error:** check `GOOGLE_CLOUD_PROJECT`, the service-account path, and that the service account has access to Firestore.
- **`EPERM` during `npm install` / `npm ci`, or `firebase-admin` is still missing after an interrupted install:** close terminals running Node, open PowerShell in `liggy\server`, remove the incomplete dependency folder with `Remove-Item -Recurse -Force .\node_modules`, then run `npm ci` and wait for it to finish successfully. The server package uses the Node.js version already installed on your computer; it does not need to download a second Node.js executable.
- **Python agent unavailable:** check that `PYTHON_EXECUTABLE` points to `.venv/Scripts/python.exe` and that the Step 2 install completed.
- **Email error:** check the SMTP settings. Invoices can still be saved without email configured.
- **Changed `.env` values:** restart the backend after editing settings.

For production, use HTTPS, protect credentials, configure backups, and provide persistent storage for the generated PDF files.

## Run security and load checks

With the backend running, open a second VS Code terminal at the project root and run:

```powershell
node --test testing/app-security.test.mjs
node testing/load-test.mjs light
```

The test guide explains the optional signed-in check, the `medium` and `stress` load levels, and what the checks cover: [testing/README.md](testing/README.md).
