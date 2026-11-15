import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

/** Avisa cuando hay una versión nueva de la app y permite actualizar. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Comprueba actualizaciones cada hora mientras la app está abierta.
      if (reg) setInterval(() => reg.update().catch(() => undefined), 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-4 bottom-24 z-[80] mx-auto flex max-w-md animate-slide-up items-center gap-3 rounded-2xl bg-ink-900 px-4 py-3 text-sm text-white shadow-lift lg:bottom-6">
      <RefreshCw className="h-5 w-5 shrink-0 text-brand-300" />
      <span className="flex-1">Hay una nueva versión de Nutri AI.</span>
      <button className="font-semibold text-white/60" onClick={() => setNeedRefresh(false)}>
        Luego
      </button>
      <button className="font-semibold text-brand-300" onClick={() => updateServiceWorker(true)}>
        Actualizar
      </button>
    </div>
  );
}
