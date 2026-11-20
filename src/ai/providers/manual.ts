import type { AIProvider, ProviderStatus, VisionAnalysis } from './types';

/** «Proveedor» sin IA: la foto se guarda y los alimentos se añaden a mano. */
export class ManualFallbackProvider implements AIProvider {
  readonly id = 'manual' as const;
  readonly modelId = 'manual';
  readonly remote = false;
  readonly usesQuota = false;
  isConfigured() {
    return true;
  }
  async validate(): Promise<ProviderStatus> {
    return { ok: true, message: 'Modo manual: no se usa inteligencia artificial.' };
  }
  async analyze(): Promise<VisionAnalysis> {
    return {
      contains_food: true,
      image_quality: 'aceptable',
      meal_description: '',
      foods: [],
      uncertainties: [],
      warnings: [],
      providerId: 'manual',
      modelId: 'manual',
      elapsedMs: 0,
    };
  }
}
