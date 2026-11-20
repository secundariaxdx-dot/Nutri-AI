/**
 * Contrato común de los proveedores de IA para analizar fotos de comida.
 * La interfaz de usuario solo conoce este contrato: cambiar de proveedor
 * (Gemini, modelo local, Azure…) no afecta al resto de la aplicación.
 */
import type { VisionResponse } from '@/ai/vision/schema';

export type ProviderId = 'gemini' | 'local' | 'azure' | 'manual';

export interface VisionAnalysis extends VisionResponse {
  providerId: ProviderId;
  modelId: string;
  elapsedMs: number;
  /** Avisos de la validación (elementos descartados…). */
  warnings: string[];
}

export interface AnalyzeOptions {
  signal?: AbortSignal;
  onStage?: (stage: string) => void;
}

export interface ProviderStatus {
  ok: boolean;
  message: string;
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly modelId: string;
  /** true si las peticiones salen del dispositivo (se envía la foto). */
  readonly remote: boolean;
  /** true si cada análisis consume cuota de un servicio externo. */
  readonly usesQuota: boolean;
  isConfigured(): boolean;
  analyze(image: Blob, opts?: AnalyzeOptions): Promise<VisionAnalysis>;
  /** Comprueba la conexión SIN consumir cuota de generación cuando es posible. */
  validate(signal?: AbortSignal): Promise<ProviderStatus>;
}
