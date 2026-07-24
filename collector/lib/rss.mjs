import Parser from "rss-parser";

const parser = new Parser();

/**
 * Reads one RSS feed and returns normalized records. A feed that fails to
 * load (dead URL, network error) is logged and skipped so the rest of the
 * run keeps going.
 */
export async function fetchRssFeed({ name, url, category }) {
  const collectedAt = new Date().toISOString();

  let feed;
  try {
    feed = await parser.parseURL(url);
  } catch (err) {
    console.warn(`[rss] failed to load "${name}" (${url}): ${err.message}`);
    return [];
  }

  return (feed.items ?? [])
    .filter((item) => item.link)
    .map((item) => ({
      title: item.title ?? "(제목 없음)",
      source: "RSS",
      category,
      keyword: name,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : collectedAt,
      url: item.link,
      summary: item.contentSnippet ?? item.summary ?? "",
      collectedAt,
    }));
}

export async function fetchAllFeeds(feeds) {
  const results = [];
  for (const feed of feeds) {
    results.push(...(await fetchRssFeed(feed)));
  }
  return results;
}
