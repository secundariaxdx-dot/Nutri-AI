/// <reference lib="webworker" />
/**
 * Web Worker que ejecuta el modelo de visión con Transformers.js (ONNX Runtime
 * WebAssembly) completamente en el dispositivo. Las fotos nunca salen del
 * navegador: solo se descargan los pesos del modelo (una vez, luego quedan en
 * caché).
 */
import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
  type PreTrainedModel,
  type Processor,
} from '@huggingface/transformers';
import { combineDetections, decodeLabelFile, normalize, scoreImage, type EncodedLabelFile, type LabelSet } from './detect';
import type { VisionLabel } from './types';

env.allowLocalModels = false;
env.useBrowserCache = true;

export type WorkerRequest =
  | {
      type: 'load';
      repo: string;
      dtype: 'fp32' | 'fp16' | 'q8';
      labelsUrl: string;
      fallbackLabels: VisionLabel[];
      templates: string[];
    }
  | {
      type: 'recognize';
      requestId: number;
      images: { data: Uint8ClampedArray; width: number; height: number }[];
      logitScale: number;
      thresholds: import('./detect').DetectOptions;
    };

export type WorkerResponse =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'init' }
  | { type: 'ready' }
  | { type: 'result'; requestId: number; detections: ReturnType<typeof combineDetections>['detections']; noFood: boolean }
  | { type: 'error'; requestId?: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let processor: Processor | null = null;
let vision: PreTrainedModel | null = null;
let labelSet: LabelSet | null = null;
let loading: Promise<void> | null = null;

const post = (msg: WorkerResponse) => ctx.postMessage(msg);

/** Agrega el progreso de varias descargas simultáneas. */
function progressTracker() {
  const files = new Map<string, { loaded: number; total: number }>();
  return (p: { status: string; file?: string; loaded?: number; total?: number }) => {
    if (p.status === 'progress' && p.file && p.total) {
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
      let loaded = 0;
      let total = 0;
      files.forEach((f) => {
        loaded += f.loaded;
        total += f.total;
      });
      post({ type: 'progress', loaded, total });
    }
  };
}

async function computeLabelsInBrowser(repo: string, labels: VisionLabel[], templates: string[]): Promise<LabelSet> {
  const tokenizer = await AutoTokenizer.from_pretrained(repo);
  const textModel = await CLIPTextModelWithProjection.from_pretrained(repo, { dtype: 'fp32', progress_callback: progressTracker() });
  let dims = 0;
  const rows: Float32Array[] = [];
  for (const l of labels) {
    const prompts = templates.map((t) => t.replace('{}', l.text));
    const inputs = tokenizer(prompts, { padding: 'max_length', truncation: true });
    const { text_embeds } = await textModel(inputs);
    dims = text_embeds.dims[1];
    const avg = new Float32Array(dims);
    for (let i = 0; i < prompts.length; i++) {
      const v = normalize(text_embeds.data.slice(i * dims, (i + 1) * dims) as Float32Array);
      for (let j = 0; j < dims; j++) avg[j] += v[j];
    }
    rows.push(normalize(avg));
  }
  await textModel.dispose();
  const vectors = new Float32Array(rows.length * dims);
  rows.forEach((r, i) => vectors.set(r, i * dims));
  return { labels, dims, vectors };
}

async function load(req: Extract<WorkerRequest, { type: 'load' }>) {
  const onProgress = progressTracker();
  const [proc, model, labels] = await Promise.all([
    AutoProcessor.from_pretrained(req.repo),
    CLIPVisionModelWithProjection.from_pretrained(req.repo, {
      dtype: req.dtype,
      device: 'wasm',
      progress_callback: onProgress,
    }),
    fetch(req.labelsUrl)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<EncodedLabelFile>;
      })
      .then(decodeLabelFile)
      .catch(() => null),
  ]);
  post({ type: 'init' });
  processor = proc;
  vision = model;
  labelSet = labels ?? (await computeLabelsInBrowser(req.repo, req.fallbackLabels, req.templates));
  // Inferencia de calentamiento para que el primer análisis real sea rápido.
  const blank = new RawImage(new Uint8ClampedArray(64 * 64 * 3).fill(200), 64, 64, 3);
  await vision(await processor(blank));
  post({ type: 'ready' });
}

async function recognize(req: Extract<WorkerRequest, { type: 'recognize' }>) {
  if (!processor || !vision || !labelSet) throw new Error('El modelo no está cargado');
  const images = req.images.map((im) => new RawImage(im.data, im.width, im.height, 4).rgb());
  const inputs = await processor(images);
  const { image_embeds } = await vision(inputs);
  const dims = image_embeds.dims[1];
  const data = image_embeds.data as Float32Array;
  const scores = images.map((_, i) => scoreImage(data.slice(i * dims, (i + 1) * dims), labelSet!, req.logitScale));
  const [full, ...crops] = scores;
  const { detections, noFood } = combineDetections(full, crops, req.thresholds);
  post({ type: 'result', requestId: req.requestId, detections, noFood });
}

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    if (req.type === 'load') {
      loading ??= load(req).catch((err) => {
        loading = null;
        throw err;
      });
      await loading;
    } else if (req.type === 'recognize') {
      await recognize(req);
    }
  } catch (err) {
    post({
      type: 'error',
      requestId: req.type === 'recognize' ? req.requestId : undefined,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
