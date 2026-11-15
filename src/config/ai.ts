/**
 * Configuración del reconocimiento de imágenes.
 *
 * La arquitectura permite cambiar de modelo sin tocar el resto de la app:
 *  - Cada modelo se describe aquí (id de Hugging Face, precisión, tamaño).
 *  - Los "embeddings" de texto de las etiquetas de alimentos se precalculan con
 *    `npm run build:vision` y se guardan en public/ai/<slug>.labels.json, de modo
 *    que el navegador solo descarga el codificador de imagen.
 *  - Si falta ese fichero, el reconocedor calcula los embeddings en el propio
 *    navegador descargando también el codificador de texto.
 *
 * Para añadir un modelo nuevo compatible con CLIP en Transformers.js basta con
 * añadir una entrada a VISION_MODELS y regenerar sus embeddings.
 */
export interface VisionModelConfig {
  id: string;
  /** Repositorio en Hugging Face Hub (formato ONNX para Transformers.js). */
  repo: string;
  label: string;
  description: string;
  /** Precisión de los pesos. */
  dtype: 'fp32' | 'fp16' | 'q8';
  /** Tamaño aproximado de la descarga del codificador de imagen (MB). */
  downloadMb: number;
  /** Escala de logits del modelo (CLIP/MobileCLIP = 100). */
  logitScale: number;
}

export const VISION_MODELS: VisionModelConfig[] = [
  {
    id: 'mobileclip-s0',
    repo: 'Xenova/mobileclip_s0',
    label: 'MobileCLIP S0 (recomendado)',
    description: 'Modelo ligero de Apple optimizado para móviles. Rápido y preciso.',
    dtype: 'fp16',
    downloadMb: 23,
    logitScale: 100,
  },
  {
    id: 'clip-b16',
    repo: 'Xenova/clip-vit-base-patch16',
    label: 'CLIP ViT-B/16',
    description: 'Modelo de OpenAI más pesado. Útil como alternativa en ordenadores.',
    dtype: 'q8',
    downloadMb: 88,
    logitScale: 100,
  },
];

export const DEFAULT_VISION_MODEL = 'mobileclip-s0';

export function getVisionModel(id?: string): VisionModelConfig {
  return VISION_MODELS.find((m) => m.id === id) ?? VISION_MODELS[0];
}

/** Plantillas de texto usadas para construir los embeddings de cada etiqueta. */
export const PROMPT_TEMPLATES = ['a photo of {}, a type of food.', 'a close-up photo of {}.', '{}'];

/** Etiquetas de "fondo" para detectar que una región no contiene comida. */
export const BACKGROUND_LABELS = [
  'an empty plate',
  'a wooden table',
  'a person',
  'a kitchen',
  'a restaurant menu',
  'cutlery, fork and knife',
  'a napkin',
  'a white background',
];

/** Umbrales de detección (probabilidades softmax sobre todas las etiquetas). */
export const DETECTION = {
  /** Probabilidad mínima en la imagen completa para aceptar un alimento. */
  fullImageMin: 0.12,
  /** Probabilidad mínima en un recorte para aceptar su alimento principal. */
  cropMin: 0.3,
  /** Respaldo mínimo en la imagen completa para aceptar un alimento visto en un único recorte. */
  fullSupport: 0.02,
  /** Confianza de recorte que no necesita respaldo. */
  cropStrong: 0.75,
  /** Máximo de alimentos distintos devueltos. */
  maxItems: 6,
  /** Por debajo de esta confianza el resultado se marca como dudoso. */
  lowConfidence: 0.35,
};
