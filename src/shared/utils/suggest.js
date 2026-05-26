// Fetch and cache suggested models for providers that expose a public models API
// Fetches via backend proxy to avoid CORS issues

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map(); // key: url|type → { data, expiresAt }
const pendingRequests = new Map(); // key: url|type → Promise<data>

function getCacheKey(fetcher) {
  return `${fetcher.url}::${fetcher.type}`;
}

/**
 * Fetch suggested models for a provider using its modelsFetcher config.
 * Results are cached in-memory for CACHE_TTL_MS.
 * @param {{ url: string, type: string }} fetcher
 * @returns {Promise<Array<{ id: string, name: string, contextLength?: number }>>}
 */
export async function fetchSuggestedModels(fetcher) {
  if (!fetcher?.url || !fetcher?.type) return [];

  const cacheKey = getCacheKey(fetcher);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const pendingRequest = pendingRequests.get(cacheKey);
  if (pendingRequest) return pendingRequest;

  const request = (async () => {
    const params = new URLSearchParams({ url: fetcher.url, type: fetcher.type });
    try {
      const res = await fetch(`/api/providers/suggested-models?${params}`);
      if (!res.ok) return [];
      const json = await res.json();
      const data = Array.isArray(json.data) ? json.data : [];
      cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    } catch {
      return [];
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, request);
  return request;
}
