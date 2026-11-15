import { DEFAULT_VISION_MODEL, getVisionModel } from '@/config/ai';
import { ClipRecognizer } from './clipRecognizer';
import type { FoodRecognizer } from './types';

export * from './types';

let current: FoodRecognizer | null = null;

/**
 * Devuelve el reconocedor activo. Para usar otro sistema (p. ej. un modelo de
 * detección de objetos o un servidor propio) basta con implementar
 * FoodRecognizer y devolverlo aquí.
 */
export function getRecognizer(modelId: string = DEFAULT_VISION_MODEL): FoodRecognizer {
  if (current && current.modelId === modelId) return current;
  current?.dispose();
  current = new ClipRecognizer(getVisionModel(modelId));
  return current;
}

export interface AiSupport {
  supported: boolean;
  reason?: string;
}

/** Comprueba si el navegador puede ejecutar el modelo localmente. */
export function checkAiSupport(): AiSupport {
  if (typeof WebAssembly !== 'object') return { supported: false, reason: 'Tu navegador no soporta WebAssembly.' };
  if (typeof Worker === 'undefined') return { supported: false, reason: 'Tu navegador no soporta Web Workers.' };
  if (typeof OffscreenCanvas === 'undefined' && typeof document === 'undefined') {
    return { supported: false, reason: 'No es posible procesar imágenes en este entorno.' };
  }
  return { supported: true };
}

/** Indica si el modelo ya está en la caché del navegador (descargado antes). */
export async function isModelCached(repo: string): Promise<boolean> {
  try {
    if (!('caches' in self)) return false;
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    return keys.some((k) => k.url.includes(repo) && k.url.endsWith('.onnx'));
  } catch {
    return false;
  }
}
