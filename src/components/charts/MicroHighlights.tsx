import { Link } from 'react-router-dom';
import { NUTRIENT_MAP } from '@/config/nutrients';
import { formatNutrient } from '@/lib/format';
import type { NutrientTotals } from '@/lib/nutrition';
import type { NutrientKey } from '@/types';
import { ProgressBar } from '@/components/ui/ProgressBar';

const KEYS: NutrientKey[] = ['fiber', 'sodium', 'calcium', 'iron', 'potassium', 'vitaminC'];

/** Resumen compacto de fibra y micronutrientes clave del día. */
export function MicroHighlights({ totals, fiberGoal, hasMeals }: { totals: NutrientTotals; fiberGoal: number; hasMeals: boolean }) {
  if (!hasMeals) return null;
  return (
    <section className="card p-5" aria-label="Micronutrientes">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Fibra y micronutrientes</h2>
        <Link to="/diario" className="text-sm font-medium text-brand-700">
          Ver todos
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
        {KEYS.map((k) => {
          const def = NUTRIENT_MAP[k];
          const ref = k === 'fiber' ? fiberGoal : def.reference ?? 1;
          const v = totals.values[k];
          return (
            <div key={k}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-medium text-ink-600">{def.short ?? def.label}</span>
                <span className={`tabular-nums ${v === undefined ? 'italic text-ink-400' : 'text-ink-800'}`}>
                  {formatNutrient(k, v)}
                  {totals.partial.has(k) && '*'}
                </span>
              </div>
              <ProgressBar value={(v ?? 0) / ref} color={def.isLimit ? '#98a39a' : '#2d9a62'} className="mt-1.5 h-1.5" label={def.label} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
