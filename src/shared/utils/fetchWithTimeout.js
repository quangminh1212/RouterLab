export class FetchTimeoutError extends Error {
  constructor(message = "Request timed out") {
    super(message);
    this.name = "AbortError";
  }
}

export async function fetchWithTimeout(input, init = {}, timeoutMs = 4000, timeoutMessage = "Request timed out") {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new FetchTimeoutError(timeoutMessage));
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new FetchTimeoutError(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
