import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Pencil, Plus, RotateCcw, Sparkles } from 'lucide-react';
import { saveMeal } from '@/db/meals';
import { itemFromFood } from '@/ai/analyze';
import { isValidDateKey } from '@/lib/dates';
import { itemsTotals } from '@/lib/nutrition';
import { setPendingDraft, type MealDraft } from '@/store/draft';
import type { Food, Meal, MealItem } from '@/types';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/Spinner';
import { FoodPicker } from './FoodPicker';
import { MealItemRow } from './MealItemRow';
import { MealTypePicker } from './MealTypePicker';
import { TotalsCard } from './TotalsCard';

interface Props {
  initial: MealDraft;
  /** "review": resumen del análisis; "edit": edición completa. */
  initialMode?: 'review' | 'edit';
  header?: ReactNode;
  onReanalyze?: () => void;
  onSaved: (meal: Meal) => void;
  /** Abre el buscador nada más montar (registro manual). */
  openPickerOnMount?: boolean;
  saveLabel?: string;
  /** Alimentos que la pantalla contenedora quiere añadir (p. ej. sugerencias de la IA). */
  appendRequest?: { id: number; items: MealItem[] };
}

/**
 * Editor de comidas compartido por todos los flujos (foto, manual, código de
 * barras y edición). Recalcula los nutrientes en cada cambio.
 */
