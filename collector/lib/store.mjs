import { existsSync, readFileSync, appendFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const ARCHIVE_PATH = path.join(DATA_DIR, "archive.jsonl");

function dedupeKey(record) {
  return record.url || `${record.source}:${record.category}:${record.keyword}:${record.collectedAt.slice(0, 10)}`;
}

function loadExistingKeys() {
  if (!existsSync(ARCHIVE_PATH)) return new Set();

  const lines = readFileSync(ARCHIVE_PATH, "utf-8").split("\n").filter(Boolean);
  const keys = new Set();
  for (const line of lines) {
    try {
      keys.add(dedupeKey(JSON.parse(line)));
    } catch {
      // skip malformed lines rather than aborting the whole load
    }
  }
  return keys;
}

/**
 * Filters out records already present in the archive (by URL, or by a
 * source+category+keyword+day fallback key for records without a URL, like
 * DataLab signals), appends the new ones, and writes a same-day snapshot.
 */
export function saveNewRecords(records) {
  mkdirSync(DATA_DIR, { recursive: true });

  const existingKeys = loadExistingKeys();
  const newRecords = records.filter((record) => !existingKeys.has(dedupeKey(record)));

  if (newRecords.length === 0) {
    return { saved: 0, skipped: records.length };
  }

  const lines = newRecords.map((record) => JSON.stringify(record)).join("\n") + "\n";
  appendFileSync(ARCHIVE_PATH, lines, "utf-8");

  const today = new Date().toISOString().slice(0, 10);
  const snapshotPath = path.join(DATA_DIR, `${today}.json`);
  const existingSnapshot = existsSync(snapshotPath) ? JSON.parse(readFileSync(snapshotPath, "utf-8")) : [];
  writeFileSync(snapshotPath, JSON.stringify([...existingSnapshot, ...newRecords], null, 2), "utf-8");

  return { saved: newRecords.length, skipped: records.length - newRecords.length, newRecords };
}
