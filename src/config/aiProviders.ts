/**
 * Proveedores y modelos de IA para analizar fotos.
 *
 * Datos verificados en la documentación oficial de Gemini API el 20/11/2026:
 *  - aistudio.google.com/docs/pricing: estos modelos tienen «Free Tier: Free of
 *    charge» para entrada y salida, con «Used to improve our products: Yes».
 *  - aistudio.google.com/docs/models: todos son «Stable» y aceptan imágenes.
 *  - aistudio.google.com/docs/rate-limits: los límites del nivel gratuito NO se
 *    publican en la documentación; se consultan por proyecto en AI Studio
 *    (aistudio.google.com/rate-limit). RPD se reinicia a medianoche del Pacífico.
 *
 * Solo se listan modelos con nivel gratuito. Para añadir/cambiar un modelo basta
 * con editar esta lista; el resto de la app no depende del modelo concreto.
 */
import type { ProviderId } from '@/ai/providers/types';

export interface GeminiModelOption {
  id: string;
  label: string;
  note: string;
  /** Nivel de razonamiento enviado (thinkingLevel). Valores admitidos por modelo según la doc. */
  thinkingLevel: 'minimal' | 'low' | 'medium' | 'high';
  /** Fecha en que se comprobó en la doc oficial que tiene nivel gratuito. */
  freeTierVerified: string;
}

export const GEMINI_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen (recomendado)',
    note: 'El modelo más capaz con nivel gratuito. Mejor comprensión de platos mezclados, pero puede tardar más.',
    thinkingLevel: 'low',
    freeTierVerified: '2026-11-20',
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    note: 'Alternativa estable y más rápida si Hydrogen tarda demasiado o no tiene cuota gratuita en tu proyecto.',
    thinkingLevel: 'low',
    freeTierVerified: '2026-11-20',
  },
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    note: 'Generación anterior de Flash.',
    thinkingLevel: 'low',
    freeTierVerified: '2026-11-20',
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    note: 'Más ligero y rápido; algo menos preciso con platos complejos.',
    thinkingLevel: 'low',
    freeTierVerified: '2026-11-20',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    note: 'El más ligero de la lista.',
    thinkingLevel: 'low',
    freeTierVerified: '2026-11-20',
  },
];

export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0].id;

export function getGeminiModel(id?: string): GeminiModelOption {
  return GEMINI_MODELS.find((m) => m.id === id) ?? GEMINI_MODELS[0];
}

export const PROVIDERS: { id: ProviderId; label: string; description: string; experimental?: boolean }[] = [
  {
    id: 'gemini',
    label: 'Google Gemini (recomendado)',
    description: 'Modelo multimodal: entiende la foto completa. Necesita tu clave gratuita de Google AI Studio. La foto se envía a Google.',
  },
  {
    id: 'local',
    label: 'Modelo local (sin conexión)',
    description: 'MobileCLIP en tu dispositivo. Privado y sin cuota, pero es un clasificador de etiquetas: menos fiable.',
  },
  {
    id: 'azure',
    label: 'Azure OpenAI (experimental)',
    description: 'Solo si ya tienes un despliegue propio. Consume crédito de Azure: no es gratuito permanente.',
    experimental: true,
  },
  {
    id: 'manual',
    label: 'Sin IA (manual)',
    description: 'Haces la foto y añades los alimentos tú mismo.',
  },
];

/** Límites personales por defecto (uso estimado: 3–4 fotos/día, 90–120/mes). */
export const DEFAULT_PERSONAL_LIMITS = {
  daily: 10,
  monthly: 150,
  warnAtPercent: 80,
  blockAtLimit: true,
};
