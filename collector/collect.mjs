import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { searchNaverNews } from "./lib/naverNews.mjs";
import { fetchDatalabSignals } from "./lib/naverDatalab.mjs";
import { fetchAllFeeds } from "./lib/rss.mjs";
import { saveNewRecords } from "./lib/store.mjs";
import { pushToNotion } from "./lib/notion.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keywordsByCategory = JSON.parse(readFileSync(path.join(__dirname, "keywords.json"), "utf-8"));
const { feeds } = JSON.parse(readFileSync(path.join(__dirname, "sources.json"), "utf-8"));

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

async function collectNaverNews() {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.log("[naver-news] NAVER_CLIENT_ID/SECRET not set — skipping");
    return [];
  }

  const records = [];
  for (const [category, keywords] of Object.entries(keywordsByCategory)) {
    for (const keyword of keywords) {
      try {
        const items = await searchNaverNews({ keyword, category, clientId: NAVER_CLIENT_ID, clientSecret: NAVER_CLIENT_SECRET });
        console.log(`[naver-news] "${keyword}" (${category}): ${items.length}건`);
        records.push(...items);
      } catch (err) {
        console.warn(`[naver-news] "${keyword}" failed: ${err.message}`);
      }
    }
  }
  return records;
}

async function collectRss() {
  if (feeds.length === 0) {
    console.log("[rss] sources.json에 등록된 피드가 없어 건너뜁니다");
    return [];
  }
  const records = await fetchAllFeeds(feeds);
  console.log(`[rss] ${feeds.length}개 피드에서 ${records.length}건 수집`);
  return records;
}

async function collectDatalab() {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.log("[naver-datalab] NAVER_CLIENT_ID/SECRET not set — skipping");
    return [];
  }
  try {
    const records = await fetchDatalabSignals({ keywordsByCategory, clientId: NAVER_CLIENT_ID, clientSecret: NAVER_CLIENT_SECRET });
    console.log(`[naver-datalab] ${records.length}개 카테고리 신호 수집`);
    return records;
  } catch (err) {
    console.warn(`[naver-datalab] failed: ${err.message}`);
    return [];
  }
}

async function main() {
  const newsRecords = await collectNaverNews();
  const rssRecords = await collectRss();
  const datalabRecords = await collectDatalab();

  const all = [...newsRecords, ...rssRecords, ...datalabRecords];
  const { saved, skipped, newRecords = [] } = saveNewRecords(all);
  console.log(`[store] 총 ${all.length}건 중 신규 ${saved}건 저장, 중복 ${skipped}건 제외`);

  const notionResult = await pushToNotion(newRecords, {
    token: process.env.NOTION_TOKEN,
    databaseId: process.env.NOTION_DB_ID,
  });
  if (notionResult.attempted > 0) {
    console.log(`[notion] ${notionResult.attempted}건 중 ${notionResult.saved}건 저장`);
  }
}

main().catch((err) => {
  console.error("[collect] unexpected failure:", err);
  process.exitCode = 1;
});
