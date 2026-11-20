/**
 * Proveedor Google Gemini (Gemini Developer API, Google AI Studio).
 *
 * - Endpoint `models/{model}:generateContent` (v1beta). Google recomienda la
 *   nueva Interactions API, pero desde el navegador su cabecera `Api-Revision`
 *   no está permitida por CORS (comprobado el 20/11/2026), mientras que
 *   generateContent sí lo está y sigue oficialmente soportado.
 * - La clave se envía en la cabecera `x-goog-api-key` (nunca en la URL, para que
 *   no aparezca en historiales ni registros).
 * - Una petición por análisis. Sin reintentos automáticos: así cada foto
 *   consume exactamente una petición de la cuota.
 */
import { getGeminiModel } from '@/config/aiProviders';
import { blobToBase64 } from '@/lib/image';
import { parseVisionResponse, VISION_JSON_SCHEMA, InvalidVisionResponseError } from '@/ai/vision/schema';
import { buildUserPrompt, VISION_SYSTEM_PROMPT } from '@/ai/vision/prompt';
import { AIError, QUOTA_MESSAGE, nextPacificMidnight, redactSecrets } from './errors';
import type { AIProvider, AnalyzeOptions, ProviderStatus, VisionAnalysis } from './types';

export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 60_000;

interface GoogleErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: { '@type'?: string; reason?: string; retryDelay?: string; violations?: { quotaId?: string; quotaMetric?: string; quotaValue?: string }[] }[];
  };
}

function firstError(body: unknown): GoogleErrorBody['error'] | undefined {
  // generateContent devuelve {error}; la Interactions API, [{error}].
  const b = Array.isArray(body) ? body[0] : body;
  return (b as GoogleErrorBody | undefined)?.error;
}

