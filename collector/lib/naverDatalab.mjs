import { fetchWithRetry } from "./http.mjs";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function average(nums) {
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

/**
 * Naver DataLab "통합 검색어 트렌드" API. Returns a *relative* interest index
 * (0-100 within the queried window), not raw search counts.
 * https://developers.naver.com/docs/serviceapi/datalab/search/search.md
 *
 * Reports one signal record per category comparing the last 3 days' average
 * relative index against the previous 3 days, for all keywords in that
 * category OR'd together.
 */
export async function fetchDatalabSignals({ keywordsByCategory, clientId, clientSecret }) {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 13); // 14-day window: enough for two 3-day comparison periods

  const keywordGroups = Object.entries(keywordsByCategory).map(([category, keywords]) => ({
    groupName: category,
    keywords,
  }));

  const res = await fetchWithRetry("https://openapi.naver.com/v1/datalab/search", {
    method: "POST",
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: isoDate(startDate),
      endDate: isoDate(endDate),
      timeUnit: "date",
      keywordGroups,
    }),
  });

  if (!res.ok) {
    throw new Error(`Naver DataLab API ${res.status}: ${await res.text()}`);
  }

  const body = await res.json();
  const collectedAt = new Date().toISOString();

  return body.results.map((result) => {
    const values = result.data.map((point) => point.ratio);
    const recent = average(values.slice(-3));
    const previous = average(values.slice(-6, -3));
    const changeRate = previous > 0 ? ((recent - previous) / previous) * 100 : null;

    const changeText =
      changeRate === null
        ? "이전 구간 데이터 부족으로 변화율 계산 불가"
        : `최근 3일 평균 상대지수 ${recent.toFixed(1)} (이전 3일 대비 ${changeRate >= 0 ? "+" : ""}${changeRate.toFixed(1)}%)`;

    return {
      title: `[검색 관심도] ${result.title}`,
      source: "NaverDatalab",
      category: result.title,
      keyword: keywordsByCategory[result.title]?.join(", ") ?? result.title,
      publishedAt: collectedAt,
      url: null,
      summary: changeText,
      collectedAt,
    };
  });
}
