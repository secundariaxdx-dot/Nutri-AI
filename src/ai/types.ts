/**
 * Contrato común para cualquier sistema de reconocimiento de alimentos.
 * La interfaz de usuario solo depende de este contrato, por lo que se puede
 * sustituir el modelo (u otro proveedor) sin reescribir la aplicación.
 */

export type LabelKind = 'food' | 'dish' | 'bg';

export interface VisionLabel {
  text: string;
  kind: LabelKind;
  /** Id del alimento (foods) o plato (dishes). 'bg' para fondos. */
  id: string;
}

export interface Detection {
  kind: 'food' | 'dish';
  id: string;
  /** Confianza 0–1 (probabilidad softmax agrupada por alimento). */
  confidence: number;
  /** Proporción de regiones de la imagen donde es el elemento dominante (0–1). */
  share: number;
  /** Etiqueta visual que más ha coincidido. */
  matchedLabel: string;
}

export interface RecognitionResult {
  detections: Detection[];
  /** true si la imagen parece no contener comida. */
  noFood: boolean;
  modelId: string;
  elapsedMs: number;
}

export type LoadProgress =
  | { stage: 'download'; progress: number; loadedMb: number; totalMb: number }
  | { stage: 'init' }
  | { stage: 'ready' };

export interface FoodRecognizer {
  readonly modelId: string;
  /** Descarga e inicializa el modelo. Seguro de llamar varias veces. */
  load(onProgress?: (p: LoadProgress) => void): Promise<void>;
  recognize(image: Blob, onStage?: (stage: string) => void): Promise<RecognitionResult>;
  dispose(): void;
}
