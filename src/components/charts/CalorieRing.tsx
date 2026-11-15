import { formatKcal } from '@/lib/format';
import { ProgressRing } from '@/components/ui/ProgressRing';

export function CalorieSummary({ consumed, goal }: { consumed: number; goal: number }) {
  const remaining = goal - consumed;
  const pct = goal ? consumed / goal : 0;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
      <ProgressRing value={pct} size={188} stroke={16} label={`${Math.round(pct * 100)} % del objetivo de calorías`}>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{remaining >= 0 ? 'Restantes' : 'Exceso'}</span>
        <span className="text-4xl font-bold tabular-nums tracking-tight text-brand-950">{formatKcal(Math.abs(remaining))}</span>
        <span className="text-xs font-medium text-ink-500">kcal</span>
      </ProgressRing>
      <dl className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:grid-cols-1 sm:gap-3">
        <Stat label="Consumidas" value={formatKcal(consumed)} unit="kcal" />
        <Stat label="Objetivo" value={formatKcal(goal)} unit="kcal" />
        <Stat label="Completado" value={`${Math.round(pct * 100)}`} unit="%" highlight={pct > 1.05} />
      </dl>
    </div>
  );
}

function Stat({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl bg-ink-50 px-3 py-2.5 text-center sm:min-w-[150px] sm:text-left">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className={`text-lg font-bold tabular-nums ${highlight ? 'text-amber-600' : 'text-ink-900'}`}>
        {value} <span className="text-xs font-medium text-ink-400">{unit}</span>
      </dd>
    </div>
  );
}
