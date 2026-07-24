import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pushToNotion } from "./lib/notion.mjs";

// One-time helper: pushes every record already in the local archive to
// Notion. Has no duplicate-detection against Notion itself, so only run this
// against a freshly connected (empty) database — running it twice will
// create duplicate pages.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const archivePath = path.join(__dirname, "data", "archive.jsonl");

if (!existsSync(archivePath)) {
  console.log("[backfill-notion] no local archive found, nothing to push");
  process.exit(0);
}

const records = readFileSync(archivePath, "utf-8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

console.log(`[backfill-notion] pushing ${records.length} local records to Notion...`);
const result = await pushToNotion(records, {
  token: process.env.NOTION_TOKEN,
  databaseId: process.env.NOTION_DB_ID,
});
console.log(`[backfill-notion] done: ${result.saved}/${result.attempted} saved`);
