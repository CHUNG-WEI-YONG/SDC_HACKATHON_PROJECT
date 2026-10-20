
import "dotenv/config";
import express from "express";
import cors from "cors";
import { processMessage } from "./services/aiService.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173"
}));

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "Liggy",
    message: "Backend is running!"
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
