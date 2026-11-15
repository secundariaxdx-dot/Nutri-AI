import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

/** Diálogo de confirmación accesible basado en promesas: `await confirm({...})`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>();

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => (resolver.current = resolve));
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!opts} onClose={() => close(false)} variant="dialog" size="sm">
        {opts && (
          <div className="pt-6 text-center">
            {opts.danger && (
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            )}
            <h2 className="text-lg font-semibold">{opts.title}</h2>
            {opts.message && <p className="mt-2 text-sm text-ink-600">{opts.message}</p>}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="btn-ghost bg-ink-100" onClick={() => close(false)}>
                {opts.cancelLabel ?? 'Cancelar'}
              </button>
              <button className={opts.danger ? 'btn bg-red-600 text-white hover:bg-red-700' : 'btn-primary'} onClick={() => close(true)} autoFocus>
                {opts.confirmLabel ?? 'Aceptar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de ConfirmProvider');
  return ctx;
}
