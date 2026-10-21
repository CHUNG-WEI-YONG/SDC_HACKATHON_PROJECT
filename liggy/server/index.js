
import "dotenv/config";
import express from "express";
import cors from "cors";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { processMessage } from "./services/aiService.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173"
}));

app.use(express.json({ limit: "15mb" }));

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serverDirectory, "..", "..");
const bridge = spawn(process.env.PYTHON_EXECUTABLE || "python", [
  path.join(projectRoot, "src", "liggy_bridge.py"),
], {
  cwd: projectRoot,
  env: process.env,
  stdio: ["pipe", "pipe", "inherit"],
});
const pendingBridgeCalls = new Map();
let bridgeOutput = "";

bridge.stdout.setEncoding("utf8");
bridge.stdout.on("data", (chunk) => {
  bridgeOutput += chunk;
  const lines = bridgeOutput.split("\n");
  bridgeOutput = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const message = JSON.parse(line);
      const pending = pendingBridgeCalls.get(message.id);
      if (!pending) continue;
      pendingBridgeCalls.delete(message.id);
      if (message.ok) pending.resolve(message.result);
      else pending.reject(new Error(message.error || "Invoice agent failed."));
    } catch (error) {
      console.error("Invalid response from invoice agent bridge:", error.message);
    }
  }
});

bridge.on("error", (error) => {
  for (const pending of pendingBridgeCalls.values()) pending.reject(error);
  pendingBridgeCalls.clear();
  console.error("Could not start the invoice agent. Check Python and src/requirements.txt.", error.message);
});

bridge.on("exit", (code) => {
  const error = new Error(`Invoice agent process stopped${code === null ? "" : ` (code ${code})`}.`);
  for (const pending of pendingBridgeCalls.values()) pending.reject(error);
  pendingBridgeCalls.clear();
});

function callInvoiceAgent(payload) {
  if (!bridge.stdin.writable) {
    throw new Error("Invoice agent is unavailable. Restart the backend and check Python dependencies.");
  }
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    pendingBridgeCalls.set(id, { resolve, reject });
    bridge.stdin.write(`${JSON.stringify({ ...payload, id })}\n`, (error) => {
      if (error) {
        pendingBridgeCalls.delete(id);
        reject(error);
      }
    });
  });
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "Liggy",
    message: "Backend is running!"
  });
});

app.post("/api/invoices/analyze", async (req, res) => {
  const { fileName, content } = req.body || {};
  if (typeof fileName !== "string" || typeof content !== "string") {
    return res.status(400).json({ error: "Choose an invoice document to upload." });
  }
  const extension = path.extname(fileName).toLowerCase();
  const allowed = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".txt", ".json", ".csv"]);
  if (!allowed.has(extension)) {
    return res.status(400).json({ error: "Upload a PDF, image, TXT, JSON, or CSV invoice document." });
  }
  if (Buffer.byteLength(content, "base64") > 10 * 1024 * 1024) {
    return res.status(413).json({ error: "The invoice document must be 10 MB or smaller." });
  }
  try {
    const result = await callInvoiceAgent({ action: "analyze", extension, content });
    res.json(result);
  } catch (error) {
    console.error("Invoice analysis error:", error.message);
    res.status(500).json({ error: error.message || "Unable to analyze this invoice." });
  }
});

app.post("/api/invoices/:decision", async (req, res) => {
  const { decision } = req.params;
  if (!["approve", "reject"].includes(decision)) {
    return res.status(404).json({ error: "Unknown invoice decision." });
  }
  const { threadId, reason = "" } = req.body || {};
  if (typeof threadId !== "string") {
    return res.status(400).json({ error: "A valid invoice review session is required." });
  }
  try {
    const result = await callInvoiceAgent({
      action: decision,
      thread_id: threadId,
      reason: typeof reason === "string" ? reason.slice(0, 1000) : "",
    });
    if (decision === "approve" && result.file_name) {
      const fileUrl = `/api/invoices/files/${encodeURIComponent(result.file_name)}`;
      return res.json({
        ...result,
        preview_url: fileUrl,
        download_url: `${fileUrl}?download=1`,
      });
    }
    res.json(result);
  } catch (error) {
    console.error("Invoice decision error:", error.message);
    res.status(500).json({ error: error.message || "Unable to save this invoice decision." });
  }
});

app.get("/api/invoices/files/:fileName", (req, res) => {
  const fileName = req.params.fileName;
  if (path.basename(fileName) !== fileName || !fileName.toLowerCase().endsWith(".pdf")) {
    return res.status(400).json({ error: "Invalid invoice file." });
  }

  const invoicesDirectory = path.resolve(projectRoot, "generated_invoices");
  const filePath = path.resolve(invoicesDirectory, fileName);
  if (!filePath.startsWith(`${invoicesDirectory}${path.sep}`)) {
    return res.status(400).json({ error: "Invalid invoice file." });
  }

  const disposition = req.query.download === "1" ? "attachment" : "inline";
  res.sendFile(filePath, {
    headers: { "Content-Disposition": `${disposition}; filename="${fileName}"` },
  }, (error) => {
    if (error && !res.headersSent) {
      res.status(error.statusCode || 404).json({ error: "Invoice PDF was not found." });
    }
  });
});

app.post("/api/chat", async (req, res) => {
  const message = req.body?.message;

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      error: "Please enter a message."
    });
  }

  if (message.length > 6000) {
    return res.status(400).json({
      error: "Message is too long."
    });
  }

  try {
    const result = await processMessage(message.trim());
    res.json(result);
  } catch (error) {
    console.error("Liggy AI error:", error.message);

    res.status(500).json({
      error: "Liggy could not process the request. Check the server terminal and API configuration."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Liggy backend running at http://localhost:${PORT}`);
});
