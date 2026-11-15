/**
 * Cliente de Supabase cargado bajo demanda: si no se configura la
 * sincronización, la librería ni siquiera se descarga.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSettings } from '@/db/settings';

let cached: { url: string; key: string; client: SupabaseClient } | null = null;

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export async function getSupabaseConfig(): Promise<SupabaseConfig | null> {
  const s = await getSettings();
  const url = s.supabaseUrl || (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
  const anonKey = s.supabaseAnonKey || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';
  if (!url || !anonKey) return null;
  return { url: url.trim().replace(/\/$/, ''), anonKey: anonKey.trim() };
}

export function validateSupabaseConfig(url: string, key: string): string | null {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in|net)$/i.test(url.trim().replace(/\/$/, '')) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url.trim())) {
    return 'La URL debe tener el formato https://<proyecto>.supabase.co';
  }
  if (key.trim().length < 20) return 'La clave anónima (anon / publishable) no parece válida.';
  // Protección: nunca aceptar la service_role key en el navegador.
  try {
    const payload = JSON.parse(atob(key.split('.')[1] ?? ''));
    if (payload?.role === 'service_role') return 'Has pegado la clave service_role. Usa la clave «anon» pública.';
  } catch {
    /* las claves publishable nuevas no son JWT */
  }
  if (key.startsWith('sb_secret_')) return 'Has pegado una clave secreta. Usa la clave «publishable» / «anon».';
  return null;
}

export async function getSupabase(): Promise<SupabaseClient | null> {
  const cfg = await getSupabaseConfig();
  if (!cfg) return null;
  if (cached && cached.url === cfg.url && cached.key === cfg.anonKey) return cached.client;
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'nutri-ai-auth' },
  });
  cached = { url: cfg.url, key: cfg.anonKey, client };
  return client;
}

export function resetSupabaseClient() {
  cached = null;
}
