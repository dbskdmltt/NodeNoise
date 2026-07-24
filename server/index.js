import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { getReply, TOPICS } from "./llm.js";
import { getLetters, addLetter } from "./letters.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, "..", "client", "dist");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/topics", (_req, res) => {
  res.json({ topics: TOPICS });
});

app.post("/api/chat", async (req, res) => {
  const { message, topicId, history } = req.body ?? {};

  if (typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  try {
    const { reply, mode } = await getReply({ message, topicId, history });
    res.json({ reply, mode });
  } catch (err) {
    console.error("[/api/chat] failed:", err);
    res.status(500).json({ error: "failed to generate reply" });
  }
});

app.get("/api/letters", (_req, res) => {
  res.json({ letters: getLetters() });
});

app.post("/api/letters", (req, res) => {
  const { text, censoredText } = req.body ?? {};

  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const entry = addLetter({ text, censoredText: censoredText ?? text });
  res.json({ letter: entry });
});

if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(
    process.env.ANTHROPIC_API_KEY
      ? "[server] ANTHROPIC_API_KEY set — using live Claude replies"
      : "[server] ANTHROPIC_API_KEY not set — using offline fallback replies"
  );
});
