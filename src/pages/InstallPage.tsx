import type { ReactNode } from 'react';
import { CheckCircle2, Download, PlusSquare, Share, Smartphone } from 'lucide-react';
import { useInstall } from '@/hooks/useInstall';
import { PageHeader } from '@/components/layout/PageHeader';

export default function InstallPage() {
  const { standalone, canPrompt, prompt } = useInstall();
  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title="Instalar Nutri AI" subtitle="Úsala como una app, a pantalla completa y sin conexión" back />
      {standalone && (
        <div className="flex items-center gap-3 rounded-3xl bg-brand-50 p-4 text-sm font-medium text-brand-900">
          <CheckCircle2 className="h-5 w-5" /> Ya estás usando Nutri AI instalada.
        </div>
      )}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Smartphone className="h-5 w-5 text-brand-700" /> iPhone y iPad (Safari)
        </h2>
        <ol className="mt-4 space-y-4">
          <Step n={1} title="Abre la página en Safari">
            La instalación en iOS solo está disponible desde Safari (o Chrome/Edge en iOS 16.4+ desde el menú Compartir).
          </Step>
          <Step n={2} title="Pulsa Compartir">
            Es el icono <Share className="inline h-4 w-4" /> de la barra inferior (o superior en iPad).
          </Step>
          <Step n={3} title="Selecciona «Añadir a pantalla de inicio»">
            Desliza hacia abajo en el menú si no lo ves <PlusSquare className="inline h-4 w-4" />. Confirma con «Añadir».
          </Step>
          <Step n={4} title="Abre Nutri AI desde el icono">
            Se abrirá a pantalla completa. Tus datos se guardan en la app instalada.
          </Step>
        </ol>
        <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs text-amber-900">
          Importante: en iPhone, la app instalada y Safari tienen almacenamientos separados. Si ya registraste comidas en Safari, exporta una copia en Ajustes e
          impórtala en la app instalada.
        </p>
      </section>
      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Download className="h-5 w-5 text-brand-700" /> Android, Chrome y Edge
        </h2>
        <p className="mt-2 text-sm text-ink-600">Pulsa el botón o usa el menú del navegador › «Instalar aplicación» / «Añadir a pantalla de inicio».</p>
        <button className="btn-primary mt-4 w-full" onClick={prompt} disabled={!canPrompt}>
          {canPrompt ? 'Instalar ahora' : standalone ? 'Ya instalada' : 'Usa el menú del navegador'}
        </button>
      </section>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-900 text-sm font-bold text-white">{n}</span>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-sm text-ink-500">{children}</div>
      </div>
    </li>
  );
}
