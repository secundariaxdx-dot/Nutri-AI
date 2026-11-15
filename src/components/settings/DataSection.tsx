import { useRef, useState } from 'react';
import { Database, Download, Trash2, Upload } from 'lucide-react';
import { createBackup, downloadJson, importBackup, parseBackup, wipeAllData } from '@/db/backup';
import { todayKey } from '@/lib/dates';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { Toggle } from './SyncSection';

export function DataSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const [photos, setPhotos] = useState(true);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const exportData = async () => {
    setBusy(true);
    try {
      const backup = await createBackup(photos);
      downloadJson(backup, `nutri-ai-copia-${todayKey()}.json`);
      toast.success(`Copia exportada (${backup.meals.length} comidas)`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onImport = async (f: File) => {
    setBusy(true);
    try {
      const backup = parseBackup(await f.text());
      const replace = await confirm({
        title: `Importar ${backup.meals.length} comidas`,
        message: '«Combinar» conserva tus datos y añade/actualiza los de la copia. «Reemplazar» borra antes los datos actuales.',
        confirmLabel: 'Combinar',
        cancelLabel: 'Más opciones',
      });
      let mode: 'merge' | 'replace' | null = replace ? 'merge' : null;
      if (!mode) {
        const ok = await confirm({ title: '¿Reemplazar todos tus datos?', message: 'Se eliminarán las comidas actuales y se sustituirán por las de la copia.', confirmLabel: 'Reemplazar', danger: true });
        mode = ok ? 'replace' : null;
      }
      if (!mode) return;
      const r = await importBackup(backup, mode);
      toast.success(`Importación completada: ${r.added} nuevas, ${r.updated} actualizadas, ${r.skipped} sin cambios`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const wipe = async () => {
    const ok = await confirm({ title: '¿Borrar todos los datos?', message: 'Se eliminarán comidas, perfil, alimentos personalizados y ajustes de este dispositivo. No se puede deshacer.', confirmLabel: 'Continuar', danger: true });
    if (!ok) return;
    const ok2 = await confirm({ title: 'Última confirmación', message: 'Te recomendamos exportar una copia antes. ¿Borrar definitivamente?', confirmLabel: 'Borrar todo', danger: true });
    if (!ok2) return;
    await wipeAllData();
    toast.success('Todos los datos locales se han eliminado');
  };

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-800">
          <Database className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold">Tus datos</h2>
          <p className="text-sm text-ink-500">Se guardan en este navegador (IndexedDB). Exporta copias periódicamente.</p>
        </div>
      </div>
      <Toggle label="Incluir fotos en la copia" hint="El archivo será más grande" checked={photos} onChange={setPhotos} />
      <div className="grid gap-2 sm:grid-cols-2">
        <button className="btn-secondary" onClick={exportData} disabled={busy}>
          <Download className="h-4 w-4" /> Exportar copia (JSON)
        </button>
        <button className="btn-secondary" onClick={() => file.current?.click()} disabled={busy}>
          <Upload className="h-4 w-4" /> Importar copia
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onImport(f);
        }}
      />
      <button className="btn-danger w-full" onClick={wipe}>
        <Trash2 className="h-4 w-4" /> Borrar todos los datos
      </button>
    </section>
  );
}
