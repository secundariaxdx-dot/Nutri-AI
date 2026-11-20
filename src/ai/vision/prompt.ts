/**
 * Instrucción especializada para el análisis de fotos de comida.
 * El modelo SOLO identifica alimentos y estima cantidades; los nutrientes se
 * calculan después con la base de datos (USDA / Open Food Facts), nunca con IA.
 */
import { getAllFoods } from '@/lib/foodDatabase';
import { PREPARATION_LABEL } from '@/config/app';

export const VISION_SYSTEM_PROMPT = `Eres un asistente experto en identificar alimentos en fotografías para un diario nutricional personal.

Analiza cuidadosamente la fotografía de comida.
- Identifica EXCLUSIVAMENTE los alimentos que realmente se observan.
- No inventes ingredientes ni métodos de preparación.
- No generes varias preparaciones distintas de un mismo alimento si no hay evidencia: un alimento visto = una entrada.
- Si ves pan, identifica pan. Si ves una tostada, identifica tostada. Si ves dos huevos, identifica dos huevos (una sola entrada con quantity = 2).
- No afirmes que los huevos son poché, fritos o revueltos si no puedes distinguirlo con seguridad: usa preparation = "desconocida".
- No infieras ingredientes ocultos sin evidencia. Si algo es solo probable (aceite, mantequilla, salsa absorbida), inclúyelo con is_hypothesis = true y una confianza baja.
- Separa claramente lo identificado de las hipótesis y expresa la incertidumbre en "uncertainties".
- Distingue alimentos distintos en el mismo plato y alimentos superpuestos. En platos mezclados, desglosa por ingredientes visibles.
- Estima cantidades de forma CONSERVADORA. Una fotografía no permite medir los gramos con exactitud: son estimaciones que el usuario corregirá. Usa pesos habituales por unidad cuando cuentes piezas (p. ej. un huevo ≈ 50–60 g sin cáscara, una rebanada de pan de payés ≈ 40–70 g).
- Si la fotografía no contiene comida, pon contains_food = false y foods = [].
- Si la foto es demasiado poco clara para identificar alimentos, pon image_quality = "mala", explica el motivo en "uncertainties" y no inventes una comida.
- Responde en español y únicamente con el JSON del esquema indicado.`;

/** Catálogo compacto (id: nombre) para que el modelo use nombres conocidos cuando encajen. */
export function catalogHint(): string {
  return getAllFoods()
    .map((f) => `${f.id}: ${f.name}${f.preparation ? ` [${PREPARATION_LABEL[f.preparation].toLowerCase()}]` : ''}`)
    .join('\n');
}

export function buildUserPrompt(): string {
  return `Identifica los alimentos de esta foto siguiendo las reglas.

Catálogo de referencia de la app (usa "catalog_id" SOLO si el alimento y su preparación se ven con claridad; si dudas, deja catalog_id = null y describe el alimento con "name" y "search_terms"):
${catalogHint()}`;
}
