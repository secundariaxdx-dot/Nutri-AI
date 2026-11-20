import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, AlertTriangle, Camera, Cloud, Cpu, Gauge, HelpCircle, ImagePlus, Lock, PenLine, Plus, RefreshCw, ScanSearch, Search, Settings, Sparkles } from 'lucide-react';
import { itemFromFood } from '@/ai/analyze';
import { describeError, isAIError } from '@/ai/providers';
import { buildAnalysisDraft, type AnalysisDraft } from '@/ai/vision/match';
import type { VisionAnalysis } from '@/ai/providers/types';
import { db } from '@/db/database';
import { useDraftParams } from '@/hooks/useDraftParams';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import { useVisionAnalysis } from '@/hooks/useVisionAnalysis';
import { processPhoto } from '@/lib/image';
import { newDraft, setPendingDraft, takePendingDraft, type MealDraft } from '@/store/draft';
import type { Food, MealItem } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { FoodPicker } from '@/components/meal/FoodPicker';
import { MealComposer } from '@/components/meal/MealComposer';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

type Step = 'pick' | 'preview' | 'analyzing' | 'result' | 'manual';

export default function PhotoPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { date, mealType } = useDraftParams();
  const { state, analyze, provider, settings, limit, label, localCached, reset } = useVisionAnalysis();
  const [photo, setPhoto] = useState<{ photo: Blob; thumb: Blob } | null>(null);
  const [step, setStep] = useState<Step>('pick');
  const [draft, setDraft] = useState<MealDraft | null>(null);
  const [analysis, setAnalysis] = useState<VisionAnalysis | null>(null);
  const [extras, setExtras] = useState<Pick<AnalysisDraft, 'suggestions' | 'unmatched'>>({ suggestions: [], unmatched: [] });
  const [append, setAppend] = useState<{ id: number; items: MealItem[] }>();
  const [searchFor, setSearchFor] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [composerKey, setComposerKey] = useState(0);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const previewUrl = useObjectUrl(photo?.photo);
  const manualMode = provider.id === 'manual';
  const ready = provider.isConfigured() && !(provider.id === 'gemini' && !settings.geminiTermsAccepted);

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
      setAnalysis(null);
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
    const outcome = await analyze(photo.photo);
    if (!outcome) return; // el error se muestra en pantalla con alternativas
    const custom = (await db.customFoods.toArray()).filter((f) => !f.deleted);
    const built = buildAnalysisDraft(outcome.analysis.foods, custom);
    setAnalysis(outcome.analysis);
    setExtras({ suggestions: built.suggestions, unmatched: built.unmatched });
    setDraft({ ...baseDraft(photo), items: built.items, name: outcome.analysis.meal_description.slice(0, 80) });
    setComposerKey((k) => k + 1);
    setStep('result');
    if (outcome.limit.level === 'warn') toast.info(`Aviso de uso: ${outcome.limit.message}`);
    if (outcome.limit.level === 'limit') toast.info(outcome.limit.message ?? 'Has llegado a tu límite de análisis.');
  };

  const continueManually = () => {
    if (!photo) return;
    setDraft(baseDraft(photo));
    setAnalysis(null);
    setExtras({ suggestions: [], unmatched: [] });
    setComposerKey((k) => k + 1);
    setStep('manual');
  };

  const addItems = (items: MealItem[]) => setAppend((a) => ({ id: (a?.id ?? 0) + 1, items }));

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
            <h2 className="mt-5 text-2xl font-bold tracking-tight">{manualMode ? 'Registra tu plato' : 'Analiza tu plato con IA'}</h2>
            <p className="mt-2 max-w-md text-[15px] text-white/80">
              {manualMode
                ? 'La foto se guardará con la comida y añadirás los alimentos tú mismo.'
                : 'La IA identifica los alimentos y propone cantidades orientativas. Los nutrientes se calculan con bases de datos oficiales. Revisarás todo antes de guardar.'}
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
          <ProviderCard provider={provider.id} label={label} ready={ready} localCached={localCached} />
          {provider.id === 'gemini' ? (
            <InfoCard icon={Cloud} title="Privacidad">
              La foto se envía a Google para analizarla. En el nivel gratuito Google puede usarla para mejorar sus productos: no fotografíes personas ni datos personales.
            </InfoCard>
          ) : provider.id === 'azure' ? (
            <InfoCard icon={Cloud} title="Consume crédito de Azure">
              Cada análisis gasta crédito de tu suscripción de Azure. No es gratuito de forma permanente.
            </InfoCard>
          ) : (
            <InfoCard icon={Lock} title="Privado">
              La foto no sale de tu dispositivo.
            </InfoCard>
          )}
        </div>
        {provider.usesQuota && limit.level !== 'ok' && <LimitBanner text={limit.message} blocked={!limit.allowed} />}
        <p className="mt-5 text-center text-xs text-ink-400">Consejo: fotografía el plato desde arriba, con buena luz y los alimentos visibles.</p>
      </div>
    );
  }

  // ───────────── Resultado o modo manual ─────────────
  if ((step === 'result' || step === 'manual') && draft) {
    const header = (
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-4xl bg-ink-100">
          {previewUrl && <img src={previewUrl} alt="Foto de la comida" className="max-h-[50vh] w-full object-cover" />}
          {step === 'result' && analysis && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-ink-900/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-brand-300" />
              {label} · {(analysis.elapsedMs / 1000).toFixed(1)} s
            </div>
          )}
        </div>

        {step === 'result' && analysis && <AnalysisNotes analysis={analysis} empty={draft.items.length === 0} hasExtras={extras.suggestions.length + extras.unmatched.length > 0} />}

        {step === 'result' && extras.suggestions.length > 0 && (
          <div className="rounded-3xl bg-white p-4 ring-1 ring-ink-100">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink-700">
              <HelpCircle className="h-4 w-4 text-ink-400" /> Posibles, pero no confirmados en la foto:
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {extras.suggestions.map((s, i) => (
                <button
                  key={`${s.food.id}-${i}`}
                  className="chip bg-brand-50 px-3 py-1.5 text-sm text-brand-900 hover:bg-brand-100"
                  title={s.vision.visual_evidence}
                  onClick={() => {
                    addItems([itemFromFood(s.food, s.grams, { estimated: true, confidence: s.vision.confidence, aiName: s.vision.name })]);
                    setExtras((x) => ({ ...x, suggestions: x.suggestions.filter((_, j) => j !== i) }));
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> {s.vision.name} · ≈{s.grams} g
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'result' && extras.unmatched.length > 0 && (
          <div className="rounded-3xl bg-white p-4 ring-1 ring-ink-100">
            <p className="text-sm font-medium text-ink-700">Detectados, pero sin datos nutricionales en la base local:</p>
            <ul className="mt-2 space-y-2">
              {extras.unmatched.map((u, i) => (
                <li key={`${u.name}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {u.name}
                    {typeof u.estimated_grams === 'number' && <span className="text-ink-400"> · ≈{Math.round(u.estimated_grams)} g</span>}
                  </span>
                  <button className="chip bg-brand-50 px-3 py-1.5 text-brand-900" onClick={() => setSearchFor(u.name)}>
                    <Search className="h-3.5 w-3.5" /> Buscar
                  </button>
                </li>
              ))}
            </ul>
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
          onReanalyze={!manualMode ? () => (setPendingDraft(null), setStep('preview')) : undefined}
          onSaved={onSaved}
          appendRequest={append}
        />
        <FoodPicker
          open={searchFor !== null}
          initialQuery={searchFor ?? ''}
          onClose={() => setSearchFor(null)}
          onPick={(food: Food, grams: number) => {
            addItems([itemFromFood(food, grams)]);
            setExtras((x) => ({ ...x, unmatched: x.unmatched.filter((u) => u.name !== searchFor) }));
          }}
        />
      </div>
    );
  }

  // ───────────── Previsualización / análisis ─────────────
  const analyzing = step === 'analyzing';
  const failed = state.phase === 'error';
  const err = failed ? describeError(state.error) : null;
  const rawMessage = failed && !isAIError(state.error) && state.error instanceof Error ? state.error.message : '';

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
            <p className="font-medium">{state.phase === 'running' ? state.stage : 'Procesando…'}</p>
          </div>
          <ProgressBar value={0.6} className="mt-4" label="Análisis" />
          <p className="mt-2 text-xs text-ink-500">Proveedor: {label}</p>
        </div>
      )}

      {failed && err && (
        <div className={`mt-5 rounded-3xl p-5 ring-1 ${err.code === 'quota' || err.code === 'personal_limit' ? 'bg-amber-50 text-amber-950 ring-amber-100' : 'bg-red-50 text-red-900 ring-red-100'}`} role="alert">
          <div className="flex items-start gap-3">
            {err.code === 'quota' || err.code === 'personal_limit' ? <Gauge className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />}
            <div>
              <p className="font-semibold">{err.title}</p>
              <p className="mt-1 text-sm opacity-90">{err.message}</p>
              {rawMessage && <p className="mt-1 text-xs opacity-70">{rawMessage.slice(0, 160)}</p>}
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {err.code !== 'personal_limit' && err.code !== 'not_configured' && (
              <button className="btn bg-white ring-1 ring-black/10" onClick={runAnalysis}>
                <RefreshCw className="h-4 w-4" /> Reintentar
              </button>
            )}
            <Link to="/ajustes#ia" className="btn bg-white ring-1 ring-black/10">
              <Settings className="h-4 w-4" /> {err.code === 'not_configured' ? 'Configurar IA' : 'Cambiar proveedor'}
            </Link>
            <button className="btn-primary" onClick={continueManually}>
              <PenLine className="h-4 w-4" /> Añadir manualmente
            </button>
          </div>
        </div>
      )}

      {!analyzing && (
        <div className="mt-5 space-y-3">
          {manualMode ? (
            <button className="btn-primary w-full py-4 text-base" onClick={continueManually}>
              <PenLine className="h-5 w-5" /> Añadir los alimentos
            </button>
          ) : !ready ? (
            <div className="rounded-3xl bg-ink-50 p-4 text-sm text-ink-700">
              {provider.id === 'gemini'
                ? settings.geminiApiKey
                  ? 'Acepta las condiciones de uso de Gemini en Ajustes para empezar a analizar.'
                  : 'Configura tu clave gratuita de Google Gemini para analizar fotos.'
                : 'El proveedor de IA seleccionado no está configurado.'}{' '}
              <Link to="/ajustes#ia" className="font-medium text-brand-700 underline">
                Ir a Ajustes
              </Link>
            </div>
          ) : (
            <button className="btn-primary w-full py-4 text-base" onClick={runAnalysis} disabled={provider.usesQuota && !limit.allowed}>
              <Sparkles className="h-5 w-5" /> Analizar con IA
            </button>
          )}
          {provider.usesQuota && limit.level !== 'ok' && <LimitBanner text={limit.message} blocked={!limit.allowed} />}
          {provider.id === 'local' && ready && localCached === false && (
            <p className="text-center text-xs text-ink-500">La primera vez se descargará el modelo local (≈23 MB). Te recomendamos usar Wi-Fi.</p>
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

function AnalysisNotes({ analysis, empty, hasExtras }: { analysis: VisionAnalysis; empty: boolean; hasExtras: boolean }) {
  const notes = [...analysis.uncertainties, ...analysis.warnings];
  return (
    <div className="space-y-3">
      {analysis.meal_description && (
        <p className="rounded-3xl bg-white p-4 text-[15px] text-ink-800 ring-1 ring-ink-100">
          <span className="text-ink-500">La IA ve: </span>
          {analysis.meal_description}
        </p>
      )}
      {(!analysis.contains_food || analysis.image_quality === 'mala' || (empty && !hasExtras)) && (
        <div className="flex items-start gap-3 rounded-3xl bg-ink-50 p-4 text-sm text-ink-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-ink-500" />
          <p>
            {!analysis.contains_food
              ? 'No parece haber comida en la foto.'
              : analysis.image_quality === 'mala'
                ? 'La foto no es lo bastante clara para identificar los alimentos con seguridad.'
                : 'No se han identificado alimentos con suficiente confianza.'}{' '}
            No se ha inventado ninguna comida: añade los alimentos con «Editar alimentos» o prueba con otra foto.
          </p>
        </div>
      )}
      {notes.length > 0 && (
        <details className="rounded-3xl bg-amber-50/70 p-4 text-sm text-amber-950 ring-1 ring-amber-100">
          <summary className="flex cursor-pointer items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Dudas de la IA ({notes.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function LimitBanner({ text, blocked }: { text?: string; blocked: boolean }) {
  return (
    <div className={`mt-3 flex items-start gap-3 rounded-3xl p-4 text-sm ${blocked ? 'bg-amber-50 text-amber-950' : 'bg-sky-50 text-sky-900'}`} role="status">
      <Gauge className="mt-0.5 h-5 w-5 shrink-0" />
      <p>
        {text}{' '}
        <Link to="/ajustes#ia" className="font-medium underline">
          Ver uso
        </Link>
      </p>
    </div>
  );
}

function ProviderCard({ provider, label, ready, localCached }: { provider: string; label: string; ready: boolean; localCached: boolean | null }) {
  const text =
    provider === 'manual'
      ? 'Sin IA: añadirás los alimentos manualmente.'
      : !ready
        ? 'Sin configurar. Ve a Ajustes › Inteligencia artificial.'
        : provider === 'gemini'
          ? 'Modelo multimodal: analiza la foto completa. Usa tu cuota gratuita.'
          : provider === 'local'
            ? localCached
              ? 'Clasificador local descargado (funciona sin conexión, menos preciso).'
              : 'Clasificador local (≈23 MB la primera vez, menos preciso).'
            : 'Proveedor experimental.';
  return (
    <InfoCard icon={Cpu} title={provider === 'manual' ? 'Modo manual' : label}>
      {text}{' '}
      <Link to="/ajustes#ia" className="font-medium text-brand-700 underline">
        Cambiar
      </Link>
    </InfoCard>
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
