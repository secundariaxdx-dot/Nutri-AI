import { useEffect, useState } from 'react';
import { Cpu, Download, Trash2 } from 'lucide-react';
import { checkAiSupport, getRecognizer, isModelCached, type LoadProgress } from '@/ai';
import { VISION_MODELS, getVisionModel } from '@/config/ai';
import { setSettings } from '@/db/settings';
import { useSettings } from '@/hooks/useData';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useToast } from '@/components/ui/Toast';
import { Toggle } from './SyncSection';

export function AiSection() {
  const settings = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const model = getVisionModel(settings.visionModel);
  const support = checkAiSupport();
  const [cached, setCached] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    isModelCached(model.repo).then(setCached);
  }, [model.repo]);

  const preload = async () => {
    setLoading(true);
    try {
      await getRecognizer(model.id).load(setProgress);
      setCached(true);
      toast.success('Modelo descargado. Ya puedes analizar fotos sin conexión.');
    } catch (e) {
      toast.error(`No se pudo descargar el modelo: ${(e as Error).message}`);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const clear = async () => {
    if (!(await confirm({ title: '¿Borrar el modelo descargado?', message: 'Se volverá a descargar la próxima vez que analices una foto.', confirmLabel: 'Borrar', danger: true }))) return;
    getRecognizer(model.id).dispose();
    await caches.delete('transformers-cache').catch(() => undefined);
    setCached(false);
    toast.success('Modelo eliminado del dispositivo');
  };

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-800">
          <Cpu className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold">Inteligencia artificial</h2>
          <p className="text-sm text-ink-500">Reconocimiento de alimentos ejecutado en tu dispositivo con Transformers.js. Gratis y privado.</p>
        </div>
      </div>
      {!support.supported && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">{support.reason} Puedes usar el registro manual.</p>}
      <Toggle label="Análisis de fotos con IA" hint="Si lo desactivas, las fotos se registran manualmente" checked={settings.aiEnabled} onChange={(v) => setSettings({ aiEnabled: v })} />
      <div>
        <label className="label" htmlFor="model">
          Modelo
        </label>
        <select id="model" className="input" value={model.id} onChange={(e) => setSettings({ visionModel: e.target.value })}>
          {VISION_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} · ≈{m.downloadMb} MB
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-500">{model.description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-ink-50 px-4 py-3 text-sm">
        <span>{cached === null ? 'Comprobando…' : cached ? '✅ Descargado: funciona sin conexión' : 'No descargado todavía'}</span>
        {cached ? (
          <button className="flex items-center gap-1 font-medium text-red-600" onClick={clear}>
            <Trash2 className="h-4 w-4" /> Borrar
          </button>
        ) : (
          <button className="flex items-center gap-1 font-medium text-brand-700 disabled:opacity-50" onClick={preload} disabled={loading || !support.supported}>
            <Download className="h-4 w-4" /> Descargar ahora
          </button>
        )}
      </div>
      {loading && (
        <div>
          <ProgressBar value={progress?.stage === 'download' ? progress.progress : progress?.stage === 'init' ? 1 : 0.02} label="Descarga del modelo" />
          <p className="mt-1 text-xs text-ink-500">
            {progress?.stage === 'download' ? `${progress.loadedMb.toFixed(1)} / ${progress.totalMb.toFixed(1)} MB` : progress?.stage === 'init' ? 'Inicializando…' : 'Conectando…'}
          </p>
        </div>
      )}
    </section>
  );
}
