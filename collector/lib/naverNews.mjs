import { fetchWithRetry } from "./http.mjs";

function stripTags(html) {
  return html.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

/**
 * Searches Naver News for a keyword and returns normalized records.
 * https://developers.naver.com/docs/serviceapi/search/news/news.md
 */
export async function searchNaverNews({ keyword, category, clientId, clientSecret, display = 20 }) {
  const url = new URL("https://openapi.naver.com/v1/search/news.json");
  url.searchParams.set("query", keyword);
  url.searchParams.set("display", String(display));
  url.searchParams.set("sort", "date");

  const res = await fetchWithRetry(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });

  if (!res.ok) {
    throw new Error(`Naver News API ${res.status}: ${await res.text()}`);
  }

  const body = await res.json();
  const collectedAt = new Date().toISOString();

  return body.items.map((item) => ({
    title: stripTags(item.title),
    source: "NaverNews",
    category,
    keyword,
    publishedAt: new Date(item.pubDate).toISOString(),
    url: item.originallink || item.link,
    summary: stripTags(item.description),
    collectedAt,
  }));
}
