import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Globe, Info, Lock, Smartphone } from 'lucide-react';
import { APP_VERSION } from '@/config/app';
import { setSettings } from '@/db/settings';
import { useSettings } from '@/hooks/useData';
import { FOOD_DATASET_NAME, getAllFoods, getDishes } from '@/lib/foodDatabase';
import { PageHeader } from '@/components/layout/PageHeader';
import { AiSection } from '@/components/settings/AiSection';
import { DataSection } from '@/components/settings/DataSection';
import { SyncSection } from '@/components/settings/SyncSection';
import { useToast } from '@/components/ui/Toast';

export default function SettingsPage() {
  const settings = useSettings();
  const toast = useToast();
  const [key, setKey] = useState<string | null>(null);

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title="Ajustes" subtitle="IA, fuentes de datos, sincronización y privacidad" />

      <div className="grid gap-3 sm:grid-cols-2">
        <NavRow to="/instalar" icon={Smartphone} title="Instalar en el móvil" text="Añade Nutri AI a tu pantalla de inicio" />
        <NavRow to="/privacidad" icon={Lock} title="Privacidad" text="Qué datos se guardan y dónde" />
      </div>

      <AiSection />

      <section className="card space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-800">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Fuentes nutricionales</h2>
            <p className="text-sm text-ink-500">Todas son gratuitas y públicas.</p>
          </div>
        </div>
        <ul className="space-y-2 text-sm text-ink-700">
          <li>
            <strong>Base local</strong>: {getAllFoods().length} alimentos y {getDishes().length} platos de {FOOD_DATASET_NAME}. Funciona sin conexión.
          </li>
          <li>
            <strong>Open Food Facts</strong>: productos envasados y códigos de barras. Sin clave.
          </li>
          <li>
            <strong>USDA FoodData Central</strong>: búsqueda ampliada (en inglés). Funciona con la clave de demostración, pero es muy limitada: consigue una clave gratuita
            (sin tarjeta) en{' '}
            <a className="text-brand-700 underline" href="https://fdc.nal.usda.gov/api-key-signup" target="_blank" rel="noreferrer">
              fdc.nal.usda.gov
            </a>
            .
          </li>
        </ul>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await setSettings({ usdaApiKey: (key ?? '').trim() });
            setKey(null);
            toast.success('Clave de USDA guardada');
          }}
        >
          <input
            className="input font-mono text-sm"
            placeholder={settings.usdaApiKey ? '•••••••• (guardada)' : 'Clave de api.data.gov (opcional)'}
            value={key ?? ''}
            onChange={(e) => setKey(e.target.value)}
            aria-label="Clave de USDA"
            autoComplete="off"
          />
          <button className="btn-secondary shrink-0" disabled={key === null}>
            Guardar
          </button>
        </form>
      </section>

      <SyncSection />
      <DataSection />

      <section className="card p-5 text-sm text-ink-600">
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-ink-900">
          <Info className="h-4 w-4" /> Acerca de Nutri AI
        </h2>
        <p>Versión {APP_VERSION}. Software libre, sin publicidad ni suscripciones.</p>
        <p className="mt-2">
          Datos: USDA FoodData Central (dominio público), Open Food Facts (ODbL). IA: MobileCLIP (Apple) / CLIP (OpenAI) mediante Transformers.js (Hugging Face).
        </p>
        <p className="mt-2 text-xs text-ink-400">
          Nutri AI ofrece estimaciones orientativas y no sustituye el consejo de profesionales de la salud o la nutrición.
        </p>
      </section>
    </div>
  );
}

function NavRow({ to, icon: Icon, title, text }: { to: string; icon: typeof Lock; title: string; text: string }) {
  return (
    <Link to={to} className="card flex items-center gap-3 p-4 hover:ring-brand-200">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-800">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-ink-500">{text}</div>
      </div>
      <ChevronRight className="h-5 w-5 text-ink-300" />
    </Link>
  );
}
