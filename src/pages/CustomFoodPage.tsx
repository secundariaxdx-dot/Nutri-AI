import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { itemFromFood } from '@/ai/analyze';
import { PREPARATION_LABEL } from '@/config/app';
import { GROUP_LABELS, NUTRIENTS, type NutrientGroup } from '@/config/nutrients';
import { saveCustomFood } from '@/db/customFoods';
import { useDraftParams } from '@/hooks/useDraftParams';
import { newDraft, setPendingDraft, takePendingDraft } from '@/store/draft';
import type { NutrientKey, Nutrients, Preparation } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { NumberInput } from '@/components/ui/NumberInput';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';

/** Crear un alimento propio (p. ej. desde la etiqueta de un producto). */
export default function CustomFoodPage() {
  const [params] = useSearchParams();
  const { date, mealType } = useDraftParams();
  const barcode = params.get('codigo')?.replace(/\D/g, '') || undefined;
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(params.get('nombre') ?? '');
  const [brand, setBrand] = useState('');
  const [prep, setPrep] = useState<Preparation | ''>('');
  const [basis, setBasis] = useState<'100' | 'serving'>('100');
  const [serving, setServing] = useState<number | undefined>(undefined);
  const [values, setValues] = useState<Nutrients>({});
  const [showMicros, setShowMicros] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = (k: NutrientKey, v: number | undefined) => setValues((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Escribe el nombre del alimento';
    if (values.kcal === undefined) e.kcal = 'Las calorías son obligatorias';
    if (basis === 'serving' && !(serving && serving > 0)) e.serving = 'Indica cuántos gramos tiene la ración';
    const factor = basis === 'serving' && serving ? 100 / serving : 1;
    const macroSum = ((values.protein ?? 0) + (values.carbs ?? 0) + (values.fat ?? 0)) * factor;
    if (macroSum > 101) e.macros = 'Proteínas + carbohidratos + grasas no pueden superar 100 g por cada 100 g';
    if ((values.saturatedFat ?? 0) > (values.fat ?? Infinity)) e.saturatedFat = 'Las grasas saturadas no pueden superar las grasas totales';
    if ((values.sugars ?? 0) > (values.carbs ?? Infinity)) e.sugars = 'Los azúcares no pueden superar los carbohidratos';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const factor = basis === 'serving' && serving ? 100 / serving : 1;
      const per100: Nutrients = {};
      for (const [k, v] of Object.entries(values)) if (typeof v === 'number') per100[k as NutrientKey] = Math.round(v * factor * 1000) / 1000;
      const food = await saveCustomFood({
        name,
        brand: brand.trim() || undefined,
        category: barcode ? 'envasado' : 'personalizado',
        preparation: prep || undefined,
        portion: basis === 'serving' && serving ? serving : 100,
        barcode,
        source: { kind: 'custom', note: barcode ? `Etiqueta del producto (código ${barcode})` : 'Valores introducidos por el usuario' },
        nutrients: per100,
      });
      toast.success('Alimento guardado en «Mis alimentos»');
      // Si veníamos de registrar una comida, se añade directamente.
      const pending = takePendingDraft();
      if (pending || barcode) {
        const draft = pending ?? newDraft({ ...(date ? { date } : {}), ...(mealType ? { mealType } : {}), origin: 'codigo' });
        setPendingDraft({ ...draft, items: [...draft.items, itemFromFood(food, food.portion ?? 100)] });
        if (pending?.id) navigate(`/comida/${pending.id}`, { replace: true });
        else if (pending?.origin === 'foto') navigate('/foto', { replace: true });
        else navigate('/registrar', { replace: true });
      } else navigate(-1);
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  };

  const groups: NutrientGroup[] = ['minerales', 'vitaminas'];
  const field = (k: NutrientKey, required = false) => {
    const def = NUTRIENTS.find((n) => n.key === k)!;
    return (
      <div key={k}>
        <label className="label" htmlFor={`n-${k}`}>
          {def.label}
          {required && <span className="text-red-600"> *</span>}
        </label>
        <NumberInput id={`n-${k}`} value={values[k]} onChange={(v) => set(k, v)} min={0} max={k === 'kcal' ? 1000 : 100000} suffix={def.unit} placeholder="Sin datos" />
        {errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>}
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Nuevo alimento" subtitle={barcode ? `Código ${barcode}` : 'Introduce los datos de la etiqueta'} back />
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <section className="card space-y-4 p-5">
          <div>
            <label className="label" htmlFor="name">
              Nombre <span className="text-red-600">*</span>
            </label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Ej.: Yogur griego natural" />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="brand">
                Marca (opcional)
              </label>
              <input id="brand" className="input" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={60} />
            </div>
            <div>
              <label className="label" htmlFor="prep">
                Preparación
              </label>
              <select id="prep" className="input" value={prep} onChange={(e) => setPrep(e.target.value as Preparation | '')}>
                <option value="">Sin especificar</option>
                {Object.entries(PREPARATION_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Información nutricional</h2>
            <Segmented
              label="Valores expresados"
              value={basis}
              onChange={setBasis}
              options={[
                { value: '100', label: 'Por 100 g' },
                { value: 'serving', label: 'Por ración' },
              ]}
            />
          </div>
          {basis === 'serving' && (
            <div>
              <label className="label" htmlFor="serving">
                Gramos por ración <span className="text-red-600">*</span>
              </label>
              <NumberInput id="serving" value={serving} onChange={setServing} min={1} max={2000} suffix="g" />
              {errors.serving && <p className="mt-1 text-xs text-red-600">{errors.serving}</p>}
              <p className="mt-1 text-xs text-ink-500">Se convertirá automáticamente a valores por 100 g.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {field('kcal', true)}
            {field('protein')}
            {field('carbs')}
            {field('sugars')}
            {field('fat')}
            {field('saturatedFat')}
            {field('fiber')}
            {field('sodium')}
          </div>
          {errors.macros && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{errors.macros}</p>}
          <p className="text-xs text-ink-500">Deja vacío lo que no aparezca en la etiqueta: se mostrará como «Sin datos». Si la etiqueta indica sal, el sodio es sal ÷ 2,5 (en mg: × 400).</p>
          <button type="button" className="text-sm font-medium text-brand-700" onClick={() => setShowMicros((s) => !s)} aria-expanded={showMicros}>
            {showMicros ? 'Ocultar' : 'Añadir'} vitaminas y minerales
          </button>
          {showMicros &&
            groups.map((g) => (
              <div key={g}>
                <h3 className="section-title mb-3">{GROUP_LABELS[g]}</h3>
                <div className="grid grid-cols-2 gap-4">{NUTRIENTS.filter((n) => n.group === g && n.key !== 'sodium').map((n) => field(n.key))}</div>
              </div>
            ))}
        </section>

        <button className="btn-primary w-full py-4" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar alimento'}
        </button>
      </form>
    </div>
  );
}
