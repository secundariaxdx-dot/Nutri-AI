import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  show: (message: string, kind?: ToastKind, opts?: { action?: ToastItem['action']; durationMs?: number }) => void;
  success: (message: string, opts?: { action?: ToastItem['action'] }) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);

  const show = useCallback<ToastApi['show']>(
    (message, kind = 'info', opts) => {
      const id = next.current++;
      setItems((l) => [...l.slice(-2), { id, kind, message, action: opts?.action }]);
      setTimeout(() => dismiss(id), opts?.durationMs ?? (kind === 'error' ? 6000 : opts?.action ? 6000 : 3200));
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m, o) => show(m, 'success', o),
      error: (m) => show(m, 'error'),
      info: (m) => show(m, 'info'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+12px)]"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-md animate-slide-up items-start gap-3 rounded-2xl bg-ink-900/95 px-4 py-3 text-sm text-white shadow-lift backdrop-blur"
          >
            {t.kind === 'success' && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />}
            {t.kind === 'error' && <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />}
            {t.kind === 'info' && <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />}
            <p className="flex-1 leading-snug">{t.message}</p>
            {t.action && (
              <button
                className="shrink-0 font-semibold text-brand-300"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button aria-label="Cerrar aviso" className="shrink-0 text-white/60 hover:text-white" onClick={() => dismiss(t.id)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}
