import { getSettings, setSettings } from '@/db/settings';
import { runSync, type SyncReport } from './engine';
import { getSupabase } from './client';
import { SupabaseRemote } from './supabaseRemote';

export { getSupabase, getSupabaseConfig, resetSupabaseClient, validateSupabaseConfig } from './client';
export type { SyncReport } from './engine';

let running: Promise<SyncReport | null> | null = null;

/**
 * Sincroniza con Supabase si está configurado, activado y hay sesión.
 * Devuelve null si no procede sincronizar. Nunca lanza por falta de configuración.
 */
export function syncNow(onProgress?: (m: string) => void): Promise<SyncReport | null> {
  running ??= (async () => {
    try {
      const settings = await getSettings();
      if (!settings.syncEnabled) return null;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
      const sb = await getSupabase();
      if (!sb) return null;
      const { data } = await sb.auth.getSession();
      const user = data.session?.user;
      if (!user) return null;
      const report = await runSync(new SupabaseRemote(sb, user.id), {
        cursor: settings.lastPulledAt,
        syncPhotos: settings.syncPhotos,
        onProgress,
      });
      await setSettings({ lastPulledAt: report.cursor, lastSyncAt: Date.now() });
      return report;
    } finally {
      running = null;
    }
  })();
  return running;
}
