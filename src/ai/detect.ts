/**
 * Lógica pura (sin dependencias del navegador) para convertir embeddings de
 * imagen en detecciones de alimentos. Se prueba con Vitest.
 */
import type { Detection, VisionLabel } from './types';

export interface LabelSet {
  labels: VisionLabel[];
  dims: number;
  /** Vectores normalizados, concatenados (labels.length × dims). */
  vectors: Float32Array;
}

export interface EncodedLabelFile {
  labels: VisionLabel[];
  dims: number;
  scales: number[];
  /** Int8 en base64. */
  data: string;
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // Entorno Node (tests)
  return new Uint8Array((globalThis as unknown as { Buffer: { from(s: string, e: string): Uint8Array } }).Buffer.from(b64, 'base64'));
}

export function normalize(v: Float32Array): Float32Array {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  s = Math.sqrt(s) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / s;
  return out;
}

/** Decodifica el fichero de etiquetas cuantizado a int8. */
export function decodeLabelFile(file: EncodedLabelFile): LabelSet {
  const bytes = base64ToBytes(file.data);
  const int8 = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = file.labels.length;
  if (int8.length !== n * file.dims) throw new Error('Fichero de etiquetas corrupto');
  const vectors = new Float32Array(n * file.dims);
  for (let i = 0; i < n; i++) {
    const row = new Float32Array(file.dims);
    for (let j = 0; j < file.dims; j++) row[j] = int8[i * file.dims + j] * file.scales[i];
    vectors.set(normalize(row), i * file.dims);
  }
  return { labels: file.labels, dims: file.dims, vectors };
}

export interface TargetScore {
  key: string; // `${kind}:${id}`
  kind: VisionLabel['kind'];
  id: string;
  p: number;
  bestLabel: string;
}

/**
 * Calcula probabilidades softmax sobre todas las etiquetas y las agrupa por
 * alimento/plato (varias etiquetas pueden apuntar al mismo alimento).
 */
export function scoreImage(embedding: Float32Array, set: LabelSet, logitScale = 100): TargetScore[] {
  const img = normalize(embedding);
  const n = set.labels.length;
  const logits = new Float32Array(n);
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    let dot = 0;
    const off = i * set.dims;
    for (let j = 0; j < set.dims; j++) dot += img[j] * set.vectors[off + j];
    logits[i] = dot * logitScale;
    if (logits[i] > max) max = logits[i];
  }
  let sum = 0;
  for (let i = 0; i < n; i++) {
    logits[i] = Math.exp(logits[i] - max);
    sum += logits[i];
  }
  const grouped = new Map<string, TargetScore & { bestP: number }>();
  for (let i = 0; i < n; i++) {
    const p = logits[i] / sum;
    const l = set.labels[i];
    const key = `${l.kind}:${l.id}`;
    const g = grouped.get(key);
    if (!g) grouped.set(key, { key, kind: l.kind, id: l.id, p, bestLabel: l.text, bestP: p });
    else {
      g.p += p;
      if (p > g.bestP) {
        g.bestP = p;
        g.bestLabel = l.text;
      }
    }
  }
  return [...grouped.values()]
    .map(({ bestP: _b, ...rest }) => rest)
    .sort((a, b) => b.p - a.p);
}

export interface DetectOptions {
  fullImageMin: number;
  cropMin: number;
  maxItems: number;
  /** Probabilidad mínima en la imagen completa que respalda una detección de recorte. */
  fullSupport: number;
  /** Probabilidad de recorte a partir de la cual no hace falta respaldo. */
  cropStrong: number;
}

/**
 * Combina la puntuación de la imagen completa con la de varios recortes para
 * detectar varios alimentos en el mismo plato.
 */
export function combineDetections(
  full: TargetScore[],
  crops: TargetScore[][],
  opts: DetectOptions,
): { detections: Detection[]; noFood: boolean } {
  const acc = new Map<string, Detection>();
  const add = (s: TargetScore, isCropTop: boolean) => {
    if (s.kind === 'bg') return;
    const prev = acc.get(s.key);
    const share = isCropTop ? 1 / Math.max(crops.length, 1) : 0;
    if (!prev) {
      acc.set(s.key, { kind: s.kind, id: s.id, confidence: s.p, share, matchedLabel: s.bestLabel });
    } else {
      if (s.p > prev.confidence) {
        prev.confidence = s.p;
        prev.matchedLabel = s.bestLabel;
      }
      prev.share += share;
    }
  };

  full
    .filter((s) => s.kind !== 'bg' && s.p >= opts.fullImageMin)
    .slice(0, 3)
    .forEach((s) => add(s, false));

  // Consenso: un alimento visto solo en un recorte necesita apoyo adicional
  // (aparecer en ≥2 regiones, algo de probabilidad en la imagen completa o
  // una confianza muy alta). Reduce falsos positivos en bordes y fondos.
  const fullP = new Map(full.map((s) => [s.key, s.p]));
  const cropTops = crops.map((c) => c[0]).filter((t): t is TargetScore => !!t && t.kind !== 'bg' && t.p >= opts.cropMin);
  const votes = new Map<string, number>();
  for (const t of cropTops) votes.set(t.key, (votes.get(t.key) ?? 0) + 1);
  for (const t of cropTops) {
    const supported = (votes.get(t.key) ?? 0) >= 2 || (fullP.get(t.key) ?? 0) >= opts.fullSupport || t.p >= opts.cropStrong;
    if (supported) add(t, true);
  }

  let detections = [...acc.values()];
  const topFull = full[0];
  const noFood = detections.length === 0 && !!topFull && topFull.kind === 'bg' && topFull.p >= 0.5;

  // Si nada supera los umbrales pero hay un alimento plausible, se ofrece como sugerencia dudosa.
  if (detections.length === 0 && !noFood) {
    const best = full.find((s) => s.kind !== 'bg');
    if (best && best.p >= 0.04) {
      detections = [{ kind: best.kind as 'food' | 'dish', id: best.id, confidence: best.p, share: 0, matchedLabel: best.bestLabel }];
    }
  }

  detections.sort((a, b) => b.confidence - a.confidence);
  return { detections: detections.slice(0, opts.maxItems), noFood };
}

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Regiones a analizar: 4 cuadrantes solapados (60 %) + centro. */
export function cropRegions(width: number, height: number): CropRect[] {
  const w = Math.round(width * 0.6);
  const h = Math.round(height * 0.6);
  const xs = [0, width - w];
  const ys = [0, height - h];
  const rects: CropRect[] = [];
  for (const y of ys) for (const x of xs) rects.push({ x, y, w, h });
  rects.push({ x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), w, h });
  return rects;
}
