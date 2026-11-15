import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { syncNow, type SyncReport } from '@/services/sync';
import { usePendingSyncCount, useSettings } from './useData';

interface SyncState {
  status: 'off' | 'idle' | 'syncing' | 'error';
  message?: string;
  lastReport?: SyncReport;
  sync: () => Promise<SyncReport | null>;
  pending: number;
}

const SyncContext = createContext<SyncState | null>(null);

/**
 * Sincronización automática (solo si el usuario la activa):
 * al abrir la app, al recuperar conexión, tras cambios locales y cada 5 min.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const pending = usePendingSyncCount();
  const [status, setStatus] = useState<SyncState['status']>('off');
  const [message, setMessage] = useState<string>();
  const [lastReport, setLastReport] = useState<SyncReport>();
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const sync = useCallback(async () => {
    if (!settings.syncEnabled) {
      setStatus('off');
      return null;
    }
    setStatus('syncing');
    setMessage(undefined);
    try {
      const r = await syncNow((m) => setMessage(m));
      if (r) setLastReport(r);
      setStatus('idle');
      setMessage(undefined);
      return r;
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Error de sincronización');
      return null;
    }
  }, [settings.syncEnabled]);

  // Al activar y periódicamente
  useEffect(() => {
    if (!settings.syncEnabled) {
      setStatus('off');
      return;
    }
    sync();
    const id = setInterval(() => document.visibilityState === 'visible' && sync(), 5 * 60 * 1000);
    const onOnline = () => sync();
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', onOnline);
    };
  }, [settings.syncEnabled, sync]);

  // Tras cambios locales (con espera para agrupar ediciones)
  useEffect(() => {
    if (!settings.syncEnabled || pending === 0) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => sync(), 4000);
    return () => clearTimeout(timer.current);
  }, [pending, settings.syncEnabled, sync]);

  const value = useMemo(() => ({ status, message, lastReport, sync, pending }), [status, message, lastReport, sync, pending]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncState {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync debe usarse dentro de SyncProvider');
  return ctx;
}
