import { useEffect, useState, type FormEvent } from 'react';
import { Cloud, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { setSettings } from '@/db/settings';
import { useSettings } from '@/hooks/useData';
import { useOnline } from '@/hooks/useOnline';
import { useSync } from '@/hooks/useSync';
import { getSupabase, getSupabaseConfig, resetSupabaseClient, validateSupabaseConfig } from '@/services/sync';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

/** Configuración opcional de sincronización multidispositivo con Supabase. */
export function SyncSection() {
  const settings = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const online = useOnline();
  const { sync, status, message, pending } = useSync();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [fromEnv, setFromEnv] = useState(false);
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const cfg = await getSupabaseConfig();
      setConfigured(!!cfg);
      setFromEnv(!!cfg && !settings.supabaseUrl);
      if (!cfg) return;
      const sb = await getSupabase();
      if (!sb) return;
      const { data } = await sb.auth.getSession();
      setUser(data.session?.user ?? null);
      const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
      unsub = () => sub.subscription.unsubscribe();
    })().catch(() => setConfigured(false));
    return () => unsub?.();
  }, [settings.supabaseUrl, settings.supabaseAnonKey]);

  const saveConfig = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateSupabaseConfig(url, key);
    if (err) return toast.error(err);
    resetSupabaseClient();
    await setSettings({ supabaseUrl: url.trim().replace(/\/$/, ''), supabaseAnonKey: key.trim() });
    toast.success('Proyecto de Supabase configurado');
  };

  const auth = async (mode: 'login' | 'signup') => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error('Introduce un correo válido');
    if (password.length < 8) return toast.error('La contraseña debe tener al menos 8 caracteres');
    setBusy(true);
    try {
      const sb = await getSupabase();
      if (!sb) throw new Error('Supabase no está configurado');
      if (mode === 'signup') {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) toast.info('Cuenta creada. Revisa tu correo para confirmarla y después inicia sesión.');
        else toast.success('Cuenta creada');
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await setSettings({ syncEnabled: true, lastPulledAt: '1970-01-01T00:00:00.000Z' });
        toast.success('Sesión iniciada. Sincronizando…');
      }
      setPassword('');
    } catch (e) {
      const msg = (e as Error).message;
      toast.error(/Invalid login/i.test(msg) ? 'Correo o contraseña incorrectos' : /confirm/i.test(msg) ? 'Debes confirmar tu correo antes de iniciar sesión' : msg);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    const ok = await confirm({ title: '¿Cerrar sesión?', message: 'Tus datos seguirán guardados en este dispositivo. La sincronización se detendrá.', confirmLabel: 'Cerrar sesión' });
    if (!ok) return;
    const sb = await getSupabase();
    await sb?.auth.signOut();
    await setSettings({ syncEnabled: false });
  };

  const removeConfig = async () => {
    const ok = await confirm({ title: '¿Quitar la configuración?', message: 'Se desactivará la sincronización. Los datos locales no se borran.', confirmLabel: 'Quitar', danger: true });
    if (!ok) return;
    const sb = await getSupabase();
    await sb?.auth.signOut().catch(() => undefined);
    resetSupabaseClient();
    await setSettings({ supabaseUrl: '', supabaseAnonKey: '', syncEnabled: false, lastPulledAt: '1970-01-01T00:00:00.000Z' });
  };

  return (
    <section id="sincronizacion" className="card scroll-mt-6 space-y-4 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-800">
          <Cloud className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold">Sincronización entre dispositivos (opcional)</h2>
          <p className="text-sm text-ink-500">Usa tu propio proyecto gratuito de Supabase. Sin configurarlo, todo funciona igual y los datos se quedan en este dispositivo.</p>
        </div>
      </div>

      <details className="rounded-2xl bg-ink-50 p-4 text-sm text-ink-700">
        <summary className="cursor-pointer font-medium">¿Qué se sincroniza?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Tus comidas (alimentos, cantidades, nutrientes, fecha y notas).</li>
          <li>Tu perfil y objetivos (edad, altura, peso, nivel de actividad, objetivo).</li>
          <li>Tus alimentos personalizados.</li>
          <li>Las fotos de las comidas, solo si activas «Sincronizar fotos» (en un almacenamiento privado de tu proyecto).</li>
        </ul>
        <p className="mt-2">Los datos se guardan en TU proyecto de Supabase, protegidos por tu cuenta y por reglas de seguridad por usuario (RLS). Nutri AI no tiene servidores propios.</p>
      </details>

      {configured === null ? (
        <Spinner />
      ) : !configured ? (
        <form onSubmit={saveConfig} className="space-y-3">
          <div>
            <label className="label" htmlFor="sb-url">
              URL del proyecto
            </label>
            <input id="sb-url" className="input" placeholder="https://xxxx.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" />
          </div>
          <div>
            <label className="label" htmlFor="sb-key">
              Clave pública (anon / publishable)
            </label>
            <input id="sb-key" className="input font-mono text-xs" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
            <p className="mt-1 text-xs text-ink-500">Nunca uses la clave «service_role» o «secret». Consulta el README para crear el proyecto y las tablas.</p>
          </div>
          <button className="btn-secondary w-full">Guardar configuración</button>
        </form>
      ) : !user ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-600">Inicia sesión o crea una cuenta en tu proyecto para empezar a sincronizar.</p>
          <input className="input" type="email" autoComplete="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Correo electrónico" />
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="Contraseña (mín. 8 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="Contraseña"
          />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-primary" disabled={busy || !online} onClick={() => auth('login')}>
              {busy ? <Spinner /> : 'Iniciar sesión'}
            </button>
            <button className="btn-secondary" disabled={busy || !online} onClick={() => auth('signup')}>
              Crear cuenta
            </button>
          </div>
          {!fromEnv && (
            <button className="text-sm font-medium text-red-600" onClick={removeConfig}>
              Quitar configuración de Supabase
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
            <ShieldCheck className="h-4 w-4" /> Sesión iniciada como <strong className="truncate">{user.email}</strong>
          </div>
          <Toggle label="Sincronización activada" checked={settings.syncEnabled} onChange={(v) => setSettings({ syncEnabled: v })} />
          <Toggle label="Sincronizar fotos" hint="Usa almacenamiento de tu proyecto (1 GB gratis)" checked={settings.syncPhotos} onChange={(v) => setSettings({ syncPhotos: v })} />
          <div className="flex items-center justify-between text-sm text-ink-600">
            <span>
              {status === 'syncing'
                ? message ?? 'Sincronizando…'
                : status === 'error'
                  ? <span className="text-red-600">Error: {message}</span>
                  : settings.lastSyncAt
                    ? `Última sincronización: ${new Date(settings.lastSyncAt).toLocaleString('es-ES')}`
                    : 'Aún no se ha sincronizado'}
              {pending > 0 && ` · ${pending} pendientes`}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn-secondary"
              disabled={status === 'syncing' || !settings.syncEnabled || !online}
              onClick={async () => {
                const r = await sync();
                if (r) toast.success(`Sincronizado: ${r.pushed} enviados, ${r.pulled} recibidos${r.conflicts ? `, ${r.conflicts} conflictos resueltos` : ''}`);
              }}
            >
              <RefreshCw className={`h-4 w-4 ${status === 'syncing' ? 'animate-spin' : ''}`} /> Sincronizar ahora
            </button>
            <button className="btn-ghost ring-1 ring-ink-200" onClick={logout}>
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl px-1 py-1">
      <span>
        <span className="block text-sm font-medium text-ink-800">{label}</span>
        {hint && <span className="block text-xs text-ink-500">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-brand-700' : 'bg-ink-300'}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}
