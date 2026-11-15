import { useCallback, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageSearch, ScanBarcode, WifiOff } from 'lucide-react';
import { itemFromFood } from '@/ai/analyze';
import { suggestMealType } from '@/config/app';
import { findCustomFoodByBarcode, saveCustomFood } from '@/db/customFoods';
import { saveMeal } from '@/db/meals';
import { useDraftParams } from '@/hooks/useDraftParams';
import { useOnline } from '@/hooks/useOnline';
import { timeNow, todayKey } from '@/lib/dates';
import { getProductByBarcode, isValidBarcode, type OffLookup } from '@/services/openFoodFacts';
import { newDraft, setPendingDraft } from '@/store/draft';
import type { Food, MealType } from '@/types';
import { BarcodeScanner } from '@/components/barcode/BarcodeScanner';
import { PageHeader } from '@/components/layout/PageHeader';
import { AmountStep } from '@/components/meal/AmountStep';
import { MealTypePicker } from '@/components/meal/MealTypePicker';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

type State =
  | { s: 'scan' }
  | { s: 'loading'; code: string }
  | { s: 'found'; code: string; food: Food; extra?: Omit<OffLookup, 'food'>; cachedOnly?: boolean }
  | { s: 'notfound'; code: string; incomplete?: boolean; name?: string }
  | { s: 'error'; code: string; message: string };

const NUTRISCORE_COLORS: Record<string, string> = { a: 'bg-[#038141]', b: 'bg-[#85bb2f]', c: 'bg-[#fecb02] text-ink-900', d: 'bg-[#ee8100]', e: 'bg-[#e63e11]' };

