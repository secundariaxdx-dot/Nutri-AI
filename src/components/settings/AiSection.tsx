import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Cpu, Download, Eye, EyeOff, Gauge, KeyRound, ShieldAlert, Trash2, XCircle } from 'lucide-react';
import { checkAiSupport, getRecognizer, isModelCached, type LoadProgress } from '@/ai';
import { createProvider, describeError } from '@/ai/providers';
import { checkLimits, getUsageSummary, type UsageSummary } from '@/ai/usage';
import { VISION_MODELS, getVisionModel } from '@/config/ai';
import { GEMINI_MODELS, PROVIDERS, getGeminiModel } from '@/config/aiProviders';
import { db } from '@/db/database';
import { setSettings, type AppSettings } from '@/db/settings';
import { useSettings } from '@/hooks/useData';
import { useOnline } from '@/hooks/useOnline';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { NumberInput } from '@/components/ui/NumberInput';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { Toggle } from './SyncSection';

const fmtTime = (d: Date) => d.toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Ajustes › Inteligencia artificial: proveedor, modelo, clave, uso y límites. */
export function AiSection() {
  const settings = useSettings();
  const active = PROVIDERS.find((p) => p.id === settings.aiProvider);
  return (
    <section id="ia" className="card scroll-mt-6 space-y-5 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-800">
          <Cpu className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold">Inteligencia artificial</h2>
          <p className="text-sm text-ink-500">
            Proveedor activo: <strong className="text-ink-800">{settings.aiEnabled ? active?.label : 'Ninguno (IA desactivada)'}</strong>. La IA solo identifica alimentos y cantidades;
            los nutrientes siempre salen de la base de datos.
          </p>
        </div>
      </div>

      <Toggle label="Análisis de fotos con IA" hint="Si lo desactivas, las fotos se registran manualmente" checked={settings.aiEnabled} onChange={(v) => setSettings({ aiEnabled: v })} />

      <fieldset className="space-y-2" disabled={!settings.aiEnabled}>
        <legend className="label">Proveedor</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3 ring-1 transition ${settings.aiProvider === p.id ? 'bg-brand-50 ring-brand-300' : 'ring-ink-200 hover:bg-ink-50'}`}
            >
              <input type="radio" name="provider" className="mt-1 accent-brand-700" checked={settings.aiProvider === p.id} onChange={() => setSettings({ aiProvider: p.id })} />
              <span>
                <span className="block text-sm font-semibold">
                  {p.label} {p.experimental && <span className="chip ml-1 bg-amber-50 text-amber-700">Experimental</span>}
                </span>
                <span className="block text-xs text-ink-500">{p.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {settings.aiProvider === 'gemini' && <GeminiSettings settings={settings} />}
      {settings.aiProvider === 'local' && <LocalSettings settings={settings} />}
      {settings.aiProvider === 'azure' && <AzureSettings settings={settings} />}

      <UsagePanel settings={settings} />
    </section>
  );
}

function ConnectionTest({ settings }: { settings: AppSettings }) {
  const online = useOnline();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setStatus(null), [settings.geminiApiKey, settings.geminiModel, settings.aiProvider, settings.azureApiKey]);
  const test = async () => {
    setBusy(true);
    try {
      setStatus(await createProvider({ ...settings, aiEnabled: true }).validate());
    } catch (e) {
      setStatus({ ok: false, message: describeError(e).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <button className="btn-secondary w-full" onClick={test} disabled={busy || !online}>
        {busy ? <Spinner /> : <CheckCircle2 className="h-4 w-4" />} Validar conexión
      </button>
      {status && (
        <p className={`flex items-start gap-2 rounded-2xl px-3 py-2 text-sm ${status.ok ? 'bg-brand-50 text-brand-900' : 'bg-red-50 text-red-800'}`} role="status">
          {status.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />} {status.message}
        </p>
      )}
      {!online && <p className="text-xs text-ink-500">Sin conexión: no se puede validar ahora.</p>}
    </div>
  );
}

function SecretInput({ id, label, value, onSave, placeholder }: { id: string; label: string; value: string; onSave: (v: string) => Promise<void>; placeholder: string }) {
  const [draft, setDraft] = useState('');
  const [show, setShow] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {value ? (
        <div className="flex items-center gap-2">
          <div className="input flex items-center gap-2 font-mono text-sm text-ink-500">
            <KeyRound className="h-4 w-4" /> {value.slice(0, 4)}••••••••{value.slice(-3)}
          </div>
          <button
            className="btn-danger shrink-0 px-3"
            aria-label="Eliminar clave"
            onClick={async () => {
              if (await confirm({ title: '¿Eliminar la clave?', message: 'Se borrará de este dispositivo. Podrás introducirla de nuevo.', confirmLabel: 'Eliminar', danger: true })) {
                await onSave('');
                toast.success('Clave eliminada de este dispositivo');
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (draft.trim().length < 10) return toast.error('La clave parece demasiado corta.');
            await onSave(draft.trim());
            setDraft('');
            toast.success('Clave guardada en este dispositivo');
          }}
        >
          <div className="relative flex-1">
            <input
              id={id}
              className="input pr-11 font-mono text-sm"
              type={show ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder={placeholder}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="button" aria-label={show ? 'Ocultar' : 'Mostrar'} className="absolute inset-y-0 right-3 text-ink-400" onClick={() => setShow((s) => !s)}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button className="btn-secondary shrink-0">Guardar</button>
        </form>
      )}
    </div>
  );
}

function GeminiSettings({ settings }: { settings: AppSettings }) {
  const model = getGeminiModel(settings.geminiModel);
  return (
    <div className="space-y-4 rounded-3xl bg-ink-50/70 p-4">
      <div>
        <label className="label" htmlFor="gmodel">
          Modelo de Gemini
        </label>
        <select id="gmodel" className="input" value={model.id} onChange={(e) => setSettings({ geminiModel: e.target.value })}>
          {GEMINI_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-500">
          {model.note} Todos tienen nivel gratuito según la tabla oficial de precios (comprobado el {new Date(model.freeTierVerified).toLocaleDateString('es-ES')}).
        </p>
      </div>

      <SecretInput id="gkey" label="Clave de API de Google AI Studio" value={settings.geminiApiKey} placeholder="Pega aquí tu clave" onSave={(v) => setSettings({ geminiApiKey: v })} />
      <ConnectionTest settings={settings} />

      <details className="rounded-2xl bg-white p-4 text-sm text-ink-700 ring-1 ring-ink-100">
        <summary className="cursor-pointer font-medium">Cómo conseguir la clave gratis (sin tarjeta)</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>
            Entra en{' '}
            <a className="text-brand-700 underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              aistudio.google.com/apikey
            </a>{' '}
            con tu cuenta de Google y crea una clave.
          </li>
          <li>
            <strong>No vincules facturación</strong> al proyecto: sin facturación el proyecto se queda en el nivel gratuito y no puede generar cargos.
          </li>
          <li>
            Restringe la clave a «Gemini API» (AI Studio › tu clave › <em>Add restrictions</em> › <em>Restrict to Gemini API only</em>). Google rechaza las claves estándar sin
            restricciones.
          </li>
          <li>
            Consulta tus límites gratuitos reales en{' '}
            <a className="text-brand-700 underline" href="https://aistudio.google.com/rate-limit" target="_blank" rel="noreferrer">
              aistudio.google.com/rate-limit
            </a>{' '}
            y, si quieres, copia el límite diario (RPD) en «Límites» más abajo.
          </li>
          <li>Pega la clave aquí, pulsa «Validar conexión» y acepta las condiciones.</li>
        </ol>
      </details>

      <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-100">
        <p className="flex items-center gap-2 font-semibold">
          <ShieldAlert className="h-4 w-4" /> Condiciones del nivel gratuito de Gemini (resumen)
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Google usa las fotos y respuestas del nivel gratuito para mejorar sus productos y personas revisoras pueden verlas. No envíes caras, documentos ni datos personales.</li>
          <li>Las condiciones exigen tener 18 años o más.</li>
          <li>
            Las condiciones indican que, al ofrecer una aplicación a usuarios del Espacio Económico Europeo, Suiza o Reino Unido, solo pueden usarse servicios de pago. Revisa
            si tu uso personal encaja en las{' '}
            <a className="underline" href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">
              condiciones oficiales
            </a>
            ; la decisión es tuya.
          </li>
          <li>Los límites gratuitos no están garantizados y pueden cambiar. Nunca se activa facturación desde Nutri AI.</li>
          <li>La clave se guarda solo en este navegador. Es aceptable para uso personal, pero no para una app pública con varios usuarios (necesitaría un servidor intermedio).</li>
        </ul>
        <label className="mt-3 flex cursor-pointer items-start gap-2 font-medium">
          <input type="checkbox" className="mt-1 accent-brand-700" checked={settings.geminiTermsAccepted} onChange={(e) => setSettings({ geminiTermsAccepted: e.target.checked })} />
          He leído las condiciones, mi proyecto no tiene facturación activada y acepto enviar las fotos a Google.
        </label>
      </div>
    </div>
  );
}

function AzureSettings({ settings }: { settings: AppSettings }) {
  return (
    <div className="space-y-4 rounded-3xl bg-ink-50/70 p-4">
      <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-950">
        <strong>Experimental y no gratuito de forma permanente.</strong> Azure for Students ofrece 100 USD de crédito durante 12 meses (sin tarjeta) y renovable mientras seas
        estudiante. Cada análisis con Azure OpenAI consume ese crédito. Nutri AI nunca lo usa automáticamente ni como respaldo. Usa una sola cuenta de estudiante. Este proveedor no
        se ha podido probar contra un recurso real.
      </p>
      <div>
        <label className="label" htmlFor="az-endpoint">
          Endpoint del recurso
        </label>
        <input id="az-endpoint" className="input font-mono text-sm" placeholder="https://mi-recurso.openai.azure.com" value={settings.azureEndpoint} onChange={(e) => setSettings({ azureEndpoint: e.target.value.trim() })} />
      </div>
      <div>
        <label className="label" htmlFor="az-dep">
          Nombre del despliegue (modelo con visión)
        </label>
        <input id="az-dep" className="input" placeholder="p. ej. gpt-4o-mini" value={settings.azureDeployment} onChange={(e) => setSettings({ azureDeployment: e.target.value.trim() })} />
      </div>
      <SecretInput id="az-key" label="Clave del recurso" value={settings.azureApiKey} placeholder="Clave de Azure" onSave={(v) => setSettings({ azureApiKey: v })} />
      <label className="flex cursor-pointer items-start gap-2 text-sm font-medium">
        <input type="checkbox" className="mt-1 accent-brand-700" checked={settings.azureAcknowledgedCredit} onChange={(e) => setSettings({ azureAcknowledgedCredit: e.target.checked })} />
        Entiendo que cada análisis consume crédito de mi suscripción de Azure.
      </label>
      <ConnectionTest settings={settings} />
    </div>
  );
}

function LocalSettings({ settings }: { settings: AppSettings }) {
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
      toast.success('Modelo descargado. Funciona sin conexión.');
    } catch (e) {
      toast.error(`No se pudo descargar el modelo: ${(e as Error).message}`);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const clear = async () => {
    if (!(await confirm({ title: '¿Borrar el modelo descargado?', message: 'Se volverá a descargar la próxima vez que lo uses.', confirmLabel: 'Borrar', danger: true }))) return;
    getRecognizer(model.id).dispose();
    await caches.delete('transformers-cache').catch(() => undefined);
    setCached(false);
  };

  return (
    <div className="space-y-3 rounded-3xl bg-ink-50/70 p-4">
      <p className="text-sm text-ink-600">
        Clasificador de etiquetas que se ejecuta en tu dispositivo: privado y sin cuota, pero no entiende la foto como un modelo multimodal (no cuenta piezas ni ve la
        preparación).
      </p>
      {!support.supported && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">{support.reason}</p>}
      <select className="input" aria-label="Modelo local" value={model.id} onChange={(e) => setSettings({ visionModel: e.target.value })}>
        {VISION_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} · ≈{m.downloadMb} MB
          </option>
        ))}
      </select>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 text-sm">
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
      {loading && <ProgressBar value={progress?.stage === 'download' ? progress.progress : progress?.stage === 'init' ? 1 : 0.02} label="Descarga del modelo" />}
    </div>
  );
}

function UsagePanel({ settings }: { settings: AppSettings }) {
  const provider = settings.aiProvider;
  const quotaProvider = provider === 'gemini' || provider === 'azure';
  const usage = useLiveQuery<UsageSummary | undefined>(() => getUsageSummary(provider), [provider]);
  const confirm = useConfirm();
  if (!quotaProvider) {
    return <p className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-600">Este proveedor no consume cuota: no hay límites de uso.</p>;
  }
  if (!usage) return <Spinner />;
  const check = checkLimits(usage, settings);
  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <Gauge className="h-4 w-4 text-brand-700" /> Uso y límites
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Meter label="Hoy" used={usage.today} limit={settings.aiDailyLimit} reset={`Reinicio: ${fmtTime(usage.nextDailyReset)}`} />
        <Meter label="Este mes" used={usage.month} limit={settings.aiMonthlyLimit} reset={`Reinicio: ${fmtTime(usage.nextMonthlyReset)}`} />
      </div>
      {provider === 'gemini' && (
        <p className="text-xs text-ink-500">
          Día de cuota de Google: {usage.providerDay} peticiones desde la medianoche del Pacífico. Próximo reinicio oficial: {fmtTime(usage.nextProviderReset)} (tu hora local).
        </p>
      )}
      {check.level !== 'ok' && (
        <p className={`rounded-2xl px-3 py-2 text-sm ${check.allowed ? 'bg-sky-50 text-sky-900' : 'bg-amber-50 text-amber-950'}`}>{check.message}</p>
      )}

      <details className="rounded-2xl bg-ink-50 p-4">
        <summary className="cursor-pointer text-sm font-medium">Configurar límites</summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="lim-d">
              Límite personal diario
            </label>
            <NumberInput id="lim-d" value={settings.aiDailyLimit} onChange={(v) => v !== undefined && setSettings({ aiDailyLimit: Math.round(v) })} min={0} max={10000} allowEmpty={false} />
          </div>
          <div>
            <label className="label" htmlFor="lim-m">
              Límite personal mensual
            </label>
            <NumberInput id="lim-m" value={settings.aiMonthlyLimit} onChange={(v) => v !== undefined && setSettings({ aiMonthlyLimit: Math.round(v) })} min={0} max={100000} allowEmpty={false} />
          </div>
          <div>
            <label className="label" htmlFor="lim-w">
              Avisar al
            </label>
            <NumberInput id="lim-w" value={settings.aiWarnPercent} onChange={(v) => v !== undefined && setSettings({ aiWarnPercent: Math.round(v) })} min={1} max={100} suffix="%" allowEmpty={false} />
          </div>
          <div>
            <label className="label" htmlFor="lim-p">
              Límite diario de Google (RPD)
            </label>
            <NumberInput id="lim-p" value={settings.providerDailyLimit || undefined} onChange={(v) => setSettings({ providerDailyLimit: v ? Math.round(v) : 0 })} min={0} max={100000} placeholder="Opcional" />
          </div>
        </div>
        <div className="mt-3">
          <Toggle label="Detener nuevos análisis al llegar al 100 %" checked={settings.aiBlockAtLimit} onChange={(v) => setSettings({ aiBlockAtLimit: v })} />
        </div>
        <p className="mt-2 text-xs text-ink-500">
          Los límites personales son tuyos (0 = sin límite). Google no publica los límites gratuitos en su documentación: el valor «RPD» es una estimación que copias de AI Studio y
          puede cambiar. Nutri AI nunca hace reintentos automáticos: cada foto es una petición.
        </p>
      </details>

      <details className="rounded-2xl bg-ink-50 p-4">
        <summary className="cursor-pointer text-sm font-medium">Registro de errores ({usage.errors.length})</summary>
        {usage.errors.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">Sin errores.</p>
        ) : (
          <>
            <ul className="mt-2 space-y-2 text-xs">
              {usage.errors.map((e) => (
                <li key={e.id} className="rounded-xl bg-white p-2">
                  <span className="font-semibold">{new Date(e.ts).toLocaleString('es-ES')}</span> · {e.provider} · <code>{e.errorCode}</code>
                  {e.message && <div className="mt-0.5 text-ink-500">{e.message}</div>}
                </li>
              ))}
            </ul>
            <button
              className="mt-2 text-xs font-medium text-red-600"
              onClick={async () => {
                if (await confirm({ title: '¿Vaciar el registro de errores?', confirmLabel: 'Vaciar', danger: true })) {
                  const ids = (await db.aiUsage.toArray()).filter((r) => r.outcome === 'error').map((r) => r.id!);
                  await db.aiUsage.bulkDelete(ids);
                }
              }}
            >
              Vaciar registro
            </button>
          </>
        )}
      </details>
    </div>
  );
}

function Meter({ label, used, limit, reset }: { label: string; used: number; limit: number; reset: string }) {
  return (
    <div className="rounded-2xl bg-ink-50 p-3">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink-600">{label}</span>
        <span className="font-semibold tabular-nums">
          {used}
          {limit > 0 && <span className="font-normal text-ink-400"> / {limit}</span>}
        </span>
      </div>
      {limit > 0 && <ProgressBar value={used / limit} className="mt-2" label={`${label}: ${used} de ${limit}`} />}
      <p className="mt-1.5 text-[11px] text-ink-400">{reset}</p>
    </div>
  );
}
