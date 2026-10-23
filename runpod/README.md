# RunPod AI API endpoint and Liggy's invoice agent

This project uses RunPod as an **AI inference API provider** for the invoice-agent workflow. The Liggy application and agent code remain in this repository. The app sends invoice text or image content to the configured model endpoint, then uses the agent workflow to extract and verify invoice details before the user approves saving the invoice.

> RunPod supplies the model API endpoint. This folder does not currently contain a RunPod worker image, deployment template, or scripts for hosting the full Liggy application on RunPod. The website and backend still run locally or on the app host (for example, Replit); they call the RunPod endpoint for model inference.

## Configure the invoice agent

Copy the provider's endpoint URL, API key, and model ID from your RunPod endpoint setup. Add them to the project-root `.env` file for local development, or add them as Secrets in the environment where the app runs:

```dotenv
APIKEY=your_runpod_api_key
AI_URL=your_runpod_openai_compatible_base_url
BASEMODEL=the_model_id_available_from_your_endpoint
```

Use the exact base URL and model ID provided for your RunPod endpoint. Endpoint URL formats depend on how the RunPod workload is configured, so do not copy an example URL from another endpoint. Keep the API key private, do not commit `.env`, and restart the backend after changing these settings.

The invoice agent expects a model endpoint compatible with the OpenAI chat completions interface and capable of the features used by the workflow. Image invoice extraction also needs a vision-capable model. If the selected model or endpoint does not support the required request format, invoice analysis can fail even if the API key is valid.

## How a request reaches RunPod

1. The Liggy client sends typed invoice details or an uploaded invoice document to the Express API.
2. The Express backend sends the request to the Python process through `src/liggy_bridge.py`.
3. The Python bridge creates `InvoicePipelineService` when the first invoice request arrives.
4. `src/main.py` configures the model client from `APIKEY`, `AI_URL`, and `BASEMODEL` and builds the invoice workflow.
5. The workflow extracts and verifies the invoice. The user reviews the results and approves or rejects them in Liggy.
6. After approval, the app generates the PDF and records the invoice in Firestore.

## Source files

- `src/main.py` — configures the invoice model client and exposes the invoice pipeline service.
- `src/agents.py` — contains invoice extraction/verification workflow logic and PDF/database save steps. The source file is named `agents.py` (plural), not `agent.py`.
- `src/workflow.py` — connects the agent steps and defines the workflow transitions.
- `src/document_reader.py` — reads uploaded invoice files and uses the configured model for image interpretation where needed.
- `src/schema.py` — defines the invoice state fields passed between workflow steps.
- `src/liggy_bridge.py` — connects the Node backend to the Python invoice workflow and loads the configured endpoint values.
- `src/server/index.js` — serves the app API and launches the Python bridge.

## Invoice agent versus Liggy Help chatbot

The RunPod settings above configure the **invoice agent**. Liggy Help is a separate service in `src/server/services/aiService.js`; it reads `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL`. To use RunPod for the chatbot too, provide compatible values for those three settings as well. The chatbot is not used to extract, approve, or save invoices.

## Troubleshooting

- If `/api/health` reports `"invoiceAgent":"failed"`, inspect the backend logs for Python bridge startup errors. Firebase credentials are also required for the bridge to finish startup; an AI key alone does not make login or Firestore available.
- If the bridge is ready but invoice analysis fails, check that `APIKEY` is valid, `AI_URL` is the endpoint's correct API base URL, and `BASEMODEL` names a model available through that endpoint.
- If image extraction fails while text prompts work, verify that the deployed model supports image input.
- Never paste API keys, complete service-account JSON, customer invoice data, or private `.env` contents into logs, README files, or public repositories.
