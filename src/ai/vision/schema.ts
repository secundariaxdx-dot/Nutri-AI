/**
 * Esquema de la respuesta estructurada del modelo de visión y su validación.
 *
 * - `VISION_JSON_SCHEMA` se envía al proveedor (salida estructurada).
 * - `parseVisionResponse` valida con Zod y, si hace falta, intenta una
 *   recuperación CONTROLADA (extraer el JSON del texto, convertir números
 *   escritos como texto, descartar elementos inválidos). Nunca rellena datos
 *   que el modelo no haya dado.
 */
import { z } from 'zod';

export const PREPARATIONS = ['crudo', 'cocido', 'hervido', 'plancha', 'frito', 'horneado', 'asado', 'tostado', 'natural', 'desconocida'] as const;
export type VisionPreparation = (typeof PREPARATIONS)[number];

const MAX_GRAMS = 2000;

const num = (min: number, max: number) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : v), z.number().finite().min(min).max(max));

export const visionFoodSchema = z.object({
  name: z.string().trim().min(2).max(80),
  catalog_id: z.string().trim().max(60).nullable().optional(),
  search_terms: z.array(z.string().trim().min(2).max(60)).max(5).optional().default([]),
  preparation: z.enum(PREPARATIONS).catch('desconocida').default('desconocida'),
  quantity: num(0, 50).nullable().optional(),
  unit: z.string().trim().max(30).nullable().optional(),
  // Si falta o no es válido se usará una ración orientativa marcada para confirmar.
  estimated_grams: num(1, MAX_GRAMS).nullable().optional().catch(null),
  confidence: num(0, 1),
  is_hypothesis: z.boolean().optional().default(false),
  visual_evidence: z.string().trim().max(300).optional().default(''),
});

export const visionResponseSchema = z.object({
  contains_food: z.boolean(),
  image_quality: z.enum(['buena', 'aceptable', 'mala']).catch('aceptable').default('aceptable'),
  meal_description: z.string().trim().max(200).optional().default(''),
  foods: z.array(z.unknown()).max(20),
  uncertainties: z.array(z.string().trim().max(300)).max(10).optional().default([]),
});

export type VisionFood = z.infer<typeof visionFoodSchema>;

export interface VisionResponse {
  contains_food: boolean;
  image_quality: 'buena' | 'aceptable' | 'mala';
  meal_description: string;
  foods: VisionFood[];
  uncertainties: string[];
}

export interface ParseResult {
  data: VisionResponse;
  /** Avisos de la recuperación controlada (elementos descartados, etc.). */
  warnings: string[];
}

export class InvalidVisionResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidVisionResponseError';
  }
}

/** Extrae el primer objeto JSON de un texto (p. ej. envuelto en ```json …```). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* recuperación controlada */
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      /* sigue */
    }
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      /* sin recuperación posible */
    }
  }
  throw new InvalidVisionResponseError('La respuesta del modelo no es un JSON válido.');
}

/** Valida la respuesta. Lanza InvalidVisionResponseError si no es recuperable. */
export function parseVisionResponse(raw: string | unknown): ParseResult {
  const json = typeof raw === 'string' ? extractJson(raw) : raw;
  const top = visionResponseSchema.safeParse(json);
  if (!top.success) {
    throw new InvalidVisionResponseError('La respuesta del modelo no tiene la estructura esperada.');
  }
  const warnings: string[] = [];
  const foods: VisionFood[] = [];
  // Si no hay comida, cualquier alimento listado se ignora (no se valida ni se usa).
  const candidates = top.data.contains_food ? top.data.foods : [];
  candidates.forEach((f, i) => {
    const r = visionFoodSchema.safeParse(f);
    if (r.success) foods.push(r.data);
    else {
      const name = typeof (f as { name?: unknown })?.name === 'string' ? (f as { name: string }).name : `#${i + 1}`;
      warnings.push(`Se ha descartado «${name}» porque sus datos no eran válidos.`);
    }
  });
  if (candidates.length > 0 && foods.length === 0) {
    throw new InvalidVisionResponseError('Ningún alimento de la respuesta tenía datos válidos.');
  }
  return {
    data: {
      contains_food: top.data.contains_food,
      image_quality: top.data.image_quality,
      meal_description: top.data.meal_description,
      foods: top.data.contains_food ? foods : [],
      uncertainties: top.data.uncertainties,
    },
    warnings,
  };
}

/** Esquema JSON enviado al proveedor (subconjunto compatible con Gemini y OpenAI). */
export const VISION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    contains_food: { type: 'boolean', description: 'true si la foto muestra comida o bebida reconocible.' },
    image_quality: { type: 'string', enum: ['buena', 'aceptable', 'mala'], description: 'Nitidez/iluminación para identificar alimentos.' },
    meal_description: { type: 'string', description: 'Descripción breve en español de lo que se ve, sin inventar.' },
    foods: {
      type: 'array',
      description: 'Alimentos observados. Vacío si no hay comida.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre en español, tan específico como permita la foto (p. ej. «Tostada de pan de payés»).' },
          catalog_id: { type: ['string', 'null'], description: 'Id del catálogo SOLO si alimento y preparación se ven con claridad; si no, null.' },
          search_terms: { type: 'array', items: { type: 'string' }, description: 'Hasta 3 sinónimos en español para buscarlo.' },
          preparation: { type: 'string', enum: [...PREPARATIONS], description: '«desconocida» si no se distingue con seguridad.' },
          quantity: { type: ['number', 'null'], minimum: 0, maximum: 50, description: 'Número de unidades visibles (p. ej. 2 huevos), o null.' },
          unit: { type: ['string', 'null'], description: 'Unidad: unidad, rebanada, cucharada, ración…' },
          estimated_grams: { type: 'number', minimum: 1, maximum: 2000, description: 'Estimación conservadora del peso total en gramos.' },
          confidence: { type: 'number', minimum: 0, maximum: 1, description: 'Confianza 0–1 en que este alimento está realmente en la foto.' },
          is_hypothesis: { type: 'boolean', description: 'true si no se ve directamente y solo es probable (p. ej. aceite).' },
          visual_evidence: { type: 'string', description: 'Qué se observa en la foto que lo justifica.' },
        },
        required: ['name', 'preparation', 'estimated_grams', 'confidence', 'is_hypothesis', 'visual_evidence'],
      },
    },
    uncertainties: { type: 'array', items: { type: 'string' }, description: 'Dudas relevantes (cantidades, preparación, ingredientes no visibles).' },
  },
  required: ['contains_food', 'image_quality', 'meal_description', 'foods', 'uncertainties'],
} as const;
