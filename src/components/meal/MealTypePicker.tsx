import { MEAL_TYPES } from '@/config/app';
import type { MealType } from '@/types';

export function MealTypePicker({ value, onChange }: { value: MealType; onChange: (v: MealType) => void }) {
  return (
    <div role="radiogroup" aria-label="Tipo de comida" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {MEAL_TYPES.map((m) => (
        <button
          key={m.value}
          role="radio"
          aria-checked={value === m.value}
          onClick={() => onChange(m.value)}
          className={`chip shrink-0 px-3.5 py-2 text-sm transition ${
            value === m.value ? 'bg-brand-900 text-white shadow-sm' : 'bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50'
          }`}
        >
          <span aria-hidden>{m.emoji}</span> {m.label}
        </button>
      ))}
    </div>
  );
}
