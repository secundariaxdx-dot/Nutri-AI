/** fetch con tiempo límite y mensajes de error comprensibles. */
export class NetworkError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export async function fetchJson<T>(url: string, opts: { timeoutMs?: number; signal?: AbortSignal; init?: RequestInit } = {}): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new NetworkError('Sin conexión a Internet. Puedes seguir usando la base de datos local.');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
  opts.signal?.addEventListener('abort', () => ctrl.abort());
  try {
    const res = await fetch(url, { ...opts.init, signal: ctrl.signal });
    if (res.status === 429) throw new NetworkError('El servicio ha limitado las peticiones. Inténtalo de nuevo en unos minutos.', 429);
    if (!res.ok) throw new NetworkError(`El servicio respondió con un error (${res.status}).`, res.status);
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof NetworkError) throw e;
    if ((e as Error).name === 'AbortError') {
      if (opts.signal?.aborted) throw e;
      throw new NetworkError('El servicio ha tardado demasiado en responder.');
    }
    throw new NetworkError('No se pudo conectar con el servicio. Comprueba tu conexión.');
  } finally {
    clearTimeout(timer);
  }
}