/** Traduce una respuesta de error de Google a un AIError comprensible. */
export function mapGeminiError(status: number, body: unknown, modelId: string): AIError {
  const err = firstError(body);
  const raw = redactSecrets(err?.message ?? '');
  const reasons = (err?.details ?? []).map((d) => d.reason).filter(Boolean);
  if (reasons.includes('API_KEY_INVALID') || /API key not valid|API key expired/i.test(raw)) {
    return new AIError('invalid_key', 'La clave de API no es válida o ha caducado. Revisa la clave en Ajustes › Inteligencia artificial.', { status });
  }
  if (status === 429 || err?.status === 'RESOURCE_EXHAUSTED') {
    const violations = (err?.details ?? []).flatMap((d) => d.violations ?? []);
    const ids = violations.map((v) => `${v.quotaId ?? ''} ${v.quotaMetric ?? ''}`).join(' ');
    const retry = (err?.details ?? []).find((d) => d.retryDelay)?.retryDelay;
    const retryAfterSec = retry ? Math.ceil(parseFloat(retry)) : undefined;
    const noFreeQuota = violations.some((v) => v.quotaValue === '0') || /limit: 0\b/.test(raw);
    const scope = /PerDay|per_day|RequestsPerDay/i.test(ids) ? 'day' : /PerMinute|per_minute/i.test(ids) ? 'minute' : 'unknown';
    let extra = '';
    if (noFreeQuota) extra = ` El modelo ${modelId} no tiene cuota gratuita en tu proyecto: elige otro modelo en Ajustes.`;
    else if (scope === 'minute') extra = ` Es un límite por minuto: espera ${retryAfterSec ?? 60} s.`;
    else if (scope === 'day')
      extra = ` La cuota diaria se restablece a medianoche del Pacífico (${nextPacificMidnight().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} en tu hora local).`;
    return new AIError('quota', QUOTA_MESSAGE + extra, { status, retryAfterSec, scope, noFreeQuota });
  }
  if (status === 404 || err?.status === 'NOT_FOUND') {
    return new AIError('model_unavailable', `El modelo «${modelId}» no está disponible. Elige otro modelo en Ajustes.`, { status });
  }
  if (status === 403 || err?.status === 'PERMISSION_DENIED') {
    return new AIError(
      'permission',
      'Google ha denegado el acceso (403). Comprueba que la clave está restringida a «Gemini API» y que tu proyecto no requiere verificación en AI Studio.',
      { status },
    );
  }
  if (status === 400) {
    return new AIError('image_rejected', `La petición fue rechazada: ${raw || 'formato no válido'}.`, { status });
  }
  if (status >= 500) {
    return new AIError('server', 'El servicio de Gemini no está disponible en este momento. Reinténtalo en unos minutos.', { status, retryable: true });
  }
  return new AIError('server', `Error inesperado de Gemini (${status}).`, { status });
}

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini' as const;
  readonly remote = true;
  readonly usesQuota = true;

  constructor(
    private readonly apiKey: string,
    readonly modelId: string,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  isConfigured(): boolean {
    return this.apiKey.trim().length > 10;
  }

  private async request(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new AIError('network', 'Sin conexión a Internet. Puedes añadir los alimentos manualmente.');
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const onAbort = () => ctrl.abort();
    signal?.addEventListener('abort', onAbort);
    try {
      return await this.fetchImpl(url, { ...init, signal: ctrl.signal, headers: { ...(init.headers ?? {}), 'x-goog-api-key': this.apiKey.trim() } });
    } catch (e) {
      if (signal?.aborted) throw new AIError('aborted', 'Análisis cancelado.');
      if ((e as Error)?.name === 'AbortError') throw new AIError('timeout', 'Gemini ha tardado demasiado en responder. Reinténtalo.', { retryable: true });
      throw new AIError('network', 'No se pudo conectar con Gemini. Comprueba tu conexión.', { retryable: true });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async validate(signal?: AbortSignal): Promise<ProviderStatus> {
    if (!this.isConfigured()) return { ok: false, message: 'Introduce tu clave de API.' };
    // models.get no genera contenido: comprueba clave y modelo sin gastar cuota de análisis.
    const res = await this.request(`${GEMINI_BASE}/models/${encodeURIComponent(this.modelId)}`, { method: 'GET' }, signal);
    if (res.ok) return { ok: true, message: `Conexión correcta con ${getGeminiModel(this.modelId).label}.` };
    const body = await res.json().catch(() => null);
    throw mapGeminiError(res.status, body, this.modelId);
  }

  async analyze(image: Blob, opts: AnalyzeOptions = {}): Promise<VisionAnalysis> {
    if (!this.isConfigured()) throw new AIError('not_configured', 'Configura tu clave gratuita de Gemini en Ajustes › Inteligencia artificial.');
    const t0 = performance.now();
    opts.onStage?.('Preparando la foto…');
    const data = await blobToBase64(image);
    const model = getGeminiModel(this.modelId);
    const body = {
      systemInstruction: { parts: [{ text: VISION_SYSTEM_PROMPT }] },
      contents: [
        {
          role: 'user',
          parts: [{ inline_data: { mime_type: image.type || 'image/jpeg', data } }, { text: buildUserPrompt() }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: VISION_JSON_SCHEMA,
        thinkingConfig: { thinkingLevel: model.id === this.modelId ? model.thinkingLevel : 'low' },
      },
    };
    opts.onStage?.('Gemini está analizando la foto…');
    const res = await this.request(
      `${GEMINI_BASE}/models/${encodeURIComponent(this.modelId)}:generateContent`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      opts.signal,
    );
    const json = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) throw mapGeminiError(res.status, json, this.modelId);

    const candidate = (json as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } })
      ?.candidates?.[0];
    const blocked = (json as { promptFeedback?: { blockReason?: string } })?.promptFeedback?.blockReason;
    if (blocked) throw new AIError('image_rejected', 'Gemini no ha podido analizar esta imagen. Prueba con otra foto o añade los alimentos manualmente.');
    const text = (candidate?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text)
      .join('');
    if (!text) {
      throw new AIError('invalid_response', `Gemini no devolvió ningún resultado${candidate?.finishReason ? ` (${candidate.finishReason})` : ''}.`, { retryable: true });
    }
    try {
      const { data: parsed, warnings } = parseVisionResponse(text);
      return { ...parsed, warnings, providerId: this.id, modelId: this.modelId, elapsedMs: Math.round(performance.now() - t0) };
    } catch (e) {
      if (e instanceof InvalidVisionResponseError) throw new AIError('invalid_response', `${e.message} No se ha guardado nada.`, { retryable: true });
      throw e;
    }
  }
}
