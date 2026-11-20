import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createProvider, runAnalysis, type AnalysisOutcome } from '@/ai/providers';
import { getUsageSummary, checkLimits, type LimitCheck } from '@/ai/usage';
import { PROVIDERS, getGeminiModel } from '@/config/aiProviders';
import { getVisionModel } from '@/config/ai';
import { isModelCached } from '@/ai';
import { useSettings } from './useData';

export type VisionPhase =
  | { phase: 'idle' }
  | { phase: 'running'; stage: string }
  | { phase: 'done'; outcome: AnalysisOutcome }
  | { phase: 'error'; error: unknown };

/** Analiza fotos con el proveedor elegido en Ajustes (sin cambios automáticos de proveedor). */
export function useVisionAnalysis() {
  const settings = useSettings();
  const provider = useMemo(() => createProvider(settings), [settings]);
  const [state, setState] = useState<VisionPhase>({ phase: 'idle' });
  const [limit, setLimit] = useState<LimitCheck>({ level: 'ok', allowed: true });
  const [localCached, setLocalCached] = useState<boolean | null>(null);
  const abort = useRef<AbortController>();
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      abort.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!provider.usesQuota) return setLimit({ level: 'ok', allowed: true });
    getUsageSummary(provider.id).then((u) => alive.current && setLimit(checkLimits(u, settings)));
  }, [provider, settings, state.phase]);

  useEffect(() => {
    if (provider.id === 'local') isModelCached(getVisionModel(settings.visionModel).repo).then((c) => alive.current && setLocalCached(c));
  }, [provider.id, settings.visionModel]);

  const analyze = useCallback(
    async (image: Blob): Promise<AnalysisOutcome | null> => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setState({ phase: 'running', stage: 'Preparando…' });
      try {
        const outcome = await runAnalysis(settings, image, { signal: ctrl.signal, onStage: (stage) => alive.current && setState({ phase: 'running', stage }) }, provider);
        if (alive.current) setState({ phase: 'done', outcome });
        return outcome;
      } catch (error) {
        if (alive.current) setState({ phase: 'error', error });
        return null;
      }
    },
    [settings, provider],
  );

  const cancel = useCallback(() => {
    abort.current?.abort();
    setState({ phase: 'idle' });
  }, []);

  const label =
    provider.id === 'gemini'
      ? getGeminiModel(settings.geminiModel).label.replace(' (recomendado)', '')
      : provider.id === 'local'
        ? getVisionModel(settings.visionModel).label.replace(' (recomendado)', '')
        : PROVIDERS.find((p) => p.id === provider.id)?.label ?? provider.id;

  return { state, analyze, cancel, provider, settings, limit, label, localCached, reset: () => setState({ phase: 'idle' }) };
}
