/** Errores normalizados de los proveedores de IA, con mensajes en español. */

export type AIErrorCode =
  | 'not_configured'
  | 'invalid_key'
  | 'permission'
  | 'quota'
  | 'personal_limit'
  | 'network'
  | 'timeout'
  | 'invalid_response'
  | 'model_unavailable'
  | 'image_rejected'
  | 'server'
  | 'aborted'
  | 'unsupported';

export const QUOTA_MESSAGE =
  'Has alcanzado el límite gratuito de análisis de inteligencia artificial. Puedes volver a intentarlo cuando se restablezca tu cuota o introducir los alimentos manualmente.';

export class AIError extends Error {
  constructor(
    readonly code: AIErrorCode,
    message: string,
    readonly details: { retryable?: boolean; retryAfterSec?: number; scope?: 'minute' | 'day' | 'unknown'; noFreeQuota?: boolean; status?: number } = {},
  ) {
    super(redactSecrets(message));
    this.name = 'AIError';
  }
}

/** Elimina cualquier cosa con forma de clave/secreto de un texto (logs, errores). */
export function redactSecrets(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, 'AIza…[oculto]')
    // Formato nuevo de claves de Google AI Studio (AQ.…)
    .replace(/\bAQ\.[0-9A-Za-z_-]{20,}/g, 'AQ.…[oculto]')
    .replace(/((?:^|[?&\s])(?:key|api-key|api_key)=)[^&\s]+/gi, '$1[oculto]')
    .replace(/\b(sk-|sb_secret_)[0-9A-Za-z_-]{10,}/g, '$1…[oculto]')
    .replace(/\b[0-9a-f]{32}\b/gi, '[oculto]');
}

export function isAIError(e: unknown): e is AIError {
  return e instanceof AIError;
}

/** Hora local equivalente a la medianoche del Pacífico (reinicio diario de Gemini). */
export function nextPacificMidnight(now = new Date()): Date {
  // Calcula el desfase del Pacífico para la fecha actual (PST/PDT) sin librerías.
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  const msIntoPtDay = ((hour * 60 + Number(parts.minute)) * 60 + Number(parts.second)) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - msIntoPtDay + 24 * 3600 * 1000);
}

export function describeError(e: unknown): { title: string; message: string; code: AIErrorCode } {
  if (!isAIError(e)) return { title: 'No se pudo analizar la foto', message: 'Error inesperado. Puedes añadir los alimentos manualmente.', code: 'server' };
  switch (e.code) {
    case 'quota':
    case 'personal_limit':
      return { title: 'Límite de análisis alcanzado', message: e.message, code: e.code };
    case 'not_configured':
      return { title: 'IA sin configurar', message: e.message, code: e.code };
    case 'invalid_key':
      return { title: 'Clave de API no válida', message: e.message, code: e.code };
    case 'network':
    case 'timeout':
      return { title: 'Problema de conexión', message: e.message, code: e.code };
    case 'model_unavailable':
      return { title: 'Modelo no disponible', message: e.message, code: e.code };
    case 'invalid_response':
      return { title: 'Respuesta no válida', message: e.message, code: e.code };
    default:
      return { title: 'No se pudo analizar la foto', message: e.message, code: e.code };
  }
}
