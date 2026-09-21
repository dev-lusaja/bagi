export interface FallbackResult {
  response: Response;
  usedFallback: boolean;
}

/**
 * Reintenta con backoff exponencial + jitter en 429/503, y si el proveedor principal
 * sigue fallando después de los reintentos, hace un único intento con el fallback.
 * Agnóstico de proveedor: no conoce la forma del payload, solo el status HTTP.
 */
export async function fetchWithFallback(
  primaryAttempt: () => Promise<Response>,
  fallbackAttempt: () => Promise<Response>,
  retries = 2,
  initialDelayMs = 1000
): Promise<FallbackResult> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const makeRequestWithRetry = async (attempt: () => Promise<Response>): Promise<Response> => {
    let currentDelay = initialDelayMs;
    for (let i = 0; i <= retries; i++) {
      const response = await attempt();
      if (response.status !== 429 && response.status !== 503) return response;

      if (i < retries) {
        const jitter = Math.random() * 200;
        const sleepTime = currentDelay + jitter;
        console.warn(`[Bagi IA Debug] HTTP ${response.status}. Retrying in ${Math.round(sleepTime)}ms (attempt ${i + 1}/${retries})...`);
        await delay(sleepTime);
        currentDelay *= 2;
      } else {
        return response;
      }
    }
    return attempt();
  };

  const primaryResponse = await makeRequestWithRetry(primaryAttempt);

  if (primaryResponse.status === 429 || primaryResponse.status === 503) {
    console.warn('[Bagi IA Debug] Primary model rate-limited/unavailable after retries. Switching to fallback model...');
    const fallbackResponse = await makeRequestWithRetry(fallbackAttempt);
    return { response: fallbackResponse, usedFallback: true };
  }

  return { response: primaryResponse, usedFallback: false };
}

/** True si el fetch falló porque AbortSignal.timeout() disparó (request colgado). */
export function isTimeoutError(e: unknown): boolean {
  const name = (e as { name?: string })?.name;
  return name === 'TimeoutError' || name === 'AbortError';
}
