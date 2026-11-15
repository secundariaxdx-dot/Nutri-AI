import { GROUP_LABELS, NUTRIENTS, type NutrientGroup } from '@/config/nutrients';
import { formatNutrient } from '@/lib/format';
import type { NutrientTotals } from '@/lib/nutrition';
import type { Nutrients } from '@/types';

interface Props {
  values: Nutrients;
  totals?: Pick<NutrientTotals, 'partial'>;
  groups?: NutrientGroup[];
  showReference?: boolean;
  compact?: boolean;
}

/**
 * Tabla de nutrientes. Muestra «Sin datos» cuando la fuente no aporta un valor
 * y marca con * los totales parciales (algún alimento sin ese dato).
 */
export function NutrientTable({ values, totals, groups = ['macros', 'minerales', 'vitaminas'], showReference = true, compact }: Props) {
  return (
    <div className={compact ? 'space-y-3' : 'space-y-5'}>
      {groups.map((g) => {
        const rows = NUTRIENTS.filter((n) => n.group === g);
        return (
          <section key={g}>
            <h4 className="section-title mb-2">{GROUP_LABELS[g]}</h4>
            <dl className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-ink-50/60 ring-1 ring-ink-100">
              {rows.map((n) => {
                const v = values[n.key];
                const pct = showReference && n.reference && v !== undefined ? (v / n.reference) * 100 : undefined;
                return (
                  <div key={n.key} className={`flex items-center justify-between gap-3 px-3.5 ${compact ? 'py-1.5' : 'py-2'} text-sm`}>
                    <dt className="text-ink-600">{n.label}</dt>
                    <dd className="flex items-baseline gap-2 text-right">
                      <span className={v === undefined ? 'text-xs italic text-ink-400' : 'font-semibold tabular-nums text-ink-900'}>
                        {formatNutrient(n.key, v)}
                        {totals?.partial.has(n.key) && <span title="Datos parciales: algún alimento no tiene este dato" className="text-carbs"> *</span>}
                      </span>
                      {pct !== undefined && (
                        <span className={`w-12 text-xs tabular-nums ${n.isLimit && pct > 100 ? 'font-semibold text-amber-600' : 'text-ink-400'}`}>
                          {Math.round(pct)}%
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        );
      })}
      {showReference && (
        <p className="text-[11px] leading-relaxed text-ink-400">
          % sobre los valores de referencia de nutrientes (VRN) para adultos del Reglamento (UE) 1169/2011; sodio y grasas saturadas sobre límites
          orientativos. {totals && totals.partial.size > 0 && '* Total parcial: algún alimento no tiene datos de ese nutriente.'}
        </p>
      )}
    </div>
  );
}
