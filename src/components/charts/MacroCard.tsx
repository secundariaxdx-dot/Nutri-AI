import { formatNumber } from '@/lib/format';
import { ProgressBar } from '@/components/ui/ProgressBar';

const SHORT: Record<string, string> = { Carbohidratos: 'Carbos' };

export function MacroCard({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = goal ? value / goal : 0;
  return (
    <div className="card p-3.5 sm:p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-600 sm:text-sm">
        <span className="h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5" style={{ background: color }} aria-hidden />
        <span className="sm:hidden">{SHORT[label] ?? label}</span>
        <span className="hidden sm:inline">{label}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1">
        <span className="text-xl font-bold tabular-nums text-ink-900 sm:text-2xl">{formatNumber(value, 0)}</span>
        <span className="text-xs text-ink-400 sm:text-sm">/ {formatNumber(goal, 0)} g</span>
      </div>
      <ProgressBar value={pct} color={color} className="mt-2.5" label={`${label}: ${Math.round(pct * 100)} %`} />
      <div className="mt-1.5 text-[11px] tabular-nums text-ink-500 sm:text-xs">{Math.round(pct * 100)} %<span className="hidden sm:inline"> del objetivo</span></div>
    </div>
  );
}
