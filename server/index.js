import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { randomUUID, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { processMessage } from "./services/aiService.js";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serverDirectory, "..");
dotenv.config({ path: path.join(projectRoot, ".env"), override: false });
dotenv.config({ path: path.join(serverDirectory, ".env"), override: false });
dotenv.config({ path: path.join(projectRoot, "src", ".env"), override: false });
// Firebase reads its project and credential settings during initialization.
// Import it only after all supported .env locations have been loaded.
const { db } = await import("./firebaseAdmin.js");

const app = express();
const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("Set SESSION_SECRET to a long random value before running Liggy in production.");
}
const SESSION_SECRET = process.env.SESSION_SECRET || "liggy-local-dev-secret-change-before-deploy";

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json({ limit: "15mb" }));

const bridge = spawn(process.env.PYTHON_EXECUTABLE || "python", [
  path.join(projectRoot, "src", "liggy_bridge.py"),
], {
  cwd: projectRoot,
  env: process.env,
  stdio: ["pipe", "pipe", "inherit"],
});
const pendingBridgeCalls = new Map();
const invoiceReviewOwners = new Map();
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
  console.error("Could not start the invoice agent. Check Python and the root requirements.txt.", error.message);
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

function signSession(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readSession(req) {
  const token = (req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith("liggy_session="))?.slice("liggy_session=".length);
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", SESSION_SECRET).update(payload).digest();
  let actual;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    // Firestore document IDs are strings; coercing one to Number produces NaN
    // and makes every authenticated lookup target a nonexistent account.
    return data.exp > Date.now() && data.id != null ? { id: String(data.id) } : null;
  } catch { return null; }
}

function passwordHash(password, salt = randomUUID()) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function passwordMatches(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function setSession(res, user) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `liggy_session=${signSession(user)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`);
}

app.post("/api/auth/register", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (username.length < 2 || username.length > 60) return res.status(400).json({ error: "Username must be between 2 and 60 characters." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 8 || password.length > 200) return res.status(400).json({ error: "Password must be at least 8 characters." });
  try {
    const user = await callInvoiceAgent({ action: "create_user", username, email, password_hash: passwordHash(password) });
    setSession(res, user);
    res.status(201).json({ user });
  } catch (error) {
    const duplicate = /unique|constraint|already exists|duplicate/i.test(error.message || "");
    if (!duplicate) {
      console.error("Account registration failed:", error.name || "Error", error.code || "unknown");
    }   
    res.status(duplicate ? 409 : 503).json({
      error: duplicate
        ? "An account with this email already exists. Sign in instead, or use a different email address."
        : "Account creation is temporarily unavailable. Check the backend logs and Firebase/Firestore connection.",
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  try {
    const record = await callInvoiceAgent({ action: "find_user", email });
    if (!record || !passwordMatches(password, record.password_hash)) return res.status(401).json({ error: "Email or password is incorrect." });
    const user = { id: record.id, username: record.username, email: record.email };
    setSession(res, user);
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: "Unable to sign in." });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", "liggy_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/auth/me", async (req, res) => {
  const session = readSession(req);
  if (!session) return res.json({ user: null });
  try {
    const user = await callInvoiceAgent({ action: "get_user", user_id: session.id });
    res.json({ user: user || null });
  } catch { res.status(500).json({ error: "Unable to check your account." }); }
});

app.use("/api", async (req, res, next) => {
  if (["/health", "/auth/register", "/auth/login", "/auth/logout", "/auth/me"].includes(req.path)) return next();
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: "Please sign in to continue." });
  try {
    const user = await callInvoiceAgent({ action: "get_user", user_id: session.id });
    if (!user) return res.status(401).json({ error: "Your account is unavailable. Please sign in again." });
    req.user = user;
    next();
  } catch { res.status(500).json({ error: "Unable to validate your account." }); }
});

app.get("/api/business-data", async (req, res) => {
  try {
    const data = await callInvoiceAgent({ action: "business_data", user_id: req.user.id });
    res.json({
      customers: data.customers,
      invoices: data.invoices.map((invoice) => {
        const fileName = path.basename(invoice.file_path || "");
        const fileUrl = fileName ? `/api/invoices/files/${encodeURIComponent(fileName)}` : null;
        return {
          ...invoice,
          file_path: undefined,
          preview_url: fileUrl,
          download_url: fileUrl ? `${fileUrl}?download=1` : null,
        };
      }),
    });
  } catch (error) {
    console.error("Business records error:", error.message);
    res.status(500).json({ error: error.message || "Unable to load business records." });
  }
});

