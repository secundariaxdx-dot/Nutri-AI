import { useCallback, useEffect, useRef, useState } from 'react';
import { checkAiSupport, getRecognizer, isModelCached, type LoadProgress, type RecognitionResult } from '@/ai';
import { getVisionModel } from '@/config/ai';
import { useSettings } from './useData';

export type AnalysisPhase =
  | { phase: 'idle' }
  | { phase: 'loading'; progress?: LoadProgress }
  | { phase: 'analyzing'; stage: string }
  | { phase: 'done'; result: RecognitionResult }
  | { phase: 'error'; message: string };

/** Gestiona la carga del modelo y el análisis de una imagen. */
export function useRecognizer() {
  const settings = useSettings();
  const model = getVisionModel(settings.visionModel);
  const support = checkAiSupport();
  const [state, setState] = useState<AnalysisPhase>({ phase: 'idle' });
  const [cached, setCached] = useState<boolean | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    isModelCached(model.repo).then((c) => alive.current && setCached(c));
    return () => {
      alive.current = false;
    };
  }, [model.repo]);

  const analyze = useCallback(
    async (image: Blob): Promise<RecognitionResult | null> => {
      if (!support.supported) {
        setState({ phase: 'error', message: support.reason ?? 'Dispositivo no compatible' });
        return null;
      }
      const rec = getRecognizer(model.id);
      try {
        setState({ phase: 'loading' });
        await rec.load((p) => alive.current && setState({ phase: 'loading', progress: p }));
        setCached(true);
        setState({ phase: 'analyzing', stage: 'Analizando…' });
        const result = await rec.recognize(image, (stage) => alive.current && setState({ phase: 'analyzing', stage }));
        if (alive.current) setState({ phase: 'done', result });
        return result;
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        let message = 'No se pudo analizar la foto con la IA.';
        if (/fetch|network|Failed to fetch|load/i.test(raw) && !navigator.onLine) message = 'Sin conexión: el modelo de IA aún no está descargado en este dispositivo.';
        else if (/fetch|network/i.test(raw)) message = 'No se pudo descargar el modelo de IA. Comprueba tu conexión e inténtalo de nuevo.';
        else if (/memory|allocation|RangeError/i.test(raw)) message = 'El dispositivo no tiene memoria suficiente para ejecutar el modelo.';
        if (alive.current) setState({ phase: 'error', message: `${message} (${raw.slice(0, 120)})` });
        return null;
      }
    },
    [model.id, support.supported, support.reason],
  );

  const reset = useCallback(() => setState({ phase: 'idle' }), []);

  return { state, analyze, reset, model, cached, support, enabled: settings.aiEnabled };
}
