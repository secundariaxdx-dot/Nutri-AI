import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { MEAL_TYPES } from '@/config/app';
import { formatKcal } from '@/lib/format';
import { mealsTotals } from '@/lib/nutrition';
import type { Meal } from '@/types';
import { MealCard } from './MealCard';

/** Comidas del día agrupadas por momento (desayuno, comida…). */
export function MealsByType({ meals, date }: { meals: Meal[]; date: string }) {
  return (
    <div className="space-y-3">
      {MEAL_TYPES.map((t) => {
        const list = meals.filter((m) => m.mealType === t.value);
        const kcal = mealsTotals(list).values.kcal ?? 0;
        return (
          <section key={t.value} className="card p-3" aria-label={t.label}>
            <div className="flex items-center justify-between px-2 py-1">
              <h3 className="flex items-center gap-2 font-semibold text-ink-800">
                <span aria-hidden>{t.emoji}</span> {t.label}
              </h3>
              <div className="flex items-center gap-2">
                {list.length > 0 && <span className="text-sm tabular-nums text-ink-500">{formatKcal(kcal)} kcal</span>}
                <Link
                  to={`/anadir?fecha=${date}&tipo=${t.value}`}
                  aria-label={`Añadir a ${t.label}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-800 hover:bg-brand-100"
                >
                  <Plus className="h-4 w-4" />
                </Link>
              </div>
            </div>
            {list.length > 0 ? (
              <div className="mt-1 divide-y divide-ink-100">{list.map((m) => <MealCard key={m.id} meal={m} />)}</div>
            ) : (
              <p className="px-2 pb-1 text-sm text-ink-400">Sin registros</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
