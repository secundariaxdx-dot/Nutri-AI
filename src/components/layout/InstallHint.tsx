import { Link } from 'react-router-dom';
import { Download, Share, X } from 'lucide-react';
import { setSetting } from '@/db/settings';
import { useSettings } from '@/hooks/useData';
import { useInstall } from '@/hooks/useInstall';

/** Sugerencia discreta para instalar la app en la pantalla de inicio. */
export function InstallHint() {
  const { standalone, ios, canPrompt, prompt } = useInstall();
  const settings = useSettings();
  if (standalone || settings.installHintDismissed || (!ios && !canPrompt)) return null;
  return (
    <div className="relative flex animate-slide-up items-center gap-3 rounded-3xl bg-brand-50 p-4 pr-10 ring-1 ring-brand-100">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-800 shadow-sm">
        {ios ? <Share className="h-5 w-5" /> : <Download className="h-5 w-5" />}
      </div>
      <div className="text-sm text-brand-950">
        <p className="font-semibold">Instala Nutri AI</p>
        {ios ? (
          <p className="text-brand-900/80">
            Pulsa <strong>Compartir</strong> y luego <strong>Añadir a pantalla de inicio</strong>.{' '}
            <Link to="/instalar" className="font-medium underline">
              Ver pasos
            </Link>
          </p>
        ) : (
          <button className="font-medium text-brand-800 underline" onClick={prompt}>
            Añadir a tu dispositivo
          </button>
        )}
      </div>
      <button aria-label="Ocultar sugerencia" className="absolute right-3 top-3 rounded-full p-1 text-brand-900/50 hover:bg-white" onClick={() => setSetting('installHintDismissed', true)}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
