#!/usr/bin/env node
/**
 * Precalcula los embeddings de texto de todas las etiquetas visuales
 * (alimentos, platos y fondos) para cada modelo de VISION_MODELS.
 *
 * Así el navegador solo necesita descargar el codificador de IMAGEN
 * (≈23 MB con MobileCLIP S0) en lugar del modelo completo.
 *
 * Uso: npm run build:vision            (todos los modelos)
 *      npm run build:vision -- clip-b16 (solo uno)
 *
 * Requiere acceso a huggingface.co. Si se ejecuta detrás de un proxy:
 *   NODE_USE_ENV_PROXY=1 npm run build:vision
 */
import { AutoTokenizer, CLIPTextModelWithProjection, env } from '@huggingface/transformers';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VISION_MODELS, PROMPT_TEMPLATES, BACKGROUND_LABELS } from '../src/config/ai.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
env.cacheDir = join(ROOT, '.cache', 'hf');

const db = JSON.parse(readFileSync(join(ROOT, 'src/data/foods.generated.json'), 'utf8'));
const labels = [];
for (const f of db.foods) for (const text of f.vision ?? []) labels.push({ text, kind: 'food', id: f.id });
for (const d of db.dishes) for (const text of d.vision) labels.push({ text, kind: 'dish', id: d.id });
for (const text of BACKGROUND_LABELS) labels.push({ text, kind: 'bg', id: 'bg' });

const normalize = (v) => {
  let s = 0;
  for (const x of v) s += x * x;
  s = Math.sqrt(s) || 1;
  return v.map((x) => x / s);
};

/** Cuantiza a int8 con escala por vector (precisión más que suficiente para similitud coseno). */
function quantize(vectors) {
  const dims = vectors[0].length;
  const bytes = new Int8Array(vectors.length * dims);
  const scales = [];
  vectors.forEach((v, i) => {
    const max = Math.max(...v.map(Math.abs)) || 1;
    scales.push(Number((max / 127).toPrecision(6)));
    v.forEach((x, j) => (bytes[i * dims + j] = Math.round((x / max) * 127)));
  });
  return { dims, scales, data: Buffer.from(bytes.buffer).toString('base64') };
}

const only = process.argv[2];
for (const model of VISION_MODELS) {
  if (only && model.id !== only) continue;
  console.log(`→ ${model.id} (${model.repo})`);
  const tokenizer = await AutoTokenizer.from_pretrained(model.repo);
  const textModel = await CLIPTextModelWithProjection.from_pretrained(model.repo, { dtype: 'fp32' });
  const vectors = [];
  for (const l of labels) {
    const prompts = PROMPT_TEMPLATES.map((t) => t.replace('{}', l.text));
    const inputs = tokenizer(prompts, { padding: 'max_length', truncation: true });
    const { text_embeds } = await textModel(inputs);
    const d = text_embeds.dims[1];
    const avg = new Array(d).fill(0);
    for (let i = 0; i < prompts.length; i++) {
      const v = normalize(Array.from(text_embeds.data.slice(i * d, (i + 1) * d)));
      for (let j = 0; j < d; j++) avg[j] += v[j];
    }
    vectors.push(normalize(avg));
  }
  const out = {
    model: model.repo,
    templates: PROMPT_TEMPLATES,
    labels: labels.map(({ text, kind, id }) => ({ text, kind, id })),
    ...quantize(vectors),
  };
  mkdirSync(join(ROOT, 'public', 'ai'), { recursive: true });
  const file = join(ROOT, 'public', 'ai', `${model.id}.labels.json`);
  writeFileSync(file, JSON.stringify(out));
  console.log(`  ✔ ${labels.length} etiquetas → ${file}`);
}
