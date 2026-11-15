import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatKcal, formatNumber } from '@/lib/format';
import { macroEnergySplit, type NutrientTotals } from '@/lib/nutrition';
import { NutrientTable } from './NutrientTable';

export function TotalsCard({ totals, title = 'Total de la comida', defaultOpen = false }: { totals: NutrientTotals; title?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const v = totals.values;
  const split = macroEnergySplit(v);
  const macros = [
    { label: 'Proteínas', value: v.protein, color: 'bg-protein', pct: split.protein },
    { label: 'Carbohidratos', value: v.carbs, color: 'bg-carbs', pct: split.carbs },
    { label: 'Grasas', value: v.fat, color: 'bg-fat', pct: split.fat },
  ];
  return (
    <section className="card p-5">
      <div className="flex items-end justify-between">
        <div>
          <h3 className="section-title">{title}</h3>
          <div className="mt-1 text-4xl font-bold tracking-tight tabular-nums text-brand-950">
            {formatKcal(v.kcal ?? 0)}
            <span className="ml-1 text-base font-medium text-ink-500">kcal</span>
          </div>
        </div>
        {v.fiber !== undefined && (
          <div className="text-right text-sm text-ink-500">
            Fibra <span className="font-semibold text-ink-800">{formatNumber(v.fiber, 1)} g</span>
          </div>
        )}
      </div>
      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-ink-100" aria-hidden>
        {macros.map((m) => (
          <div key={m.label} className={m.color} style={{ width: `${m.pct * 100}%`, transition: 'width .6s' }} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {macros.map((m) => (
          <div key={m.label} className="rounded-2xl bg-ink-50 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-ink-500">
              <span className={`h-2 w-2 rounded-full ${m.color}`} /> {m.label}
            </div>
            <div className="mt-0.5 font-semibold tabular-nums">{m.value === undefined ? '—' : `${formatNumber(m.value, 1)} g`}</div>
          </div>
        ))}
      </div>
      <button className="mt-4 flex w-full items-center justify-between text-sm font-medium text-brand-800" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Micronutrientes y detalle completo
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-4">
          <NutrientTable values={v} totals={totals} />
        </div>
      )}
    </section>
  );
}
