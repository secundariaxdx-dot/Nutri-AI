import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, ChevronRight, PackagePlus, PenLine, Repeat, ScanBarcode } from 'lucide-react';
import { db } from '@/db/database';
import { duplicateMeal } from '@/db/meals';
import { useDraftParams } from '@/hooks/useDraftParams';
import { MEAL_TYPE_LABEL } from '@/config/app';
import { formatDateShort, todayKey } from '@/lib/dates';
import { formatKcal } from '@/lib/format';
import { kcalOf } from '@/lib/nutrition';
import type { Meal } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { MealPhoto } from '@/components/ui/MealPhoto';
import { useToast } from '@/components/ui/Toast';

export default function AddHubPage() {
  const { date, mealType, query } = useDraftParams();
  const toast = useToast();
  const recent = useLiveQuery(async () => {
    const all = await db.meals.orderBy('updatedAt').reverse().limit(60).toArray();
    const seen = new Set<string>();
    const out: Meal[] = [];
    for (const m of all) {
      if (m.deleted || seen.has(m.name)) continue;
      seen.add(m.name);
      out.push(m);
      if (out.length >= 5) break;
    }
    return out;
  }, []);

  const options = [
    { to: `/foto${query}`, icon: Camera, title: 'Fotografiar comida', text: 'La IA identifica los alimentos y estima las cantidades', primary: true },
    { to: `/registrar${query}`, icon: PenLine, title: 'Añadir manualmente', text: 'Busca entre cientos de alimentos o en Open Food Facts y USDA' },
    { to: `/escaner${query}`, icon: ScanBarcode, title: 'Escanear código de barras', text: 'Productos envasados con datos de Open Food Facts' },
    { to: '/alimento/nuevo', icon: PackagePlus, title: 'Crear alimento personalizado', text: 'Introduce los valores nutricionales de la etiqueta' },
  ];

  const repeat = async (m: Meal) => {
    const copy = await duplicateMeal(m.id, date ?? todayKey());
    if (mealType && mealType !== copy.mealType) await db.meals.update(copy.id, { mealType });
    toast.success(`«${m.name}» añadida a ${date && date !== todayKey() ? formatDateShort(date) : 'hoy'}`);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Registrar comida"
        back
        subtitle={date || mealType ? `${mealType ? MEAL_TYPE_LABEL[mealType] : 'Comida'}${date ? ` · ${formatDateShort(date)}` : ''}` : '¿Cómo quieres añadirla?'}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map(({ to, icon: Icon, title, text, primary }) => (
          <Link
            key={title}
            to={to}
            className={`flex items-center gap-4 rounded-3xl p-5 transition active:scale-[.99] ${
              primary ? 'bg-gradient-to-br from-brand-800 to-brand-950 text-white shadow-lift sm:col-span-2' : 'card hover:ring-brand-200'
            }`}
          >
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${primary ? 'bg-white/15' : 'bg-brand-50 text-brand-800'}`}>
              <Icon className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{title}</span>
              <span className={`mt-0.5 block text-sm ${primary ? 'text-white/75' : 'text-ink-500'}`}>{text}</span>
            </span>
            <ChevronRight className={`h-5 w-5 shrink-0 ${primary ? 'text-white/60' : 'text-ink-300'}`} />
          </Link>
        ))}
      </div>

      {recent && recent.length > 0 && (
        <section className="mt-8">
          <h2 className="section-title mb-3 flex items-center gap-2">
            <Repeat className="h-4 w-4" /> Repetir una comida reciente
          </h2>
          <ul className="card divide-y divide-ink-100 p-2">
            {recent.map((m) => (
              <li key={m.id} className="flex items-center gap-3 p-2">
                <MealPhoto blob={m.thumb} alt="" className="h-11 w-11" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{m.name}</div>
                  <div className="text-xs text-ink-400">
                    {MEAL_TYPE_LABEL[m.mealType]} · {formatKcal(kcalOf(m.items))} kcal
                  </div>
                </div>
                <button className="btn-secondary px-3 py-2 text-sm" onClick={() => repeat(m)}>
                  Añadir
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
