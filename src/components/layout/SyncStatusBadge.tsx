import { Cloud, CloudOff, HardDrive, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSync } from '@/hooks/useSync';

export function SyncStatusBadge() {
  const { status, pending, message } = useSync();
  const base = 'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium';
  if (status === 'off')
    return (
      <Link to="/ajustes#sincronizacion" className={`${base} bg-ink-50 text-ink-500 hover:bg-ink-100`}>
        <HardDrive className="h-4 w-4" /> Solo en este dispositivo
      </Link>
    );
  if (status === 'syncing')
    return (
      <div className={`${base} bg-brand-50 text-brand-800`}>
        <RefreshCw className="h-4 w-4 animate-spin" /> {message ?? 'Sincronizando…'}
      </div>
    );
  if (status === 'error')
    return (
      <Link to="/ajustes#sincronizacion" className={`${base} bg-red-50 text-red-700`} title={message}>
        <CloudOff className="h-4 w-4" /> Error al sincronizar
      </Link>
    );
  return (
    <div className={`${base} bg-brand-50 text-brand-800`}>
      <Cloud className="h-4 w-4" /> {pending > 0 ? `${pending} cambios pendientes` : 'Sincronizado'}
    </div>
  );
}
