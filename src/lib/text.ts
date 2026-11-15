/** Normaliza texto para búsquedas: minúsculas, sin tildes ni signos. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Puntuación de coincidencia simple y rápida (0 = no coincide).
 * Favorece coincidencias al principio del nombre y de palabras completas.
 */
export function matchScore(query: string, haystack: string): number {
  const q = normalizeText(query);
  const h = normalizeText(haystack);
  if (!q) return 0;
  if (h === q) return 100;
  if (h.startsWith(q)) return 80;
  const words = h.split(' ');
  if (words.some((w) => w === q)) return 70;
  if (words.some((w) => w.startsWith(q))) return 60;
  if (h.includes(q)) return 45;
  const terms = q.split(' ').filter(Boolean);
  if (terms.length > 1 && terms.every((t) => h.includes(t))) return 40;
  // Tolerancia a plurales/singulares simples ("tomates" → "tomate")
  const singular = terms.map((t) => t.replace(/(es|s)$/, ''));
  if (singular.every((t) => t.length > 2 && h.includes(t))) return 30;
  return 0;
}
