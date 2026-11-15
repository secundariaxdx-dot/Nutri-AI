import { useMemo, useState } from 'react';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { PREPARATION_LABEL } from '@/config/app';
import { formatKcal } from '@/lib/format';
import { roundGrams, scaleNutrients } from '@/lib/nutrition';
import type { Food } from '@/types';
import { NumberInput } from '@/components/ui/NumberInput';
import { MacroPills } from './MacroPills';
import { NutrientTable } from './NutrientTable';
import { SourceBadge, sourceDetail, sourceUrl } from './SourceBadge';

interface Props {
  food: Food;
  initialGrams?: number;
  onBack?: () => void;
  onConfirm: (grams: number) => void;
  confirmLabel?: string;
  /** Acción secundaria opcional (p. ej. «Combinar con otros alimentos»). */
  secondaryLabel?: string;
  onSecondary?: (grams: number) => void;
  busy?: boolean;
}

/** Paso de selección de cantidad con previsualización de nutrientes. */
export function AmountStep({ food, initialGrams, onBack, onConfirm, confirmLabel = 'Añadir', secondaryLabel, onSecondary, busy }: Props) {
  const portion = food.portion ?? 100;
  const [grams, setGrams] = useState<number | undefined>(initialGrams ?? portion);
  const [showMicros, setShowMicros] = useState(false);
  const n = useMemo(() => scaleNutrients(food.nutrients, grams ?? 0), [food, grams]);
  const presets = [...new Set([roundGrams(portion / 2), portion, 100, roundGrams(portion * 1.5), roundGrams(portion * 2)])].sort((a, b) => a - b);
  const valid = grams !== undefined && grams > 0 && grams <= 5000;
  const url = sourceUrl(food.source);

  return (
    <div className="animate-fade-in">
      {onBack && (
        <button onClick={onBack} className="-ml-1 mb-2 flex items-center gap-1 text-sm font-medium text-brand-700">
          <ChevronLeft className="h-4 w-4" /> Volver a la búsqueda
        </button>
      )}
      <div className="flex items-start gap-3">
        {food.imageUrl && <img src={food.imageUrl} alt="" className="h-16 w-16 rounded-2xl bg-ink-50 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />}
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-snug">{food.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {food.brand && <span className="chip bg-ink-100 text-ink-600">{food.brand}</span>}
            {food.preparation && <span className="chip bg-brand-50 text-brand-800">{PREPARATION_LABEL[food.preparation]}</span>}
            <SourceBadge source={food.source} />
          </div>
        </div>
      </div>

      <label htmlFor="grams" className="label mt-5">
        Cantidad
      </label>
      <NumberInput id="grams" value={grams} onChange={setGrams} min={1} max={5000} suffix="g" allowEmpty />
      <div className="no-scrollbar -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => setGrams(p)}
            className={`chip shrink-0 px-3 py-1.5 text-sm ${grams === p ? 'bg-brand-900 text-white' : 'bg-ink-100 text-ink-700'}`}
          >
            {p} g{p === portion && food.portion ? ' · ración' : ''}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-3xl bg-brand-50/70 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink-600">Energía</span>
          <span className="text-2xl font-bold tabular-nums text-brand-950">
            {formatKcal(n.kcal)} <span className="text-sm font-medium text-ink-500">kcal</span>
          </span>
        </div>
        <MacroPills n={n} className="mt-2" />
        <p className="mt-2 text-xs text-ink-500">
          Por 100 g: {formatKcal(food.nutrients.kcal)} kcal · valores calculados proporcionalmente ({grams ?? 0} g = {Math.round(((grams ?? 0) / 100) * 100)} % de 100 g).
        </p>
      </div>

      <button className="mt-3 text-sm font-medium text-brand-700" onClick={() => setShowMicros((v) => !v)} aria-expanded={showMicros}>
        {showMicros ? 'Ocultar' : 'Ver'} todos los nutrientes
      </button>
      {showMicros && (
        <div className="mt-3">
          <NutrientTable values={n} compact />
        </div>
      )}

      {food.ingredients && (
        <details className="mt-4 rounded-2xl bg-ink-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-ink-700">Ingredientes</summary>
          <p className="mt-2 text-ink-600">{food.ingredients}</p>
        </details>
      )}
      {food.allergens && food.allergens.length > 0 && (
        <p className="mt-3 text-sm">
          <span className="font-medium text-red-700">Alérgenos: </span>
          {food.allergens.join(', ')}
        </p>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-ink-400">
        Fuente: {sourceDetail(food.source)}
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-brand-700 underline">
            ver ficha <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </p>

      <button className="btn-primary mt-5 w-full" disabled={!valid || busy} onClick={() => valid && onConfirm(grams!)}>
        {confirmLabel}
      </button>
      {secondaryLabel && onSecondary && (
        <button className="btn-ghost mt-2 w-full" disabled={!valid || busy} onClick={() => valid && onSecondary(grams!)}>
          {secondaryLabel}
        </button>
      )}
    </div>
  );
}
