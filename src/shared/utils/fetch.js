export class FetchTimeoutError extends Error {
  constructor(message = "Request timed out") {
    super(message);
    this.name = "FetchTimeoutError";
  }
}

export async function fetchWithTimeout(input, init = {}, timeoutMs = 4000, timeoutMessage = "Request timed out") {
  const controller = new AbortController();
  const cleanupTasks = [];
  const externalSignal = init?.signal;

  if (externalSignal?.aborted) {
    throw externalSignal.reason instanceof Error
      ? externalSignal.reason
      : new DOMException("The operation was aborted.", "AbortError");
  }

  if (externalSignal) {
    const abortFromExternalSignal = () => {
      controller.abort(
        externalSignal.reason instanceof Error
          ? externalSignal.reason
          : new DOMException("The operation was aborted.", "AbortError")
      );
    };

    externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
    cleanupTasks.push(() => externalSignal.removeEventListener("abort", abortFromExternalSignal));
  }

  const timeoutId = setTimeout(() => {
    controller.abort(new FetchTimeoutError(timeoutMessage));
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted && controller.signal.reason instanceof FetchTimeoutError) {
      throw new FetchTimeoutError(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    cleanupTasks.forEach((cleanup) => cleanup());
  }
}