app.post("/api/invoices/manual", async (req, res) => {
  try {
    const result = await callInvoiceAgent({ action: "manual", user_id: req.user.id, invoice_data: req.body || {} });
    invoiceReviewOwners.set(result.thread_id, req.user.id);
    res.json(result);
  } catch (error) {
    console.error("Typed invoice error:", error.message);
    res.status(400).json({ error: error.message || "Unable to prepare this invoice." });
  }
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
    const result = await callInvoiceAgent({ action: "analyze", user_id: req.user.id, extension, content });
    invoiceReviewOwners.set(result.thread_id, req.user.id);
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
    if (invoiceReviewOwners.get(threadId) !== req.user.id) return res.status(403).json({ error: "This invoice review belongs to another account." });
    const result = await callInvoiceAgent({
      action: decision,
      user_id: req.user.id,
      thread_id: threadId,
      reason: typeof reason === "string" ? reason.slice(0, 1000) : "",
      invoice_data: req.body?.invoiceData,
    });
    if (decision === "approve" || decision === "reject") invoiceReviewOwners.delete(threadId);
    if (decision === "approve") {
      let fileName = path.basename(result.file_name || "");
      // Older agent responses may omit file_name even though the invoice was
      // persisted. Resolve it from this user's saved history as a fallback.
      if (!fileName && result.invoice_no) {
        try {
          const data = await callInvoiceAgent({ action: "business_data", user_id: req.user.id });
          const savedInvoice = (data.invoices || []).find((invoice) => invoice.invoice_no === result.invoice_no);
          fileName = path.basename(savedInvoice?.file_path || "");
        } catch (error) {
          console.warn("Could not resolve approved invoice PDF from history:", error.message);
        }
      }
      if (fileName && fileName.toLowerCase().endsWith(".pdf")) {
        const fileUrl = `/api/invoices/files/${encodeURIComponent(fileName)}`;
        return res.json({
          ...result,
          preview_url: fileUrl,
          download_url: `${fileUrl}?download=1`,
        });
      }
    }
    res.json(result);
  } catch (error) {
    console.error("Invoice decision error:", error.message);
    res.status(500).json({ error: error.message || "Unable to save this invoice decision." });
  }
});

app.post("/api/invoices/:invoiceNo/send", async (req, res) => {
  try {
    const result = await callInvoiceAgent({ action: "send_email", user_id: req.user.id, invoice_no: req.params.invoiceNo });
    res.json(result);
  } catch (error) {
    console.error("Invoice email error:", error.message);
    res.status(400).json({ error: error.message || "Unable to send this invoice." });
  }
});

app.get("/api/invoices/files/:fileName", async (req, res) => {
  const fileName = req.params.fileName;
  if (path.basename(fileName) !== fileName || !fileName.toLowerCase().endsWith(".pdf")) {
    return res.status(400).json({ error: "Invalid invoice file." });
  }

  const invoicesDirectory = path.resolve(projectRoot, "generated_invoices");
  const filePath = path.resolve(invoicesDirectory, fileName);
  if (!filePath.startsWith(`${invoicesDirectory}${path.sep}`)) {
    return res.status(400).json({ error: "Invalid invoice file." });
  }

  try {
    const data = await callInvoiceAgent({ action: "business_data", user_id: req.user.id });
    const ownsFile = data.invoices.some((invoice) => path.basename(invoice.file_path || "") === fileName);
    if (!ownsFile) return res.status(404).json({ error: "Invoice PDF was not found." });
  } catch {
    return res.status(500).json({ error: "Unable to verify invoice ownership." });
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
  const history = Array.isArray(req.body?.history)
    ? req.body.history.slice(-8).filter((entry) => ["user", "assistant"].includes(entry?.role) && typeof entry?.content === "string")
        .map((entry) => ({ role: entry.role, content: entry.content.slice(0, 1000) }))
    : [];

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      error: "Please enter a message."
    });
  }

  if (message.length > 2000) {
    return res.status(400).json({
      error: "Message is too long."
    });
  }

  try {
    const result = await processMessage(message.trim(), history);
    res.json(result);
  } catch (error) {
    console.error("Liggy AI error:", error.message);

    res.status(500).json({
      error: "Liggy could not process the request. Check the server terminal and API configuration."
    });
  }
});

app.get("/api/firebase-test", async (req, res) => {
  try {
    await db.collection("system").doc("connectionTest").set({
      connected: true,
      checkedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Liggy is connected to Firebase Firestore!",
    });
  } catch (error) {
    console.error("Firebase test failed:", error);

    res.status(500).json({
      success: false,
      error: "Firebase connection failed. Check the backend terminal.",
    });
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(projectRoot, "client", "dist")));
}

app.listen(PORT, () => {
  console.log(`Liggy backend running at http://localhost:${PORT}`);
});
