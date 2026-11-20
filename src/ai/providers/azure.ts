/**
 * Proveedor EXPERIMENTAL: Azure OpenAI (despliegue propio con visión).
 *
 * Azure for Students da 100 USD de crédito durante 12 meses sin tarjeta
 * (azure.microsoft.com/free/students, consultado el 20/11/2026). Los modelos de
 * Azure OpenAI consumen ese crédito: NO es gratuito de forma permanente.
 * Por eso este proveedor:
 *  - está desactivado por defecto y nunca se usa como respaldo automático;
 *  - exige una confirmación explícita de que consume crédito;
 *  - no se ha podido probar contra un recurso real (requiere uno del usuario).
 */
import { blobToBase64 } from '@/lib/image';
import { buildUserPrompt, VISION_SYSTEM_PROMPT } from '@/ai/vision/prompt';
import { InvalidVisionResponseError, parseVisionResponse, VISION_JSON_SCHEMA } from '@/ai/vision/schema';
import { AIError, QUOTA_MESSAGE, redactSecrets } from './errors';
import type { AIProvider, AnalyzeOptions, ProviderStatus, VisionAnalysis } from './types';

export const AZURE_API_VERSION = '2024-10-21';

export interface AzureConfig {
  endpoint: string;
  deployment: string;
  apiKey: string;
  acknowledgedCredit: boolean;
}

export class AzureOpenAIProvider implements AIProvider {
  readonly id = 'azure' as const;
  readonly remote = true;
  readonly usesQuota = true;
  readonly modelId: string;

  constructor(
    private readonly cfg: AzureConfig,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {
    this.modelId = cfg.deployment || 'azure';
  }

  isConfigured(): boolean {
    return /^https:\/\/[a-z0-9-]+\.(openai\.azure\.com|cognitiveservices\.azure\.com)\/?$/i.test(this.cfg.endpoint.trim()) && !!this.cfg.deployment.trim() && this.cfg.apiKey.trim().length > 10 && this.cfg.acknowledgedCredit;
  }

  private url() {
    return `${this.cfg.endpoint.trim().replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(this.cfg.deployment.trim())}/chat/completions?api-version=${AZURE_API_VERSION}`;
  }

  private mapError(status: number, body: unknown): AIError {
    const msg = redactSecrets((body as { error?: { message?: string } })?.error?.message ?? '');
    if (status === 401) return new AIError('invalid_key', 'La clave de Azure no es válida.', { status });
    if (status === 404) return new AIError('model_unavailable', 'No se encuentra el despliegue indicado en tu recurso de Azure.', { status });
    if (status === 429) return new AIError('quota', QUOTA_MESSAGE, { status, scope: 'unknown' });
    if (status === 403) return new AIError('permission', 'Azure ha denegado el acceso. ¿Se ha agotado tu crédito o está deshabilitada la suscripción?', { status });
    if (status >= 500) return new AIError('server', 'Azure no está disponible ahora mismo.', { status, retryable: true });
    return new AIError('image_rejected', `Azure rechazó la petición (${status}). ${msg}`, { status });
  }

  async validate(): Promise<ProviderStatus> {
    if (!this.isConfigured()) return { ok: false, message: 'Completa endpoint, despliegue y clave, y confirma que entiendes que consume crédito.' };
    // Azure no ofrece una comprobación sin coste equivalente: se valida solo el formato.
    return { ok: true, message: 'Configuración con formato correcto (no se ha hecho ninguna llamada para no consumir crédito).' };
  }

  async analyze(image: Blob, opts: AnalyzeOptions = {}): Promise<VisionAnalysis> {
    if (!this.isConfigured()) throw new AIError('not_configured', 'Azure no está configurado o no has confirmado que consume crédito.');
    const t0 = performance.now();
    const data = await blobToBase64(image);
    opts.onStage?.('Azure está analizando la foto…');
    let res: Response;
    try {
      res = await this.fetchImpl(this.url(), {
        method: 'POST',
        signal: opts.signal,
        headers: { 'Content-Type': 'application/json', 'api-key': this.cfg.apiKey.trim() },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: VISION_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: buildUserPrompt() },
                { type: 'image_url', image_url: { url: `data:${image.type || 'image/jpeg'};base64,${data}`, detail: 'high' } },
              ],
            },
          ],
          max_tokens: 1500,
          response_format: { type: 'json_schema', json_schema: { name: 'analisis_comida', schema: VISION_JSON_SCHEMA, strict: false } },
        }),
      });
    } catch {
      if (opts.signal?.aborted) throw new AIError('aborted', 'Análisis cancelado.');
      throw new AIError('network', 'No se pudo conectar con Azure.', { retryable: true });
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) throw this.mapError(res.status, json);
    const text = (json as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ?? '';
    try {
      const { data: parsed, warnings } = parseVisionResponse(text);
      return { ...parsed, warnings, providerId: this.id, modelId: this.modelId, elapsedMs: Math.round(performance.now() - t0) };
    } catch (e) {
      if (e instanceof InvalidVisionResponseError) throw new AIError('invalid_response', `${e.message} No se ha guardado nada.`);
      throw e;
    }
  }
}
