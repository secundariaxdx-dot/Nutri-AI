import { formatNumber } from '@/lib/format';
import type { Nutrients } from '@/types';

export function MacroPills({ n, className = '' }: { n: Nutrients; className?: string }) {
  const items = [
    { k: 'P', v: n.protein, c: 'bg-protein' },
    { k: 'C', v: n.carbs, c: 'bg-carbs' },
    { k: 'G', v: n.fat, c: 'bg-fat' },
  ];
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500 ${className}`}>
      {items.map((i) => (
        <span key={i.k} className="inline-flex items-center gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${i.c}`} aria-hidden />
          <span className="sr-only">{i.k === 'P' ? 'Proteínas' : i.k === 'C' ? 'Carbohidratos' : 'Grasas'}</span>
          <span aria-hidden>{i.k}</span>
          <span className="tabular-nums text-ink-700">{i.v === undefined ? '—' : `${formatNumber(i.v, i.v >= 10 ? 0 : 1)} g`}</span>
        </span>
      ))}
    </div>
  );
}
