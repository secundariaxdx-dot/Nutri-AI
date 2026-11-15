import { BACKGROUND_LABELS, DETECTION, PROMPT_TEMPLATES, type VisionModelConfig } from '@/config/ai';
import { getAllFoods, getDishes } from '@/lib/foodDatabase';
import { cropRegions } from './detect';
import type { FoodRecognizer, LoadProgress, RecognitionResult, VisionLabel } from './types';
import type { WorkerRequest, WorkerResponse } from './vision.worker';

/** Carga un Blob de imagen respetando la orientación EXIF. */
async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // Se revoca después de decodificar: la imagen ya está en memoria.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function regionToImageData(img: HTMLImageElement, x: number, y: number, w: number, h: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('Canvas no disponible');
  g.drawImage(img, x, y, w, h, 0, 0, cw, ch);
  const data = g.getImageData(0, 0, cw, ch);
  return { data: data.data, width: cw, height: ch };
}

/** Etiquetas usadas si no existe el fichero precalculado. */
function fallbackLabels(): VisionLabel[] {
  const labels: VisionLabel[] = [];
  for (const f of getAllFoods()) for (const text of f.vision ?? []) labels.push({ text, kind: 'food', id: f.id });
  for (const d of getDishes()) for (const text of d.vision) labels.push({ text, kind: 'dish', id: d.id });
  for (const text of BACKGROUND_LABELS) labels.push({ text, kind: 'bg', id: 'bg' });
  return labels;
}

/**
 * Reconocedor zero-shot basado en modelos tipo CLIP (MobileCLIP, CLIP…).
 * Compara la imagen (y varios recortes) con descripciones de alimentos.
 */
export class ClipRecognizer implements FoodRecognizer {
  readonly modelId: string;
  private worker: Worker | null = null;
  private loadPromise: Promise<void> | null = null;
  private progressListeners = new Set<(p: LoadProgress) => void>();
  private pending = new Map<number, { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void }>();
  private nextId = 1;

  constructor(private readonly config: VisionModelConfig) {
    this.modelId = config.id;
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.onMessage(e.data);
    worker.onerror = (e) => {
      const err = new Error(e.message || 'Error en el proceso de IA');
      this.pending.forEach((p) => p.reject(err));
      this.pending.clear();
      this.loadReject?.(err);
    };
    this.worker = worker;
    return worker;
  }

  private loadResolve?: () => void;
  private loadReject?: (e: Error) => void;

  private onMessage(msg: WorkerResponse) {
    switch (msg.type) {
      case 'progress': {
        const p: LoadProgress = {
          stage: 'download',
          progress: msg.total ? msg.loaded / msg.total : 0,
          loadedMb: msg.loaded / 1e6,
          totalMb: msg.total / 1e6,
        };
        this.progressListeners.forEach((l) => l(p));
        break;
      }
      case 'init':
        this.progressListeners.forEach((l) => l({ stage: 'init' }));
        break;
      case 'ready':
        this.progressListeners.forEach((l) => l({ stage: 'ready' }));
        this.loadResolve?.();
        break;
      case 'result':
        this.pending.get(msg.requestId)?.resolve(msg);
        this.pending.delete(msg.requestId);
        break;
      case 'error':
        if (msg.requestId !== undefined) {
          this.pending.get(msg.requestId)?.reject(new Error(msg.message));
          this.pending.delete(msg.requestId);
        } else {
          this.loadReject?.(new Error(msg.message));
        }
        break;
    }
  }

  load(onProgress?: (p: LoadProgress) => void): Promise<void> {
    if (onProgress) this.progressListeners.add(onProgress);
    if (!this.loadPromise) {
      this.loadPromise = new Promise<void>((resolve, reject) => {
        this.loadResolve = resolve;
        this.loadReject = (e) => {
          this.loadPromise = null;
          this.worker?.terminate();
          this.worker = null;
          reject(e);
        };
        const req: WorkerRequest = {
          type: 'load',
          repo: this.config.repo,
          dtype: this.config.dtype,
          labelsUrl: `${import.meta.env.BASE_URL}ai/${this.config.id}.labels.json`,
          fallbackLabels: fallbackLabels(),
          templates: PROMPT_TEMPLATES,
        };
        this.ensureWorker().postMessage(req);
      });
    }
    const p = this.loadPromise;
    if (onProgress) {
      p.finally(() => this.progressListeners.delete(onProgress)).catch(() => undefined);
    }
    return p;
  }

  async recognize(image: Blob, onStage?: (stage: string) => void): Promise<RecognitionResult> {
    const t0 = performance.now();
    await this.load();
    onStage?.('Preparando la imagen…');
    const img = await loadImage(image);
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const images = [regionToImageData(img, 0, 0, W, H, 448)];
    for (const r of cropRegions(W, H)) images.push(regionToImageData(img, r.x, r.y, r.w, r.h, 320));

    onStage?.('Identificando alimentos…');
    const requestId = this.nextId++;
    const response = await new Promise<WorkerResponse>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      const req: WorkerRequest = {
        type: 'recognize',
        requestId,
        images,
        logitScale: this.config.logitScale,
        thresholds: { fullImageMin: DETECTION.fullImageMin, cropMin: DETECTION.cropMin, maxItems: DETECTION.maxItems, fullSupport: DETECTION.fullSupport, cropStrong: DETECTION.cropStrong },
      };
      this.ensureWorker().postMessage(req, images.map((i) => i.data.buffer));
    });
    if (response.type !== 'result') throw new Error('Respuesta inesperada del modelo');
    return {
      detections: response.detections,
      noFood: response.noFood,
      modelId: this.modelId,
      elapsedMs: Math.round(performance.now() - t0),
    };
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.loadPromise = null;
  }
}
