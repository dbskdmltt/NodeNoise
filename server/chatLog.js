import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Point CHAT_LOG_FILE at a mounted volume (e.g. /data/chat-logs.jsonl on Railway) to keep logs
// across redeploys; the default lives next to the server code and is wiped on every deploy.
const LOG_FILE = process.env.CHAT_LOG_FILE || path.join(__dirname, "chat-logs.jsonl");
const MAX_FIELD_LENGTH = 2000;

function clip(value) {
  return typeof value === "string" ? value.slice(0, MAX_FIELD_LENGTH) : "";
}

// Logging must never break a chat reply, so failures are reported and swallowed.
export function appendChatLog({ sessionId, topicId, message, reply, mode }) {
  const entry = {
    at: new Date().toISOString(),
    sessionId: clip(sessionId).slice(0, 64),
    topicId: typeof topicId === "string" ? topicId.slice(0, 64) : null,
    mode,
    message: clip(message),
    reply: clip(reply),
  };
  fs.appendFile(LOG_FILE, JSON.stringify(entry) + "\n", (err) => {
    if (err) console.error("[chatLog] write failed:", err.message);
  });
}

export function readChatLogs() {
  try {
    return fs
      .readFileSync(LOG_FILE, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}
