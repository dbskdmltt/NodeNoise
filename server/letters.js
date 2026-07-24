import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LETTERS_FILE = path.join(__dirname, "letters.json");

function readLetters() {
  try {
    return JSON.parse(fs.readFileSync(LETTERS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeLetters(letters) {
  fs.writeFileSync(LETTERS_FILE, JSON.stringify(letters, null, 2));
}

export function getLetters() {
  return readLetters();
}

export function addLetter({ text, censoredText }) {
  const letters = readLetters();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    censoredText,
    createdAt: new Date().toISOString(),
  };
  letters.push(entry);
  writeLetters(letters);
  return entry;
}
