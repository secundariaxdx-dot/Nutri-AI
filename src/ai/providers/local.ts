/**
 * Proveedor local: el reconocedor MobileCLIP existente, sin conexión ni cuota.
 * Es un CLASIFICADOR zero-shot (compara la foto con ~200 etiquetas), no un
 * modelo multimodal: no cuenta piezas ni ve la preparación. Por eso todos sus
 * resultados se marcan con confianza limitada y se piden revisar.
 */
import { getRecognizer, checkAiSupport } from '@/ai';
import { detectionLabel, detectionsToItems, splitAlternatives } from '@/ai/analyze';
import type { VisionFood } from '@/ai/vision/schema';
import { AIError } from './errors';
import type { AIProvider, AnalyzeOptions, ProviderStatus, VisionAnalysis } from './types';

export class LocalVisionProvider implements AIProvider {
  readonly id = 'local' as const;
  readonly remote = false;
  readonly usesQuota = false;
  constructor(readonly modelId: string) {}

  isConfigured(): boolean {
    return checkAiSupport().supported;
  }

  async validate(): Promise<ProviderStatus> {
    const s = checkAiSupport();
    return s.supported ? { ok: true, message: 'El modelo local se puede ejecutar en este dispositivo.' } : { ok: false, message: s.reason ?? 'No compatible' };
  }

  async analyze(image: Blob, opts: AnalyzeOptions = {}): Promise<VisionAnalysis> {
    const support = checkAiSupport();
    if (!support.supported) throw new AIError('unsupported', support.reason ?? 'Este dispositivo no puede ejecutar el modelo local.');
    const rec = getRecognizer(this.modelId);
    opts.onStage?.('Cargando el modelo local…');
    await rec.load((p) => p.stage === 'download' && opts.onStage?.(`Descargando modelo local… ${Math.round(p.progress * 100)} %`));
    const r = await rec.recognize(image, opts.onStage);
    const { primary, alternatives } = splitAlternatives(r.detections);
    const foods: VisionFood[] = detectionsToItems(primary).map((it) => ({
      name: it.name,
      catalog_id: it.foodId ?? null,
      search_terms: [],
      // El clasificador no distingue la preparación con fiabilidad.
      preparation: 'desconocida',
      quantity: null,
      unit: null,
      estimated_grams: it.grams,
      confidence: Math.min(it.confidence ?? 0.5, 0.7),
      is_hypothesis: false,
      visual_evidence: it.fromDish ? `Clasificador local: desglose orientativo de «${it.fromDish}»` : 'Clasificador local',
    }));
    for (const d of alternatives) {
      foods.push({
        name: detectionLabel(d),
        catalog_id: d.kind === 'food' ? d.id : null,
        search_terms: [],
        preparation: 'desconocida',
        quantity: null,
        unit: null,
        estimated_grams: null,
        confidence: Math.min(d.confidence, 0.39),
        is_hypothesis: true,
        visual_evidence: 'Alternativa del clasificador local',
      });
    }
    return {
      contains_food: !r.noFood,
      image_quality: 'aceptable',
      meal_description: '',
      foods,
      uncertainties: ['El modelo local es un clasificador de etiquetas: no cuenta piezas ni distingue la preparación. Revisa todos los alimentos.'],
      warnings: [],
      providerId: this.id,
      modelId: this.modelId,
      elapsedMs: r.elapsedMs,
    };
  }
}
