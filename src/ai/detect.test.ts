import { describe, expect, it } from 'vitest';
import { combineDetections, cropRegions, decodeLabelFile, scoreImage, type LabelSet } from './detect';
import { detectionsToItems, portionFactor, splitAlternatives } from './analyze';
import { readFileSync } from 'node:fs';

const opts = { fullImageMin: 0.12, cropMin: 0.3, maxItems: 6, fullSupport: 0.02, cropStrong: 0.75 };
const S = (key: string, p: number) => {
  const [kind, id] = key.split(':') as ['food' | 'dish' | 'bg', string];
  return { key, kind, id, p, bestLabel: id };
};

describe('scoreImage', () => {
  it('agrupa etiquetas del mismo alimento y suma 1', () => {
    const set: LabelSet = {
      labels: [
        { text: 'a', kind: 'food', id: 'x' },
        { text: 'b', kind: 'food', id: 'x' },
        { text: 'c', kind: 'bg', id: 'bg' },
      ],
      dims: 2,
      vectors: new Float32Array([1, 0, 0.9, 0.1, 0, 1]),
    };
    const s = scoreImage(new Float32Array([1, 0]), set, 100);
    expect(s[0].key).toBe('food:x');
    expect(s.reduce((a, b) => a + b.p, 0)).toBeCloseTo(1);
  });
});

describe('combineDetections', () => {
  it('detecta varios alimentos a partir de recortes con consenso', () => {
    const full = [S('food:pollo', 0.5), S('food:arroz', 0.2), S('food:brocoli', 0.05)];
    const crops = [[S('food:pollo', 0.8)], [S('food:arroz', 0.6)], [S('food:arroz', 0.5)], [S('food:brocoli', 0.5)], [S('food:pollo', 0.7)]];
    const { detections } = combineDetections(full, crops, opts);
    expect(detections.map((d) => d.id).sort()).toEqual(['arroz', 'brocoli', 'pollo']);
    const arroz = detections.find((d) => d.id === 'arroz')!;
    expect(arroz.share).toBeCloseTo(0.4);
  });
  it('descarta un recorte aislado sin respaldo', () => {
    const { detections } = combineDetections([S('food:pizza', 0.9), S('food:soja', 0.001)], [[S('food:soja', 0.5)]], opts);
    expect(detections.map((d) => d.id)).toEqual(['pizza']);
  });
  it('identifica imágenes sin comida', () => {
    const r = combineDetections([S('bg:bg', 0.9), S('food:x', 0.01)], [[S('bg:bg', 0.9)]], opts);
    expect(r.noFood).toBe(true);
    expect(r.detections).toHaveLength(0);
  });
  it('ofrece una sugerencia dudosa si nada supera el umbral', () => {
    const r = combineDetections([S('food:x', 0.08), S('bg:bg', 0.07)], [], opts);
    expect(r.detections[0].id).toBe('x');
  });
});

describe('analyze', () => {
  it('convierte detecciones en elementos estimados con fuente y desglosa platos', () => {
    const items = detectionsToItems([
      { kind: 'dish', id: 'paella', confidence: 0.8, share: 0.6, matchedLabel: 'paella' },
      { kind: 'food', id: 'limon', confidence: 0.5, share: 0.2, matchedLabel: 'lemon' },
    ]);
    expect(items.some((i) => i.foodId === 'arroz-blanco-cocido' && i.fromDish === 'Paella mixta')).toBe(true);
    expect(items.every((i) => i.estimated)).toBe(true);
    expect(items.every((i) => i.grams > 0)).toBe(true);
  });
  it('solo conserva un plato completo; el resto son alternativas', () => {
    const { primary, alternatives } = splitAlternatives([
      { kind: 'food', id: 'pizza-queso', confidence: 0.9, share: 0, matchedLabel: '' },
      { kind: 'dish', id: 'lasana', confidence: 0.8, share: 0, matchedLabel: '' },
      { kind: 'food', id: 'ketchup', confidence: 0.1, share: 0, matchedLabel: '' },
    ]);
    expect(primary.map((p) => p.id)).toEqual(['pizza-queso']);
    expect(alternatives.map((p) => p.id)).toEqual(['lasana', 'ketchup']);
  });
  it('portionFactor está acotado', () => {
    expect(portionFactor(0, 3)).toBe(1);
    expect(portionFactor(1, 2)).toBeLessThanOrEqual(1.3);
    expect(portionFactor(0.01, 2)).toBeGreaterThanOrEqual(0.75);
  });
  it('regiones dentro de la imagen', () => {
    for (const r of cropRegions(1000, 600)) {
      expect(r.x + r.w).toBeLessThanOrEqual(1000);
      expect(r.y + r.h).toBeLessThanOrEqual(600);
    }
  });
  it('los ficheros de embeddings precalculados son válidos', () => {
    for (const id of ['mobileclip-s0', 'clip-b16']) {
      const set = decodeLabelFile(JSON.parse(readFileSync(`public/ai/${id}.labels.json`, 'utf8')));
      expect(set.labels.length).toBeGreaterThan(150);
      let n = 0;
      for (let j = 0; j < set.dims; j++) n += set.vectors[j] ** 2;
      expect(n).toBeCloseTo(1, 3);
    }
  });
});
