import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getDatesWithMeals } from '@/db/meals';
import { formatMonth, fromDateKey, toDateKey, todayKey } from '@/lib/dates';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Calendario mensual que marca los días con comidas registradas. */
export function Calendar({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const [month, setMonth] = useState(() => {
    const d = fromDateKey(value);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const first = toDateKey(month);
  const last = toDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const withMeals = useLiveQuery(() => getDatesWithMeals(first, last), [first, last]) ?? new Set<string>();
  const today = todayKey();

  const cells = useMemo(() => {
    const offset = (month.getDay() + 6) % 7; // lunes = 0
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= days; d++) out.push(toDateKey(new Date(month.getFullYear(), month.getMonth(), d)));
    return out;
  }, [month]);

  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button aria-label="Mes anterior" className="rounded-full p-2 hover:bg-ink-100" onClick={() => shift(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-semibold">{formatMonth(month)}</span>
        <button aria-label="Mes siguiente" className="rounded-full p-2 hover:bg-ink-100" onClick={() => shift(1)}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink-400">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid">
        {cells.map((key, i) =>
          key ? (
            <button
              key={key}
              onClick={() => onChange(key)}
              aria-label={key}
              aria-current={key === value ? 'date' : undefined}
              className={`relative flex aspect-square items-center justify-center rounded-xl text-sm tabular-nums transition ${
                key === value ? 'bg-brand-900 font-semibold text-white' : key === today ? 'bg-brand-50 font-semibold text-brand-900' : 'hover:bg-ink-100'
              }`}
            >
              {Number(key.slice(8))}
              {withMeals.has(key) && <span className={`absolute bottom-1.5 h-1 w-1 rounded-full ${key === value ? 'bg-brand-300' : 'bg-brand-500'}`} />}
            </button>
          ) : (
            <div key={`e${i}`} />
          ),
        )}
      </div>
      <button className="btn-ghost mt-3 w-full text-sm" onClick={() => onChange(today)}>
        Ir a hoy
      </button>
    </div>
  );
}