export default function BarcodePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const online = useOnline();
  const { date, mealType: paramType } = useDraftParams();
  const [state, setState] = useState<State>({ s: 'scan' });
  const [manual, setManual] = useState('');
  const [mealType, setMealType] = useState<MealType>(paramType ?? suggestMealType());
  const [saving, setSaving] = useState(false);
  const lastCode = useRef<string>();

  const lookup = useCallback(
    async (raw: string) => {
      const code = raw.replace(/\D/g, '');
      if (!code || (state.s === 'loading' && lastCode.current === code)) return;
      lastCode.current = code;
      if (!isValidBarcode(code)) {
        setState({ s: 'error', code, message: 'El código no es un EAN/UPC válido. Revisa los dígitos.' });
        return;
      }
      setState({ s: 'loading', code });
      const cached = await findCustomFoodByBarcode(code);
      if (!navigator.onLine) {
        setState(cached ? { s: 'found', code, food: cached, cachedOnly: true } : { s: 'error', code, message: 'Sin conexión. Solo se pueden consultar productos escaneados anteriormente.' });
        return;
      }
      try {
        const res = await getProductByBarcode(code);
        if (!res) {
          setState(cached ? { s: 'found', code, food: cached } : { s: 'notfound', code });
          return;
        }
        const { food, ...extra } = res;
        if (food.nutrients.kcal === undefined && !cached) {
          // Existe en Open Food Facts pero sin información nutricional: se pide al usuario.
          setState({ s: 'notfound', code, incomplete: true, name: food.name.startsWith('Producto ') ? undefined : food.name });
          return;
        }
        // Se guarda en "Mis alimentos" para tenerlo disponible sin conexión.
        const stored = cached?.source.kind === 'custom' ? cached : await saveCustomFood({ ...food, id: cached?.id ?? food.id }).catch(() => food);
        setState({ s: 'found', code, food: stored as Food, extra });
      } catch (e) {
        setState(cached ? { s: 'found', code, food: cached, cachedOnly: true } : { s: 'error', code, message: (e as Error).message });
      }
    },
    [state.s],
  );

  const onManual = (e: FormEvent) => {
    e.preventDefault();
    lookup(manual);
  };

  const addToDiary = async (food: Food, grams: number) => {
    setSaving(true);
    try {
      const meal = await saveMeal({
        date: date ?? todayKey(),
        mealType,
        time: timeNow(),
        name: food.brand ? `${food.name} (${food.brand})` : food.name,
        items: [itemFromFood(food, grams)],
        origin: 'codigo',
      });
      toast.success('Producto añadido a tu diario');
      navigate(`/diario?fecha=${meal.date}`, { replace: true });
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  };

  const combine = (food: Food, grams: number) => {
    setPendingDraft(newDraft({ ...(date ? { date } : {}), mealType, items: [itemFromFood(food, grams)], origin: 'codigo' }));
    navigate('/registrar');
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Escanear código" subtitle="Productos envasados · Open Food Facts" back />

      {(state.s === 'scan' || state.s === 'loading' || state.s === 'error') && (
        <>
          <BarcodeScanner onDetected={lookup} paused={state.s === 'loading'} />
          <form onSubmit={onManual} className="card mt-5 p-4">
            <label htmlFor="ean" className="label">
              ¿No se lee? Escribe el código
            </label>
            <div className="flex gap-2">
              <input
                id="ean"
                className="input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ej.: 8480000123456"
                value={manual}
                maxLength={14}
                onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))}
              />
              <button className="btn-primary shrink-0" disabled={manual.length < 8 || state.s === 'loading'}>
                Buscar
              </button>
            </div>
            {!online && (
              <p className="mt-3 flex items-center gap-2 text-sm text-ink-500">
                <WifiOff className="h-4 w-4" /> Sin conexión: solo productos ya escaneados.
              </p>
            )}
          </form>
          {state.s === 'loading' && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-600" role="status">
              <Spinner /> Buscando {state.code} en Open Food Facts…
            </div>
          )}
          {state.s === 'error' && (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {state.message}
            </div>
          )}
        </>
      )}

      {state.s === 'notfound' && (
        <div className="card animate-slide-up p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <PackageSearch className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">{state.incomplete ? 'Producto sin información nutricional' : 'Producto no encontrado'}</h2>
          <p className="mt-1 text-sm text-ink-500">
            {state.incomplete ? (
              <>
                {state.name ? `«${state.name}»` : 'El producto'} (código <strong className="tabular-nums">{state.code}</strong>) está en Open Food Facts pero sin valores nutricionales.
              </>
            ) : (
              <>
                El código <strong className="tabular-nums">{state.code}</strong> no está en Open Food Facts.
              </>
            )} Puedes introducir los valores de la etiqueta y quedará guardado para
            la próxima vez.
          </p>
          <div className="mt-5 grid gap-2">
            <button className="btn-primary" onClick={() => navigate(`/alimento/nuevo?codigo=${state.code}&tipo=${mealType}${date ? `&fecha=${date}` : ''}${state.name ? `&nombre=${encodeURIComponent(state.name)}` : ''}`)}>
              Introducir valores manualmente
            </button>
            <button className="btn-ghost" onClick={() => setState({ s: 'scan' })}>
              <ScanBarcode className="h-4 w-4" /> Escanear otro producto
            </button>
          </div>
        </div>
      )}

      {state.s === 'found' && (
        <div className="animate-slide-up space-y-4">
          <div className="card p-5">
            {(state.extra?.quantity || state.extra?.nutriscore || state.cachedOnly) && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {state.extra?.nutriscore && (
                  <span className={`chip px-3 py-1 font-bold uppercase text-white ${NUTRISCORE_COLORS[state.extra.nutriscore]}`}>Nutri-Score {state.extra.nutriscore}</span>
                )}
                {state.extra?.quantity && <span className="chip bg-ink-100 text-ink-700">Envase: {state.extra.quantity}</span>}
                {state.cachedOnly && <span className="chip bg-ink-100 text-ink-600">Datos guardados en el dispositivo</span>}
              </div>
            )}
            <AmountStep
              food={state.food}
              confirmLabel={saving ? 'Guardando…' : 'Añadir al diario'}
              onConfirm={(g) => addToDiary(state.food, g)}
              secondaryLabel="Combinar con otros alimentos"
              onSecondary={(g) => combine(state.food, g)}
              busy={saving}
            />
            {state.extra && state.extra.traces.length > 0 && (
              <p className="mt-3 text-xs text-ink-500">
                <span className="font-medium">Puede contener trazas de:</span> {state.extra.traces.join(', ')}
              </p>
            )}
            {state.food.nutrients.kcal === undefined && (
              <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Este producto no tiene información nutricional completa en Open Food Facts.
              </p>
            )}
          </div>
          <div className="card p-4">
            <span className="label">Añadir a</span>
            <MealTypePicker value={mealType} onChange={setMealType} />
          </div>
          <button className="btn-ghost w-full" onClick={() => setState({ s: 'scan' })}>
            <ScanBarcode className="h-4 w-4" /> Escanear otro producto
          </button>
        </div>
      )}
    </div>
  );
}
