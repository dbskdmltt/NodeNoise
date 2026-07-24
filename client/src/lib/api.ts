import type { ChatMessage, LetterEntry } from "../types";

export interface SendChatArgs {
  message: string;
  topicId?: string;
  history: ChatMessage[];
}

export interface SendChatResult {
  reply: string;
  mode: "llm" | "offline";
}

export async function sendChat({ message, topicId, history }: SendChatArgs): Promise<SendChatResult> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, topicId, history }),
  });

  if (!res.ok) {
    throw new Error(`chat request failed: ${res.status}`);
  }

  return res.json();
}

export async function getLetters(): Promise<LetterEntry[]> {
  const res = await fetch("/api/letters");
  if (!res.ok) {
    throw new Error(`letters request failed: ${res.status}`);
  }
  const { letters } = await res.json();
  return letters;
}

export async function submitLetter(text: string, censoredText: string): Promise<LetterEntry> {
  const res = await fetch("/api/letters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, censoredText }),
  });
  if (!res.ok) {
    throw new Error(`submit letter failed: ${res.status}`);
  }
  const { letter } = await res.json();
  return letter;
}
