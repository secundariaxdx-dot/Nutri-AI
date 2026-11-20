import { memo, useState } from 'react';
import { AlertTriangle, ChevronDown, HelpCircle, Minus, Plus, Sparkles, Trash2 } from 'lucide-react';
import { variantsOf } from '@/ai/vision/variants';
import { PREPARATION_LABEL } from '@/config/app';
import { formatKcal } from '@/lib/format';
import { itemNutrients } from '@/lib/nutrition';
import type { MealItem } from '@/types';
import { NumberInput } from '@/components/ui/NumberInput';
import { MacroPills } from './MacroPills';
import { NutrientTable } from './NutrientTable';
import { SourceBadge, sourceDetail } from './SourceBadge';

interface Props {
  item: MealItem & { lowConfidence?: boolean };
  editable: boolean;
  onChange?: (patch: Partial<MealItem>) => void;
  onRemove?: () => void;
}

function stepFor(g: number) {
  return g < 30 ? 5 : g < 200 ? 10 : 25;
}

export const MealItemRow = memo(function MealItemRow({ item, editable, onChange, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const n = itemNutrients(item);
  const variants = variantsOf(item.foodId);

  return (
    <li className="animate-fade-in rounded-3xl bg-white p-4 ring-1 ring-ink-100">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-[15px] font-semibold leading-snug text-ink-900">{item.name}</h4>
            <div className="shrink-0 text-right">
              <div className="text-base font-bold tabular-nums text-ink-900">{formatKcal(n.kcal)}</div>
              <div className="-mt-0.5 text-[11px] text-ink-400">kcal</div>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {item.preparation && <span className="chip bg-brand-50 text-brand-800">{PREPARATION_LABEL[item.preparation]}</span>}
            {item.brand && <span className="chip bg-ink-100 text-ink-600">{item.brand}</span>}
            {item.estimated && (
              <span className="chip bg-amber-50 text-amber-700" title="Cantidad estimada a partir de la foto">
                <Sparkles className="h-3 w-3" /> Estimado{item.confidence !== undefined && ` · ${Math.round(item.confidence * 100)} %`}
              </span>
            )}
            {item.lowConfidence && (
              <span className="chip bg-red-50 text-red-700">
                <AlertTriangle className="h-3 w-3" /> Detección dudosa
              </span>
            )}
            {item.fromDish && <span className="chip bg-violet-50 text-violet-700">De: {item.fromDish}</span>}
            {item.preparationUnconfirmed && (
              <span className="chip bg-amber-50 text-amber-700" title="La IA no pudo distinguir cómo está cocinado">
                <HelpCircle className="h-3 w-3" /> Preparación sin confirmar
              </span>
            )}
            {item.defaultQuantity && <span className="chip bg-amber-50 text-amber-700">Cantidad por defecto</span>}
          </div>
          {item.aiName && <p className="mt-1 text-xs text-ink-400">Detectado como «{item.aiName}»</p>}
          <MacroPills n={n} className="mt-2" />
          {editable && variants.length > 1 && (
            <label className="mt-2 flex items-center gap-2 text-xs text-ink-500">
              Preparación / tipo
              <select
                className="rounded-xl border-0 bg-ink-50 py-1.5 pl-2 pr-7 text-sm text-ink-800 ring-1 ring-ink-200"
                value={item.foodId}
                aria-label={`Preparación de ${item.name}`}
                onChange={(e) => {
                  const f = variants.find((v) => v.id === e.target.value);
                  if (f) onChange?.({ foodId: f.id, name: f.name, per100g: { ...f.nutrients }, source: f.source, preparation: f.preparation, preparationUnconfirmed: false });
                }}
              >
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {editable ? (
          <>
            <button
              aria-label={`Reducir cantidad de ${item.name}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink-100 text-ink-700 active:scale-95"
              onClick={() => onChange?.({ grams: Math.max(1, item.grams - stepFor(item.grams)), estimated: false, defaultQuantity: false })}
            >
              <Minus className="h-4 w-4" />
            </button>
            <NumberInput
              value={item.grams}
              onChange={(v) => v !== undefined && v > 0 && onChange?.({ grams: v, estimated: false, defaultQuantity: false })}
              min={1}
              max={5000}
              suffix="g"
              className="w-[7.5rem]"
              ariaLabel={`Gramos de ${item.name}`}
              allowEmpty={false}
            />
            <button
              aria-label={`Aumentar cantidad de ${item.name}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink-100 text-ink-700 active:scale-95"
              onClick={() => onChange?.({ grams: item.grams + stepFor(item.grams), estimated: false, defaultQuantity: false })}
            >
              <Plus className="h-4 w-4" />
            </button>
            <div className="flex-1" />
            <button aria-label={`Eliminar ${item.name}`} className="flex h-11 w-11 items-center justify-center rounded-2xl text-red-600 hover:bg-red-50" onClick={onRemove}>
              <Trash2 className="h-5 w-5" />
            </button>
          </>
        ) : (
          <span className="rounded-xl bg-ink-50 px-3 py-1.5 text-sm font-semibold tabular-nums text-ink-800">
            {item.estimated ? '≈ ' : ''}
            {Math.round(item.grams)} g
          </span>
        )}
        <button
          className={`flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-medium text-ink-500 hover:bg-ink-50 ${editable ? '' : 'ml-auto'}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          Nutrientes <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="mt-3 border-t border-ink-100 pt-3">
          <NutrientTable values={n} compact showReference={false} />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-400">
            <SourceBadge source={item.source} /> <span>{sourceDetail(item.source)}</span>
          </div>
        </div>
      )}
    </li>
  );
});
