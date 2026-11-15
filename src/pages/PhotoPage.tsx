import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Camera, Cpu, ImagePlus, Lock, PenLine, RefreshCw, ScanSearch, Sparkles } from 'lucide-react';
import { detectionLabel, detectionsToItems, isWholeDish, splitAlternatives } from '@/ai/analyze';
import type { Detection } from '@/ai';
import type { RecognitionResult } from '@/ai';
import { useDraftParams } from '@/hooks/useDraftParams';
import { useRecognizer } from '@/hooks/useRecognizer';
import { processPhoto } from '@/lib/image';
import { newDraft, setPendingDraft, takePendingDraft, type MealDraft } from '@/store/draft';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import { PageHeader } from '@/components/layout/PageHeader';
import { MealComposer } from '@/components/meal/MealComposer';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

type Step = 'pick' | 'preview' | 'analyzing' | 'result' | 'manual';

export default function PhotoPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { date, mealType } = useDraftParams();
  const { state, analyze, reset, model, cached, support, enabled } = useRecognizer();
  const [photo, setPhoto] = useState<{ photo: Blob; thumb: Blob } | null>(null);
  const [step, setStep] = useState<Step>('pick');
  const [draft, setDraft] = useState<MealDraft | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [composerKey, setComposerKey] = useState(0);
  const [alternatives, setAlternatives] = useState<Detection[]>([]);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const previewUrl = useObjectUrl(photo?.photo);
  const aiAvailable = enabled && support.supported;

  // Recupera un análisis en curso si el usuario salió (p. ej. a crear un alimento).
  useEffect(() => {
    const pending = takePendingDraft();
    if (pending && !pending.id && pending.origin === 'foto' && pending.photo) {
      setPhoto({ photo: pending.photo, thumb: pending.thumb ?? pending.photo });
      setDraft(pending);
      setStep('manual');
    } else if (pending) setPendingDraft(pending);
  }, []);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') && !/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)) {
      toast.error('El archivo seleccionado no es una imagen.');
      return;
    }
    setProcessing(true);
    try {
      const processed = await processPhoto(file);
      setPhoto(processed);
      setResult(null);
      reset();
      setStep('preview');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const baseDraft = (p: { photo: Blob; thumb: Blob }) =>
    newDraft({ ...(date ? { date } : {}), ...(mealType ? { mealType } : {}), photo: p.photo, thumb: p.thumb, origin: 'foto' });

  const runAnalysis = async () => {
    if (!photo) return;
    setStep('analyzing');
    const r = await analyze(photo.photo);
    if (!r) return; // el estado de error se muestra en pantalla
    setResult(r);
    const { primary, alternatives: alts } = splitAlternatives(r.detections);
    setAlternatives(alts);
    setDraft({ ...baseDraft(photo), items: detectionsToItems(primary) });
    setComposerKey((k) => k + 1);
    setStep('result');
  };

  const continueManually = () => {
    if (!photo) return;
    setDraft(baseDraft(photo));
    setComposerKey((k) => k + 1);
    setStep('manual');
  };

  const onSaved = (m: { date: string }) => {
    toast.success('¡Comida guardada en tu diario!');
    navigate(`/diario?fecha=${m.date}`, { replace: true });
  };

  // ───────────── Selección de foto ─────────────
  if (step === 'pick' || !photo) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Fotografiar comida" subtitle="Haz una foto o elige una de tu galería" back />
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} aria-hidden tabIndex={-1} />
        <input ref={galleryInput} type="file" accept="image/*" className="hidden" onChange={onFile} aria-hidden tabIndex={-1} />

        <div className="relative overflow-hidden rounded-4xl bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 p-6 text-white shadow-lift sm:p-8">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-500/20 blur-2xl" />
          <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-brand-300/10 blur-2xl" />
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
              <ScanSearch className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-2xl font-bold tracking-tight">Analiza tu plato con IA</h2>
            <p className="mt-2 max-w-md text-[15px] text-white/80">
              Identificamos los alimentos, proponemos cantidades orientativas y calculamos calorías y nutrientes. Podrás corregirlo todo antes de guardar.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button className="btn bg-white py-4 text-brand-950 hover:bg-brand-50" onClick={() => cameraInput.current?.click()} disabled={processing}>
                {processing ? <Spinner /> : <Camera className="h-5 w-5" />} Hacer foto
              </button>
              <button className="btn bg-white/10 py-4 text-white ring-1 ring-white/25 hover:bg-white/15" onClick={() => galleryInput.current?.click()} disabled={processing}>
                <ImagePlus className="h-5 w-5" /> Elegir de la galería
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <InfoCard icon={Lock} title="Privado">
            El análisis se ejecuta en tu dispositivo. La foto no se envía a ningún servidor.
          </InfoCard>
          <InfoCard icon={Cpu} title={aiAvailable ? model.label : 'IA no disponible'}>
            {!support.supported
              ? `${support.reason} Puedes registrar la comida manualmente.`
              : !enabled
                ? 'Has desactivado la IA en Ajustes. Podrás añadir los alimentos manualmente.'
                : cached
                  ? 'Modelo descargado: funciona también sin conexión.'
                  : `La primera vez se descargará el modelo (≈${model.downloadMb} MB). Después queda guardado.`}
          </InfoCard>
        </div>
        <p className="mt-5 text-center text-xs text-ink-400">
          Consejo: fotografía el plato desde arriba, con buena luz y los alimentos visibles.
        </p>
      </div>
    );
  }

  // ───────────── Resultado o modo manual ─────────────
  if ((step === 'result' || step === 'manual') && draft) {
    const header = (
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-4xl bg-ink-100">
          {previewUrl && <img src={previewUrl} alt="Foto de la comida" className="max-h-[50vh] w-full object-cover" />}
          {step === 'result' && result && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-ink-900/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-brand-300" />
              {result.detections.length} {result.detections.length === 1 ? 'detección' : 'detecciones'} · {(result.elapsedMs / 1000).toFixed(1)} s · en tu dispositivo
            </div>
          )}
        </div>
        {step === 'result' && alternatives.length > 0 && (
          <div className="rounded-3xl bg-white p-4 ring-1 ring-ink-100">
            <p className="text-sm font-medium text-ink-700">¿Falta algo o no es correcto? Toca para añadir o sustituir:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {alternatives.map((d) => (
                <button
                  key={d.kind + d.id}
                  className="chip bg-brand-50 px-3 py-1.5 text-sm text-brand-900 hover:bg-brand-100"
                  onClick={() => {
                    if (isWholeDish(d)) {
                      // Sustituye el plato principal por la alternativa elegida.
                      const ingredients = result!.detections.filter((x) => !isWholeDish(x) && draft.items.some((it) => it.foodId === x.id && !it.fromDish));
                      setDraft((dr) => dr && { ...dr, items: detectionsToItems([d, ...ingredients]) });
                    } else {
                      // Añade el alimento sugerido.
                      setDraft((dr) => dr && { ...dr, items: [...dr.items, ...detectionsToItems([d])] });
                    }
                    setAlternatives((a) => a.filter((x) => x !== d));
                    setComposerKey((k) => k + 1);
                  }}
                >
                  {isWholeDish(d) ? '↺ ' : '+ '}
                  {detectionLabel(d)} <span className="text-brand-700/60">{Math.round(d.confidence * 100)} %</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 'result' && result && draft.items.length === 0 && (
          <div className="flex items-start gap-3 rounded-3xl bg-ink-50 p-4 text-sm text-ink-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-ink-500" />
            <p>
              {result.noFood ? 'No parece haber comida en la foto.' : 'La IA no ha reconocido alimentos con suficiente confianza.'} Añade los alimentos manualmente con
              «Editar alimentos» o vuelve a intentarlo con otra foto.
            </p>
          </div>
        )}
        {step === 'manual' && (
          <div className="flex items-start gap-3 rounded-3xl bg-ink-50 p-4 text-sm text-ink-700">
            <PenLine className="mt-0.5 h-5 w-5 shrink-0 text-ink-500" />
            <p>Añade los alimentos de la foto y ajusta los gramos. La foto se guardará con la comida.</p>
          </div>
        )}
      </div>
    );
    return (
      <div className="animate-fade-in">
        <PageHeader title={step === 'result' ? 'Resultado del análisis' : 'Registrar comida'} back />
        <MealComposer
          key={composerKey}
          initial={draft}
          initialMode={step === 'result' && draft.items.length > 0 ? 'review' : 'edit'}
          header={header}
          openPickerOnMount={step === 'manual' && draft.items.length === 0}
          onReanalyze={aiAvailable ? () => (setPendingDraft(null), setStep('preview')) : undefined}
          onSaved={onSaved}
        />
      </div>
    );
  }

  // ───────────── Previsualización / análisis ─────────────
  const analyzing = step === 'analyzing';
  const failed = state.phase === 'error';
  const progress = state.phase === 'loading' && state.progress?.stage === 'download' ? state.progress : null;

  return (
    <div className="animate-fade-in">
      <PageHeader title={analyzing && !failed ? 'Analizando…' : 'Previsualización'} back />
      <div className="relative overflow-hidden rounded-4xl bg-ink-900">
        {previewUrl && <img src={previewUrl} alt="Foto seleccionada" className={`max-h-[58vh] w-full object-cover transition ${analyzing && !failed ? 'opacity-80' : ''}`} />}
        {analyzing && !failed && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-400/0 via-brand-300/25 to-brand-400/0" style={{ animation: 'scan 1.8s ease-in-out infinite' }} />
            <style>{'@keyframes scan{0%{transform:translateY(-100%)}100%{transform:translateY(100%)}}'}</style>
          </>
        )}
      </div>

      {analyzing && !failed && (
        <div className="card mt-5 p-5" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <Spinner className="h-5 w-5 text-brand-700" />
            <p className="font-medium">
              {state.phase === 'loading'
                ? progress
                  ? `Descargando modelo de IA… ${Math.round(progress.progress * 100)} %`
                  : state.progress?.stage === 'init'
                    ? 'Preparando el modelo…'
                    : 'Cargando modelo de IA…'
                : state.phase === 'analyzing'
                  ? state.stage
                  : 'Procesando…'}
            </p>
          </div>
          {progress && (
            <>
              <ProgressBar value={progress.progress} className="mt-4" label="Descarga del modelo" />
              <p className="mt-2 text-xs text-ink-500">
                {progress.loadedMb.toFixed(1)} de {progress.totalMb.toFixed(1)} MB · solo la primera vez
              </p>
            </>
          )}
          {state.phase === 'analyzing' && <ProgressBar value={0.66} className="mt-4" label="Análisis" />}
        </div>
      )}

      {failed && (
        <div className="mt-5 rounded-3xl bg-red-50 p-5 text-red-900 ring-1 ring-red-100" role="alert">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">No se ha podido analizar la foto</p>
              <p className="mt-1 text-sm text-red-800/90">{state.message}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button className="btn bg-white text-red-800 ring-1 ring-red-200" onClick={runAnalysis}>
              <RefreshCw className="h-4 w-4" /> Reintentar
            </button>
            <button className="btn-primary" onClick={continueManually}>
              <PenLine className="h-4 w-4" /> Añadir alimentos manualmente
            </button>
          </div>
        </div>
      )}

      {!analyzing && (
        <div className="mt-5 space-y-3">
          {aiAvailable ? (
            <button className="btn-primary w-full py-4 text-base" onClick={runAnalysis}>
              <Sparkles className="h-5 w-5" /> Analizar con IA
            </button>
          ) : (
            <div className="rounded-3xl bg-ink-50 p-4 text-sm text-ink-700">
              {!support.supported ? support.reason : 'La IA está desactivada en Ajustes.'} Puedes añadir los alimentos manualmente.{' '}
              {!enabled && (
                <Link to="/ajustes" className="font-medium text-brand-700 underline">
                  Activar IA
                </Link>
              )}
            </div>
          )}
          {aiAvailable && !cached && (
            <p className="text-center text-xs text-ink-500">Se descargará el modelo {model.label} (≈{model.downloadMb} MB) una sola vez. Te recomendamos usar Wi-Fi.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-ghost bg-white ring-1 ring-ink-200" onClick={() => setStep('pick')}>
              <Camera className="h-4 w-4" /> Cambiar foto
            </button>
            <button className="btn-ghost bg-white ring-1 ring-ink-200" onClick={continueManually}>
              <PenLine className="h-4 w-4" /> Manual
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon: Icon, title, children }: { icon: typeof Lock; title: string; children: ReactNode }) {
  return (
    <div className="card flex items-start gap-3 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-800">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-sm text-ink-500">{children}</p>
      </div>
    </div>
  );
}
