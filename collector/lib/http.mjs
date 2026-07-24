const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * fetch wrapper that retries on HTTP 429, honoring Retry-After when present
 * and falling back to exponential backoff otherwise.
 */
export async function fetchWithRetry(url, options = {}, { maxRetries = 3 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);

    if (res.status !== 429 || attempt === maxRetries) {
      return res;
    }

    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
    console.warn(`[http] 429 received, waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries}`);
    await sleep(waitMs);
  }

  throw new Error("unreachable");
}
