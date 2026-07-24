import { Client } from "@notionhq/client";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CATEGORY_LABELS = {
  dmz_region: "DMZ 접경지역",
  migrant_voice: "이주여성 당사자 목소리",
  migration_policy: "결혼이주여성/다문화 정책",
};

// select/multi_select options are auto-created by the Notion API when a page
// uses a new value, but status options are not — they can only be picked
// from the set already defined in the database, so those need a fallback.
function valueForType(propDef, rawValue, warn, field) {
  if (rawValue === null || rawValue === undefined || rawValue === "") return null;

  switch (propDef.type) {
    case "title":
      return { title: [{ text: { content: String(rawValue).slice(0, 2000) } }] };
    case "rich_text":
      return { rich_text: [{ text: { content: String(rawValue).slice(0, 2000) } }] };
    case "select":
      return { select: { name: String(rawValue).slice(0, 100) } };
    case "multi_select":
      return {
        multi_select: String(rawValue)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((name) => ({ name: name.slice(0, 100) })),
      };
    case "date":
      return { date: { start: rawValue } };
    case "url":
      return { url: rawValue };
    case "status": {
      const options = propDef.options ?? [];
      const name = options.includes(rawValue) ? rawValue : options[0];
      if (!name) return null;
      if (name !== rawValue) {
        warn(`"${field}" 상태값 "${rawValue}"이 없어 "${name}"(으)로 대체합니다 (노션에서 상태 옵션에 추가 가능)`);
      }
      return { status: { name } };
    }
    case "number":
      return { number: Number(rawValue) };
    default:
      return undefined; // signals "unsupported type" vs. "no value" (null)
  }
}

/**
 * Builds a Notion properties payload for a record, adapting to whatever
 * property names/types actually exist in the target database instead of
 * assuming a fixed schema. Fields that don't exist in the database, or whose
 * type we don't know how to fill, are skipped (and reported once by the
 * caller) rather than failing the whole push.
 */
function buildProperties(record, schema, warn) {
  const properties = {};

  const titlePropName = Object.entries(schema).find(([, def]) => def.type === "title")?.[0];
  if (titlePropName) {
    properties[titlePropName] = valueForType(schema[titlePropName], record.title, warn, titlePropName);
  } else {
    warn("데이터베이스에 제목(title) 속성이 없습니다");
  }

  const rawByField = {
    출처: record.source,
    카테고리: CATEGORY_LABELS[record.category] ?? record.category,
    키워드: record.keyword,
    발행일: record.publishedAt?.slice(0, 10),
    수집일: record.collectedAt?.slice(0, 10),
    링크: record.url,
    요약: record.summary,
    상태: "미확인",
  };

  for (const [field, rawValue] of Object.entries(rawByField)) {
    const def = schema[field];
    if (!def) {
      warn(`"${field}" 속성이 데이터베이스에 없어 건너뜁니다`);
      continue;
    }
    const value = valueForType(def, rawValue, warn, field);
    if (value === undefined) {
      warn(`"${field}" 속성 타입(${def.type})은 지원하지 않아 건너뜁니다`);
      continue;
    }
    if (value !== null) {
      properties[field] = value;
    }
  }

  return properties;
}

async function createPageWithRetry(client, databaseId, properties, label, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await client.pages.create({ parent: { database_id: databaseId }, properties });
      return true;
    } catch (err) {
      const isRateLimited = err.status === 429 || err.code === "rate_limited";
      if (!isRateLimited || attempt === maxRetries) {
        console.warn(`[notion] failed to save "${label}": ${err.message}`);
        return false;
      }
      const waitMs = 2 ** attempt * 1000;
      console.warn(`[notion] rate limited, waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries}`);
      await sleep(waitMs);
    }
  }
  return false;
}

/**
 * Pushes each record to the Notion database as a new page. Returns
 * { attempted, saved } without throwing — a Notion failure should never
 * take down the local archive that already succeeded.
 */
export async function pushToNotion(records, { token, databaseId }) {
  if (!token || !databaseId) {
    console.log("[notion] NOTION_TOKEN/NOTION_DB_ID not set — skipping Notion sync");
    return { attempted: 0, saved: 0 };
  }
  if (records.length === 0) {
    return { attempted: 0, saved: 0 };
  }

  const client = new Client({ auth: token });

  let db;
  try {
    db = await client.databases.retrieve({ database_id: databaseId });
  } catch (err) {
    console.warn(`[notion] failed to read database schema: ${err.message}`);
    return { attempted: records.length, saved: 0 };
  }
  const schema = Object.fromEntries(
    Object.entries(db.properties).map(([name, prop]) => [
      name,
      { type: prop.type, options: prop[prop.type]?.options?.map((o) => o.name) },
    ])
  );

  const warned = new Set();
  const warn = (msg) => {
    if (warned.has(msg)) return;
    warned.add(msg);
    console.warn(`[notion] ${msg}`);
  };

  let saved = 0;
  for (const record of records) {
    const properties = buildProperties(record, schema, warn);
    const ok = await createPageWithRetry(client, databaseId, properties, record.title);
    if (ok) saved++;
  }

  return { attempted: records.length, saved };
}
