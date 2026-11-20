/**
 * Registro de proveedores y orquestación de un análisis:
 *  1. Comprueba límites personales (sin gastar cuota si ya se han alcanzado).
 *  2. Llama SOLO al proveedor elegido por el usuario. Nunca hay cambio
 *     automático a otro proveedor ni a un modelo de pago.
 *  3. Registra el uso y los errores (sin secretos).
 */
import type { AppSettings } from '@/db/settings';
import { checkLimits, getUsageSummary, NOT_SENT_CODES, personalLimitError, recordUsage, type LimitCheck } from '@/ai/usage';
import { AzureOpenAIProvider } from './azure';
import { AIError, isAIError } from './errors';
import { GeminiProvider } from './gemini';
import { LocalVisionProvider } from './local';
import { ManualFallbackProvider } from './manual';
import type { AIProvider, AnalyzeOptions, VisionAnalysis } from './types';

export * from './types';
export { AIError, QUOTA_MESSAGE, describeError, isAIError, redactSecrets } from './errors';

export function createProvider(s: AppSettings): AIProvider {
  if (!s.aiEnabled) return new ManualFallbackProvider();
  switch (s.aiProvider) {
    case 'gemini':
      return new GeminiProvider(s.geminiApiKey, s.geminiModel);
    case 'azure':
      return new AzureOpenAIProvider({ endpoint: s.azureEndpoint, deployment: s.azureDeployment, apiKey: s.azureApiKey, acknowledgedCredit: s.azureAcknowledgedCredit });
    case 'manual':
      return new ManualFallbackProvider();
    case 'local':
    default:
      return new LocalVisionProvider(s.visionModel);
  }
}

export interface AnalysisOutcome {
  analysis: VisionAnalysis;
  /** Estado de los límites tras el análisis (para avisar al 80 % / 100 %). */
  limit: LimitCheck;
}

export async function runAnalysis(s: AppSettings, image: Blob, opts: AnalyzeOptions = {}, provider: AIProvider = createProvider(s)): Promise<AnalysisOutcome> {
  if (provider.id === 'gemini' && !s.geminiTermsAccepted) {
    throw new AIError('not_configured', 'Antes de usar Gemini, revisa y acepta sus condiciones en Ajustes › Inteligencia artificial.');
  }
  if (provider.usesQuota) {
    const before = checkLimits(await getUsageSummary(provider.id), s);
    if (!before.allowed) {
      const err = personalLimitError(before);
      await recordUsage({ provider: provider.id, model: provider.modelId, outcome: 'error', sent: false, errorCode: err.code, message: err.message });
      throw err;
    }
  }
  try {
    const analysis = await provider.analyze(image, opts);
    if (provider.usesQuota) await recordUsage({ provider: provider.id, model: provider.modelId, outcome: 'ok', sent: true });
    const limit = provider.usesQuota ? checkLimits(await getUsageSummary(provider.id), s) : { level: 'ok' as const, allowed: true };
    return { analysis, limit };
  } catch (e) {
    if (provider.usesQuota || isAIError(e)) {
      const code = isAIError(e) ? e.code : 'server';
      await recordUsage({
        provider: provider.id,
        model: provider.modelId,
        outcome: 'error',
        sent: provider.usesQuota && !NOT_SENT_CODES.has(code),
        errorCode: code,
        message: e instanceof Error ? e.message : String(e),
      });
    }
    throw e;
  }
}