export function MealComposer({ initial, initialMode = 'edit', header, onReanalyze, onSaved, openPickerOnMount, saveLabel = 'Guardar en mi diario', appendRequest }: Props) {
  const [draft, setDraft] = useState<MealDraft>(initial);
  const [mode, setMode] = useState(initialMode);
  const [picker, setPicker] = useState(!!openPickerOnMount);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const latest = useRef(draft);
  const done = useRef(false);
  latest.current = draft;

  // Si el usuario sale (p. ej. para crear un alimento) se conserva el borrador.
  useEffect(
    () => () => {
      if (!done.current && latest.current.items.length > 0) setPendingDraft(latest.current);
    },
    [],
  );

  useEffect(() => {
    if (appendRequest?.items.length) setDraft((d) => ({ ...d, items: [...d.items, ...appendRequest.items] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appendRequest?.id]);

  const totals = useMemo(() => itemsTotals(draft.items), [draft.items]);

  const updateItem = useCallback((id: string, patch: Partial<MealItem>) => {
    setDraft((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch, ...(patch.grams ? { lowConfidence: false } : {}) } : i)) }));
  }, []);

  const removeItem = useCallback((id: string) => {
    setDraft((d) => {
      const removed = d.items.find((i) => i.id === id);
      const items = d.items.filter((i) => i.id !== id);
      if (removed) {
        toast.show(`«${removed.name}» eliminado`, 'info', {
          action: { label: 'Deshacer', onClick: () => setDraft((dd) => ({ ...dd, items: [...dd.items, removed] })) },
        });
      }
      return { ...d, items };
    });
  }, [toast]);

  const addFood = (food: Food, grams: number) => {
    setDraft((d) => ({ ...d, items: [...d.items, itemFromFood(food, grams)] }));
    toast.success(`${food.name} añadido`);
  };

  const save = async () => {
    if (!draft.items.length) return toast.error('Añade al menos un alimento antes de guardar.');
    if (!isValidDateKey(draft.date)) return toast.error('La fecha no es válida.');
    const estimated = draft.items.filter((i) => i.estimated);
    if (estimated.length > 0 && !draft.id) {
      const ok = await confirm({
        title: '¿Confirmas las cantidades?',
        message: `${estimated.length === 1 ? 'Un alimento tiene' : `${estimated.length} alimentos tienen`} una cantidad estimada a partir de la foto. Una imagen no permite conocer el peso exacto: revisa los gramos si puedes.`,
        confirmLabel: 'Guardar así',
        cancelLabel: 'Revisar',
      });
      if (!ok) {
        setMode('edit');
        return;
      }
    }
    setSaving(true);
    try {
      const meal = await saveMeal({
        id: draft.id,
        date: draft.date,
        mealType: draft.mealType,
        time: draft.time,
        name: draft.name,
        notes: draft.notes?.trim() || undefined,
        items: draft.items.map(({ ...i }) => {
          delete (i as { lowConfidence?: boolean }).lowConfidence;
          return i;
        }),
        photo: draft.photo,
        thumb: draft.thumb,
        photoPath: draft.photoPath,
        origin: draft.origin,
      });
      done.current = true;
      setPendingDraft(null);
      setSaved(true);
      setTimeout(() => onSaved(meal), 650);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la comida.');
      setSaving(false);
    }
  };

  const editing = mode === 'edit';

  return (
    <div className="space-y-5">
      {header}

      {mode === 'review' && draft.items.length > 0 && (
        <div className="flex items-start gap-3 rounded-3xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-100">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p>
            <strong>Las cantidades son estimaciones.</strong> Se han propuesto raciones orientativas según lo que ocupa cada alimento en la foto.
            Pulsa «Editar alimentos» para ajustar los gramos, añadir o quitar alimentos.
          </p>
        </div>
      )}

      <section className="space-y-3">
        <MealTypePicker value={draft.mealType} onChange={(mealType) => setDraft((d) => ({ ...d, mealType }))} />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Fecha</span>
            <input type="date" className="input" value={draft.date} onChange={(e) => e.target.value && setDraft((d) => ({ ...d, date: e.target.value }))} required />
          </label>
          <label className="block">
            <span className="label">Hora</span>
            <input type="time" className="input" value={draft.time} onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value || d.time }))} />
          </label>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Alimentos <span className="text-ink-400">({draft.items.length})</span>
          </h2>
          {mode === 'review' && (
            <button className="btn-ghost px-3 py-2 text-sm" onClick={() => setMode('edit')}>
              <Pencil className="h-4 w-4" /> Editar
            </button>
          )}
        </div>
        {draft.items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
            Todavía no hay alimentos en esta comida.
          </div>
        ) : (
          <ul className="space-y-3">
            {draft.items.map((it) => (
              <MealItemRow key={it.id} item={it} editable={editing} onChange={(p) => updateItem(it.id, p)} onRemove={() => removeItem(it.id)} />
            ))}
          </ul>
        )}
        {editing && (
          <button className="btn-secondary mt-3 w-full border border-dashed border-brand-200" onClick={() => setPicker(true)}>
            <Plus className="h-5 w-5" /> Añadir alimento
          </button>
        )}
      </section>

      {draft.items.length > 0 && <TotalsCard totals={totals} />}

      {editing && (
        <section className="space-y-3">
          <label className="block">
            <span className="label">Nombre de la comida (opcional)</span>
            <input className="input" value={draft.name} maxLength={80} placeholder="Se genera automáticamente" onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </label>
          <label className="block">
            <span className="label">Notas (opcional)</span>
            <textarea className="input min-h-[80px]" maxLength={500} value={draft.notes ?? ''} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
          </label>
        </section>
      )}

      <div className="sticky bottom-0 z-20 -mx-4 space-y-2 bg-gradient-to-t from-canvas via-canvas to-canvas/0 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-6 sm:-mx-6 sm:px-6">
        <button className="btn-primary w-full py-4 text-base uppercase tracking-wide" onClick={save} disabled={saving || draft.items.length === 0}>
          {saved ? (
            <span className="flex animate-pop items-center gap-2">
              <Check className="h-5 w-5" /> ¡Guardado!
            </span>
          ) : saving ? (
            <>
              <Spinner /> Guardando…
            </>
          ) : (
            saveLabel
          )}
        </button>
        {(onReanalyze || mode === 'review') && (
          <div className="grid grid-cols-2 gap-2">
            {onReanalyze && (
              <button className="btn-ghost bg-white text-sm uppercase ring-1 ring-ink-200" onClick={onReanalyze} disabled={saving}>
                <RotateCcw className="h-4 w-4" /> Volver a analizar
              </button>
            )}
            <button
              className={`btn-ghost bg-white text-sm uppercase ring-1 ring-ink-200 ${onReanalyze ? '' : 'col-span-2'}`}
              onClick={() => setMode(editing ? 'review' : 'edit')}
              disabled={saving}
              aria-pressed={editing}
            >
              <Pencil className="h-4 w-4" /> {editing ? 'Ver resumen' : 'Editar alimentos'}
            </button>
          </div>
        )}
      </div>

      <FoodPicker open={picker} onClose={() => setPicker(false)} onPick={addFood} />
    </div>
  );
}
